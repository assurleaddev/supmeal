import { CookbookRole, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { canonicalName } from '../utils/text';
import { isSearchIndexReady } from '../config/searchIndex';
import {
  optionalPositiveInt,
  optionalPositiveNumber,
  optionalString,
  optionalUrl,
} from '../utils/validation';

/**
 * Logique métier des recettes : contrôles d'accès, canonicalisation des ingrédients et des tags,
 * construction des critères de recherche. Les routes ne font qu'adapter HTTP vers ces fonctions.
 */

// ─────────────────────────────────────────
// Contrats d'entrée
// ─────────────────────────────────────────

const ingredientSchema = z.object({
  name: z.string().min(1).max(100),
  quantity: optionalPositiveNumber,
  unit: optionalString(50),
  notes: optionalString(200),
  orderIndex: z.number().int().min(0).default(0),
});

const stepSchema = z.object({
  description: z.string().min(1),
  duration: optionalPositiveInt,
  orderIndex: z.number().int().min(0),
});

export const recipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: optionalString(2000),
  prepTime: optionalPositiveInt,
  cookTime: optionalPositiveInt,
  // Laissé optionnel : à défaut, le nombre de portions préféré de l'utilisateur s'applique.
  portions: z.number().int().min(1).max(1000).optional(),
  sourceUrl: optionalUrl,
  cookbookId: optionalString(100),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  tags: z.array(z.string()).optional().default([]),
});

export const recipeUpdateSchema = recipeSchema.partial();

export const commentSchema = z.object({ content: z.string().min(1).max(2000) });

