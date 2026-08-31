/**
 * Interopérabilité avec Mealie (§2.2.6 et §2.2.7).
 *
 * Mealie sérialise ses recettes selon le vocabulaire schema.org/Recipe, avec des champs qui n'ont
 * aucun équivalent direct dans SUPMEAL : `name` au lieu de `title`, `recipeYield` sous forme de
 * texte libre (« 4 servings »), durées en ISO 8601 (`PT1H30M`), et des ingrédients qui peuvent
 * arriver soit en chaînes brutes, soit en objets `{quantity, unit, food, note}`.
 *
 * Ce module traduit dans les deux sens. Il reste volontairement tolérant : un export Mealie réel
 * comporte des dizaines de champs propres à l'outil, qu'on ignore plutôt que de refuser le fichier.
 */

// ─────────────────────────────────────────
// Durées ISO 8601
// ─────────────────────────────────────────

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;

/** Formes rencontrées : « PT1H30M », « 45 minutes », « 1 h 15 », « 30 ». */
export function parseDurationToMinutes(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== 'string') return undefined;

  const text = value.trim();
  if (!text) return undefined;

  const iso = ISO_DURATION.exec(text);
  if (iso) {
    const [, days, hours, minutes, seconds] = iso;
    const total =
      Number(days ?? 0) * 1440 +
      Number(hours ?? 0) * 60 +
      Number(minutes ?? 0) +
      Number(seconds ?? 0) / 60;
    return total > 0 ? Math.round(total) : undefined;
  }

  // Texte libre : « 1 h 30 », « 1 hour 30 minutes », « 45 min ».
  // Les minutes peuvent suivre l'heure sans unité (« 1 h 15 »), d'où le second groupe optionnel :
  // sans lui, seule l'heure était comptée et « 1 h 15 » valait 60 minutes.
  const hourMatch = /(\d+)\s*(?:heures?|hours?|h)\s*(\d+)?/i.exec(text);
  const minuteMatch = /(\d+)\s*(?:minutes?|mins?|m)\b/i.exec(text);

  if (hourMatch) {
    const minutes = minuteMatch ? Number(minuteMatch[1]) : Number(hourMatch[2] ?? 0);
    const total = Number(hourMatch[1]) * 60 + minutes;
    return total > 0 ? total : undefined;
  }

  if (minuteMatch) {
    const total = Number(minuteMatch[1]);
    return total > 0 ? total : undefined;
  }

  const bare = Number(text);
  return Number.isFinite(bare) && bare > 0 ? Math.round(bare) : undefined;
}

export function minutesToIsoDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours > 0 ? `${hours}H` : ''}${rest > 0 || hours === 0 ? `${rest}M` : ''}`;
}

// ─────────────────────────────────────────
// Lecture d'un fichier Mealie
// ─────────────────────────────────────────

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Un nom peut être une chaîne, ou un objet `{name}` / `{text}` selon le champ. */
function readName(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  const record = asRecord(value);
  for (const key of ['name', 'text', 'title', 'display']) {
    const candidate = record?.[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

/** `recipeYield` : « 4 servings », « 4-6 parts », 4. */
function readYield(value: unknown): number | undefined {
  if (typeof value === 'number' && value >= 1) return Math.round(value);
  if (typeof value !== 'string') return undefined;
  const match = /\d+/.exec(value);
  const parsed = match ? Number(match[0]) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
}

interface ParsedIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  orderIndex: number;
}

function readIngredient(value: unknown, index: number): ParsedIngredient | null {
  // Forme schema.org : une simple chaîne, éventuellement « 200 g de farine ».
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? { name: text, orderIndex: index } : null;
  }

  const record = asRecord(value);
  if (!record) return null;

  // Forme Mealie : {quantity, unit: {name}, food: {name}, note}
  const name = readName(record.food) ?? readName(record.name) ?? readName(record.display);
  if (!name) return null;

  const quantityRaw = record.quantity;
  const quantity =
    typeof quantityRaw === 'number' && quantityRaw > 0
      ? quantityRaw
      : typeof quantityRaw === 'string' && Number(quantityRaw) > 0
        ? Number(quantityRaw)
        : null;

  return {
    name,
    quantity,
    unit: readName(record.unit) ?? null,
    notes: readName(record.note) ?? readName(record.notes) ?? null,
    orderIndex: index,
  };
}

function readInstruction(value: unknown, index: number) {
  const text = typeof value === 'string' ? value.trim() : readName(value);
  return text ? { description: text, orderIndex: index } : null;
}

function readTags(recipe: Record<string, unknown>): string[] {
  const collected: string[] = [];

  // Mealie sépare `tags` et `recipeCategory` ; SUPMEAL n'a qu'une notion de tag.
  for (const key of ['tags', 'recipeCategory', 'categories']) {
    const list = recipe[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const name = readName(entry);
      if (name) collected.push(name);
    }
  }

  return [...new Set(collected.map((tag) => tag.toLowerCase()))];
}

/** Reconnaît un objet recette au vocabulaire Mealie / schema.org. */
export function looksLikeMealieRecipe(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;

  const hasName = typeof record.name === 'string' || typeof record.slug === 'string';
  const hasRecipeShape =
    'recipeIngredient' in record ||
    'recipeInstructions' in record ||
    'recipe_ingredient' in record ||
    'recipe_instructions' in record;

  return hasName && hasRecipeShape;
}

function convertRecipe(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;

  const title = readName(record.name) ?? readName(record.slug);
  if (!title) return null;

  const ingredientSource = record.recipeIngredient ?? record.recipe_ingredient ?? [];
  const instructionSource = record.recipeInstructions ?? record.recipe_instructions ?? [];

  const ingredients = (Array.isArray(ingredientSource) ? ingredientSource : [])
    .map(readIngredient)
    .filter((entry): entry is ParsedIngredient => entry !== null)
    .map((entry, index) => ({ ...entry, orderIndex: index }));

  const steps = (Array.isArray(instructionSource) ? instructionSource : [])
    .map(readInstruction)
    .filter((entry): entry is { description: string; orderIndex: number } => entry !== null)
    .map((entry, index) => ({ ...entry, orderIndex: index }));

  // L'import exige au moins un ingrédient et une étape : une recette Mealie vide de l'un des deux
  // reçoit un contenu explicite plutôt que d'être rejetée silencieusement.
  if (ingredients.length === 0) ingredients.push({ name: 'non précisé', orderIndex: 0 });
  if (steps.length === 0) steps.push({ description: 'Aucune instruction fournie.', orderIndex: 0 });

  const sourceUrl =
    (typeof record.orgURL === 'string' && record.orgURL) ||
    (typeof record.org_url === 'string' && record.org_url) ||
    (typeof record.url === 'string' && record.url) ||
    undefined;

  return {
    title,
    description: typeof record.description === 'string' ? record.description : undefined,
    prepTime: parseDurationToMinutes(record.prepTime ?? record.prep_time),
    // Mealie stocke le temps de cuisson sous `performTime` ; `cookTime` existe aussi selon la version.
    cookTime: parseDurationToMinutes(
      record.cookTime ?? record.cook_time ?? record.performTime ?? record.perform_time,
    ),
    portions: readYield(record.recipeYield ?? record.recipe_yield ?? record.servings),
    sourceUrl,
    ingredients,
    steps,
    tags: readTags(record),
  };
}

/**
 * Convertit un fichier Mealie — recette isolée, tableau de recettes, ou objet englobant — vers la
 * charge utile d'import de SUPMEAL. Renvoie `null` si le contenu ne ressemble pas à du Mealie.
 */
export function mealieToPayload(parsed: unknown): { personalRecipes: unknown[] } | null {
  const candidates: unknown[] = Array.isArray(parsed)
    ? parsed
    : looksLikeMealieRecipe(parsed)
      ? [parsed]
      : (() => {
          // Certains exports encapsulent la liste sous `recipes` ou `items`.
          const record = asRecord(parsed);
          for (const key of ['recipes', 'items', 'data']) {
            const list = record?.[key];
            if (Array.isArray(list) && list.some(looksLikeMealieRecipe)) return list;
          }
          return [];
        })();

  const mealieRecipes = candidates.filter(looksLikeMealieRecipe);
  if (mealieRecipes.length === 0) return null;

  const personalRecipes = mealieRecipes
    .map(convertRecipe)
    .filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== null);

  return personalRecipes.length > 0 ? { personalRecipes } : null;
}

// ─────────────────────────────────────────
// Écriture d'un fichier Mealie
// ─────────────────────────────────────────

interface ExportedRecipe {
  title: string;
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  portions: number;
  sourceUrl: string | null;
  ingredients: { name: string; quantity: number | null; unit: string | null; notes: string | null }[];
  steps: { description: string }[];
  tags: { name: string }[];
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Sérialise une recette selon le vocabulaire attendu par l'import de Mealie. */
export function toMealieRecipe(recipe: ExportedRecipe) {
  return {
    name: recipe.title,
    slug: slugify(recipe.title),
    description: recipe.description ?? '',
    recipeYield: `${recipe.portions}`,
    prepTime: minutesToIsoDuration(recipe.prepTime),
    performTime: minutesToIsoDuration(recipe.cookTime),
    totalTime: minutesToIsoDuration((recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)),
    orgURL: recipe.sourceUrl,
    recipeIngredient: recipe.ingredients.map((line) => ({
      quantity: line.quantity ?? 0,
      unit: line.unit ? { name: line.unit } : null,
      food: { name: line.name },
      note: line.notes ?? '',
      // `display` est le libellé affiché par Mealie lorsqu'il ne recompose pas la ligne.
      display: [line.quantity, line.unit, line.name].filter(Boolean).join(' '),
    })),
    recipeInstructions: recipe.steps.map((step) => ({ text: step.description })),
    tags: recipe.tags.map((tag) => ({ name: tag.name, slug: slugify(tag.name) })),
    recipeCategory: [],
  };
}