export const recipeQuerySchema = z.object({
  q: z.string().optional(),
  cookbookId: z.string().optional(),
  tags: z.string().optional(),
  ingredients: z.string().optional(),
  maxPrepTime: z.coerce.number().int().positive().optional(),
  maxCookTime: z.coerce.number().int().positive().optional(),
  favorites: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type RecipeInput = z.infer<typeof recipeSchema>;
export type RecipeUpdateInput = z.infer<typeof recipeUpdateSchema>;
export type RecipeQuery = z.infer<typeof recipeQuerySchema>;

// ─────────────────────────────────────────
// Projection commune
// ─────────────────────────────────────────

export const recipeInclude = {
  createdBy: { select: { id: true, username: true, avatar: true } },
  cookbook: { select: { id: true, name: true } },
  ingredients: {
    include: { ingredient: true },
    orderBy: { orderIndex: 'asc' as const },
  },
  steps: { orderBy: { orderIndex: 'asc' as const } },
  tags: { include: { tag: true } },
  _count: { select: { favorites: true, comments: true } },
} satisfies Prisma.RecipeInclude;

// ─────────────────────────────────────────
// Règles d'accès
// ─────────────────────────────────────────

/** Rôles autorisés à créer, modifier ou supprimer une recette dans un cookbook. */
const WRITE_ROLES: CookbookRole[] = [CookbookRole.CREATOR, CookbookRole.EDITOR];

async function getMembership(cookbookId: string, userId: string) {
  return prisma.cookbookMember.findUnique({
    where: { cookbookId_userId: { cookbookId, userId } },
  });
}

/**
 * Une recette rattachée à un cookbook est gouvernée par l'appartenance à ce cookbook, jamais par
 * son auteur.
 *
 * Faire primer la qualité d'auteur laissait un ancien membre lire, modifier et supprimer les
 * recettes qu'il avait déposées dans un cookbook qu'il avait quitté : contribuer puis partir
 * n'enlevait aucun droit. L'auteur ne conserve de privilège que sur ses recettes personnelles.
 */
async function assertCanRead(
  recipe: { createdById: string; cookbookId: string | null },
  userId: string,
): Promise<void> {
  if (recipe.cookbookId) {
    const member = await getMembership(recipe.cookbookId, userId);
    if (member) return;
    throw new AppError('Access denied', 403);
  }

  if (recipe.createdById === userId) return;
  throw new AppError('Access denied', 403);
}

/** CREATOR ou EDITOR du cookbook ; pour une recette personnelle, son auteur. */
async function assertCanWrite(
  recipe: { createdById: string; cookbookId: string | null },
  userId: string,
): Promise<void> {
  if (recipe.cookbookId) {
    const member = await getMembership(recipe.cookbookId, userId);
    if (member && WRITE_ROLES.includes(member.role)) return;
    throw new AppError('Insufficient permissions', 403);
  }

  if (recipe.createdById === userId) return;
  throw new AppError('Access denied', 403);
}

/**
 * Droits d'écriture de l'appelant sur une recette, sous forme booléenne.
 *
 * Renvoyés avec la recette pour que le client affiche ou masque « Modifier » et « Supprimer » sans
 * réimplémenter la règle. Il testait auparavant `createdById === user.id`, ce qui privait les
 * EDITOR d'un cookbook des actions que le serveur leur accorde pourtant.
 */
async function canWrite(
  recipe: { createdById: string; cookbookId: string | null },
  userId: string,
): Promise<boolean> {
  try {
    await assertCanWrite(recipe, userId);
    return true;
  } catch {
    return false;
  }
}

async function assertCanAddToCookbook(cookbookId: string, userId: string): Promise<void> {
  const member = await getMembership(cookbookId, userId);
  if (!member || !WRITE_ROLES.includes(member.role)) {
    throw new AppError('Insufficient permissions to add recipes to this cookbook', 403);
  }
}

/**
 * Recettes qu'un utilisateur a le droit de voir.
 *
 * Règle unique, partagée par la recherche, les compteurs et la planification : une recette
 * personnelle n'appartient qu'à son auteur, une recette de cookbook n'est visible que par les
 * membres de ce cookbook — l'auteur compris, qui la perd donc en quittant le groupe.
 */
/**
 * Préférences culinaires de l'utilisateur, telles qu'elles influencent les recettes.
 *
 * Elles étaient enregistrées et modifiables mais totalement inertes : aucune n'avait d'effet.
 */
async function getPreferences(userId: string) {
  return prisma.userPreferences.findUnique({
    where: { userId },
    select: { allergies: true, defaultPortions: true },
  });
}

/**
 * Allergènes déclarés par l'utilisateur retrouvés parmi les ingrédients d'une recette.
 *
 * La comparaison se fait sur les formes canoniques et par inclusion, afin que « arachide » alerte
 * sur « beurre d'arachide ». Signalé, jamais bloquant : c'est un avertissement, pas une interdiction.
 */
function matchAllergens(allergies: string[], ingredientNames: string[]): string[] {
  const found = allergies.filter((allergen) => {
    const needle = canonicalName(allergen);
    return needle.length > 0 && ingredientNames.some((name) => name.includes(needle));
  });

  return [...new Set(found)];
}

export function visibleRecipeFilter(userId: string): Prisma.RecipeWhereInput {
  return {
    OR: [
      { cookbookId: null, createdById: userId },
      { cookbookId: { not: null }, cookbook: { members: { some: { userId } } } },
    ],
  };
}

async function findRecipeOrFail(id: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) throw new AppError('Recipe not found', 404);
  return recipe;
}

// ─────────────────────────────────────────
// Canonicalisation
// ─────────────────────────────────────────

// Ingrédients et tags sont des catalogues partagés entre toutes les recettes : chaque libellé est
// ramené à sa forme canonique avant l'upsert, sinon « Tomate » et « tomate » créeraient deux
// lignes et le filtrage par ingrédient deviendrait faux.

function upsertIngredients(names: string[]) {
  return Promise.all(
    names.map((name) =>
      prisma.ingredient.upsert({
        where: { name: canonicalName(name) },
        update: {},
        create: { name: canonicalName(name) },
      }),
    ),
  );
}

function upsertTags(names: string[]) {
  return Promise.all(
    names.map((name) =>
      prisma.tag.upsert({
        where: { name: canonicalName(name) },
        update: {},
        create: { name: canonicalName(name) },
      }),
    ),
  );
}

// ─────────────────────────────────────────
// Recherche
// ─────────────────────────────────────────

/**
 * Les critères sont accumulés dans un AND plutôt qu'assignés sur un objet partagé : le filtre
 * d'accès ne doit jamais pouvoir être écrasé par un filtre ultérieur, sans quoi la requête
 * exposerait les recettes des autres utilisateurs.
 */
/** Borne le nombre d'identifiants rapatriés par la recherche textuelle. */
const SEARCH_MATCH_CAP = 5000;

/** `%` et `_` sont des jokers LIKE : ils doivent être neutralisés dans une saisie utilisateur. */
const escapeLike = (term: string) => term.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Identifiants des recettes dont un champ textuel contient le terme, diacritiques ignorés.
 *
 * Passe par du SQL car `supmeal_normalize` — et les index GIN trigrammes posés dessus — ne sont pas
 * exprimables avec le constructeur de requêtes Prisma. Le résultat est ensuite réinjecté comme un
 * simple critère `id IN (…)`, de sorte que le filtre d'accès et la pagination restent gérés par
 * Prisma et ne puissent pas être contournés par ce SQL.
 */
async function searchRecipeIds(term: string): Promise<string[]> {
  const escaped = escapeLike(term);

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT r.id
    FROM "Recipe" r
    LEFT JOIN "RecipeStep" s ON s."recipeId" = r.id
    LEFT JOIN "RecipeIngredient" ri ON ri."recipeId" = r.id
    LEFT JOIN "Ingredient" i ON i.id = ri."ingredientId"
    LEFT JOIN "RecipeTag" rt ON rt."recipeId" = r.id
    LEFT JOIN "Tag" t ON t.id = rt."tagId"
    WHERE supmeal_normalize(r.title) LIKE '%' || supmeal_normalize(${escaped}) || '%' ESCAPE '\'
       OR supmeal_normalize(coalesce(r.description, '')) LIKE '%' || supmeal_normalize(${escaped}) || '%' ESCAPE '\'
       OR supmeal_normalize(coalesce(s.description, '')) LIKE '%' || supmeal_normalize(${escaped}) || '%' ESCAPE '\'
       OR supmeal_normalize(coalesce(i.name, '')) LIKE '%' || supmeal_normalize(${escaped}) || '%' ESCAPE '\'
       OR supmeal_normalize(coalesce(t.name, '')) LIKE '%' || supmeal_normalize(${escaped}) || '%' ESCAPE '\'
    LIMIT ${SEARCH_MATCH_CAP}
  `;

  return rows.map((row) => row.id);
}

/**
 * Repli lorsque les extensions PostgreSQL ne sont pas disponibles : `ILIKE`, donc sensible aux
 * accents et sans index. Le périmètre des champs fouillés reste identique.
 */
function fallbackTextFilter(term: string): Prisma.RecipeWhereInput {
  return {
    OR: [
      { title: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { steps: { some: { description: { contains: term, mode: 'insensitive' } } } },
      { ingredients: { some: { ingredient: { name: { contains: term, mode: 'insensitive' } } } } },
      { tags: { some: { tag: { name: { contains: term, mode: 'insensitive' } } } } },
    ],
  };
}

/** Critère textuel : titre, description, étapes (« contenu » du §2.2.2), ingrédients et tags. */
async function textFilter(term: string): Promise<Prisma.RecipeWhereInput> {
  if (!isSearchIndexReady()) return fallbackTextFilter(term);

  const ids = await searchRecipeIds(term);
  return { id: { in: ids } };
}

function buildSearchFilters(userId: string, query: RecipeQuery): Prisma.RecipeWhereInput[] {
  const filters: Prisma.RecipeWhereInput[] = [visibleRecipeFilter(userId)];

  if (query.cookbookId) filters.push({ cookbookId: query.cookbookId });

  const tagList = splitList(query.tags);
  if (tagList.length > 0) {
    filters.push({ tags: { some: { tag: { name: { in: tagList } } } } });
  }

  const ingredientList = splitList(query.ingredients);
  if (ingredientList.length > 0) {
    // `mode: insensitive` est sans effet dans un filtre `in` : la liste est développée en un OR de
    // `contains`, ce qui rend aussi le filtre tolérant aux saisies partielles.
    filters.push({
      OR: ingredientList.map((name) => ({
        ingredients: { some: { ingredient: { name: { contains: name, mode: 'insensitive' as const } } } },
      })),
    });
  }

  if (query.maxPrepTime) filters.push({ prepTime: { lte: query.maxPrepTime } });
  if (query.maxCookTime) filters.push({ cookTime: { lte: query.maxCookTime } });
  if (query.favorites === 'true') filters.push({ favorites: { some: { userId } } });

  return filters;
}

function splitList(value?: string): string[] {
  if (!value) return [];
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

// ─────────────────────────────────────────
// Opérations
// ─────────────────────────────────────────

export async function listRecipes(userId: string, query: RecipeQuery) {
  const filters = buildSearchFilters(userId, query);
  if (query.q) filters.push(await textFilter(query.q));

  const where: Prisma.RecipeWhereInput = { AND: filters };
  const skip = (query.page - 1) * query.limit;

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include: {
        ...recipeInclude,
        favorites: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.recipe.count({ where }),
  ]);

  return {
    items: recipes.map(({ favorites, ...recipe }) => ({
      ...recipe,
      isFavorite: favorites.length > 0,
    })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function getRecipe(id: string, userId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ...recipeInclude,
      favorites: { where: { userId }, select: { userId: true } },
      comments: {
        include: { user: { select: { id: true, username: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!recipe) throw new AppError('Recipe not found', 404);
  await assertCanRead(recipe, userId);

  const { favorites, ...rest } = recipe;
  const [writable, preferences] = await Promise.all([canWrite(recipe, userId), getPreferences(userId)]);

  return {
    ...rest,
    isFavorite: favorites.length > 0,
    permissions: { canEdit: writable, canDelete: writable },
    allergyWarnings: matchAllergens(
      preferences?.allergies ?? [],
      recipe.ingredients.map((line) => line.ingredient.name),
    ),
  };
}

export async function createRecipe(userId: string, input: RecipeInput) {
  if (input.cookbookId) await assertCanAddToCookbook(input.cookbookId, userId);

  const preferences = input.portions === undefined ? await getPreferences(userId) : null;
  const portions = input.portions ?? preferences?.defaultPortions ?? 4;

  const [ingredients, tags] = await Promise.all([
    upsertIngredients(input.ingredients.map((ing) => ing.name)),
    upsertTags(input.tags),
  ]);

  return prisma.recipe.create({
    data: {
      title: input.title,
      description: input.description,
      prepTime: input.prepTime,
      cookTime: input.cookTime,
      portions,
      sourceUrl: input.sourceUrl,
      // Une recette est personnelle si et seulement si elle n'est rattachée à aucun cookbook.
      // Dérivé ici et jamais reçu du client, pour rester la seule source de vérité.
      isPersonal: !input.cookbookId,
      createdById: userId,
      cookbookId: input.cookbookId,
      ingredients: {
        create: input.ingredients.map((ing, index) => ({
          ingredientId: ingredients[index].id,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
          orderIndex: ing.orderIndex,
        })),
      },
      steps: {
        create: input.steps.map((step) => ({
          orderIndex: step.orderIndex,
          description: step.description,
          duration: step.duration,
        })),
      },
      tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
    },
    include: recipeInclude,
  });
}

export async function updateRecipe(id: string, userId: string, input: RecipeUpdateInput) {
  const existing = await findRecipeOrFail(id);
  await assertCanWrite(existing, userId);

  const data: Prisma.RecipeUpdateInput = {
    title: input.title,
    description: input.description,
    prepTime: input.prepTime,
    cookTime: input.cookTime,
    portions: input.portions,
    sourceUrl: input.sourceUrl,
  };

  // Ingrédients, étapes et tags sont remplacés en bloc : leur ordre et leur composition forment un
  // tout, un diff élément par élément n'apporterait rien ici.
  if (input.ingredients) {
    const ingredients = await upsertIngredients(input.ingredients.map((ing) => ing.name));
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
    data.ingredients = {
      create: input.ingredients.map((ing, index) => ({
        ingredientId: ingredients[index].id,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes,
        orderIndex: ing.orderIndex ?? index,
      })),
    };
  }

  if (input.steps) {
    await prisma.recipeStep.deleteMany({ where: { recipeId: id } });
    data.steps = {
      create: input.steps.map((step, index) => ({
        orderIndex: step.orderIndex ?? index,
        description: step.description,
        duration: step.duration,
      })),
    };
  }

  if (input.tags) {
    const tags = await upsertTags(input.tags);
    await prisma.recipeTag.deleteMany({ where: { recipeId: id } });
    data.tags = { create: tags.map((tag) => ({ tagId: tag.id })) };
  }

  return prisma.recipe.update({ where: { id }, data, include: recipeInclude });
}

export async function deleteRecipe(id: string, userId: string) {
  const recipe = await findRecipeOrFail(id);
  await assertCanWrite(recipe, userId);
  await prisma.recipe.delete({ where: { id } });
}

export async function setRecipeImage(id: string, userId: string, filename: string) {
  const recipe = await findRecipeOrFail(id);
  await assertCanWrite(recipe, userId);

  return prisma.recipe.update({
    where: { id },
    data: { imageUrl: `/uploads/recipes/${filename}` },
    select: { id: true, imageUrl: true },
  });
}

export async function setFavorite(userId: string, recipeId: string, isFavorite: boolean) {
  const recipe = await findRecipeOrFail(recipeId);
  await assertCanRead(recipe, userId);

  if (isFavorite) {
    await prisma.favorite.upsert({
      where: { userId_recipeId: { userId, recipeId } },
      update: {},
      create: { userId, recipeId },
    });
  } else {
    await prisma.favorite.deleteMany({ where: { userId, recipeId } });
  }

  return { isFavorite };
}

// ─────────────────────────────────────────
// Commentaires
// ─────────────────────────────────────────

export async function listComments(recipeId: string, userId: string) {
  const recipe = await findRecipeOrFail(recipeId);
  // Sans ce contrôle, les commentaires d'un cookbook privé étaient lisibles par tout compte connecté.
  await assertCanRead(recipe, userId);

  return prisma.comment.findMany({
    where: { recipeId },
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addComment(recipeId: string, userId: string, content: string) {
  const recipe = await findRecipeOrFail(recipeId);
  await assertCanRead(recipe, userId);

  if (recipe.cookbookId) {
    const member = await getMembership(recipe.cookbookId, userId);
    if (member?.role === CookbookRole.READER) {
      throw new AppError('Insufficient permissions to comment', 403);
    }
  }

  return prisma.comment.create({
    data: { recipeId, userId, content },
    include: { user: { select: { id: true, username: true, avatar: true } } },
  });
}

export async function deleteComment(commentId: string, userId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.userId !== userId) throw new AppError('Access denied', 403);

  await prisma.comment.delete({ where: { id: commentId } });
}
