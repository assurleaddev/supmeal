import { Prisma, TagType } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { canonicalName } from '../utils/text';
import { mealieToPayload, toMealieRecipe } from './mealieFormat';

/**
 * Export et import des données utilisateur (§2.2.6 et §2.2.7).
 *
 * Le format JSON produit est celui accepté en import : un aller-retour export → import doit
 * restituer les mêmes recettes.
 */

// ─────────────────────────────────────────
// Contrats
// ─────────────────────────────────────────

export const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv', 'mealie']).default('json'),
});

const importedIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const importedStepSchema = z.object({
  description: z.string().min(1),
  duration: z.number().int().positive().nullable().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

/** Un tag peut arriver sous forme de chaîne ou d'objet {name, type} selon la source. */
const importedTagSchema = z.union([
  z.string().min(1).max(50),
  z.object({ name: z.string().min(1).max(50), type: z.nativeEnum(TagType).optional() }),
]);

const importedRecipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  prepTime: z.number().int().positive().nullable().optional(),
  cookTime: z.number().int().positive().nullable().optional(),
  portions: z.number().int().min(1).max(1000).optional(),
  sourceUrl: z.string().nullable().optional(),
  ingredients: z.array(importedIngredientSchema).default([]),
  steps: z.array(importedStepSchema).default([]),
  tags: z.array(importedTagSchema).default([]),
});

const importedCookbookSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  recipes: z.array(importedRecipeSchema).default([]),
});

/**
 * Bornes volontairement explicites : sans elles, un fichier de quelques mégaoctets pouvait décrire
 * des dizaines de milliers de recettes et monopoliser la base pendant l'import.
 */
const MAX_RECIPES = 2000;
const MAX_COOKBOOKS = 200;

export const importPayloadSchema = z
  .object({
    personalRecipes: z.array(importedRecipeSchema).max(MAX_RECIPES).default([]),
    cookbooks: z.array(importedCookbookSchema).max(MAX_COOKBOOKS).default([]),
  })
  .refine(
    (data) => data.personalRecipes.length > 0 || data.cookbooks.length > 0,
    'Invalid import format: no recipes or cookbooks found',
  );

export type ImportPayload = z.infer<typeof importPayloadSchema>;
type ImportedRecipe = z.infer<typeof importedRecipeSchema>;

// ─────────────────────────────────────────
// Export
// ─────────────────────────────────────────

const exportInclude = {
  ingredients: { include: { ingredient: true }, orderBy: { orderIndex: 'asc' as const } },
  steps: { orderBy: { orderIndex: 'asc' as const } },
  tags: { include: { tag: true } },
} satisfies Prisma.RecipeInclude;

type ExportableRecipe = Prisma.RecipeGetPayload<{ include: typeof exportInclude }>;

function serializeRecipe(recipe: ExportableRecipe) {
  return {
    title: recipe.title,
    description: recipe.description,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    portions: recipe.portions,
    sourceUrl: recipe.sourceUrl,
    imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients.map((line) => ({
      name: line.ingredient.name,
      quantity: line.quantity,
      unit: line.unit,
      notes: line.notes,
      orderIndex: line.orderIndex,
    })),
    steps: recipe.steps.map((step) => ({
      orderIndex: step.orderIndex,
      description: step.description,
      duration: step.duration,
    })),
    tags: recipe.tags.map((link) => ({ name: link.tag.name, type: link.tag.type })),
  };
}

export async function buildExport(userId: string) {
  const [user, cookbooks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } }),
    prisma.cookbook.findMany({
      where: { createdById: userId },
      include: { recipes: { include: exportInclude } },
    }),
  ]);

  if (!user) throw new AppError('User not found', 404);

  const exportedCookbookIds = cookbooks.map((cookbook) => cookbook.id);

  // Toutes les recettes écrites par l'utilisateur et non déjà portées par un cookbook exporté —
  // y compris celles qu'il a créées dans le cookbook de quelqu'un d'autre, auparavant perdues.
  const looseRecipes = await prisma.recipe.findMany({
    where: {
      createdById: userId,
      OR: [
        { cookbookId: null },
        // Recettes déposées dans le cookbook d'un tiers : exportées tant que l'utilisateur en est
        // encore membre, écartées s'il l'a quitté puisqu'il n'y a plus accès.
        {
          cookbookId: { notIn: exportedCookbookIds },
          cookbook: { members: { some: { userId } } },
        },
      ],
    },
    include: exportInclude,
  });

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    user: { email: user.email, username: user.username },
    personalRecipes: looseRecipes.map(serializeRecipe),
    cookbooks: cookbooks.map((cookbook) => ({
      name: cookbook.name,
      description: cookbook.description ?? undefined,
      recipes: cookbook.recipes.map(serializeRecipe),
    })),
  };
}

export const CSV_HEADERS = [
  'cookbook', 'title', 'description', 'prepTime', 'cookTime',
  'portions', 'sourceUrl', 'tags', 'ingredients', 'steps',
] as const;

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function toCsv(data: Awaited<ReturnType<typeof buildExport>>): string {
  const rows = [CSV_HEADERS.join(',')];

  const appendRecipes = (recipes: ReturnType<typeof serializeRecipe>[], cookbook: string) => {
    for (const recipe of recipes) {
      rows.push(
        [
          cookbook,
          recipe.title,
          recipe.description ?? '',
          recipe.prepTime ?? '',
          recipe.cookTime ?? '',
          recipe.portions,
          recipe.sourceUrl ?? '',
          recipe.tags.map((tag) => tag.name).join(';'),
          recipe.ingredients
            .map((ing) => `${ing.quantity ?? ''}${ing.unit ?? ''} ${ing.name}`.trim())
            .join(';'),
          recipe.steps.map((step) => step.description).join(';'),
        ]
          .map(csvCell)
          .join(','),
      );
    }
  };

  appendRecipes(data.personalRecipes, 'Personal');
  for (const cookbook of data.cookbooks) appendRecipes(cookbook.recipes, cookbook.name);

  return rows.join('\n');
}

/**
 * Sérialisation au format Mealie : une liste plate de recettes au vocabulaire schema.org.
 *
 * Mealie n'a pas de notion de cookbook transposable, aussi les recettes des cookbooks sont
 * aplaties avec les recettes personnelles. L'export JSON natif reste le seul format qui préserve
 * l'organisation complète.
 */
export function toMealie(data: Awaited<ReturnType<typeof buildExport>>) {
  return [
    ...data.personalRecipes,
    ...data.cookbooks.flatMap((cookbook) => cookbook.recipes),
  ].map(toMealieRecipe);
}

// ─────────────────────────────────────────
// Lecture CSV
// ─────────────────────────────────────────

/**
 * Découpe un CSV en enregistrements.
 *
 * Le texte est parcouru caractère par caractère plutôt que découpé sur les retours à la ligne :
 * un champ entre guillemets peut légitimement en contenir, et un simple `split('\n')` coupait
 * alors la recette en deux lignes bancales.
 */
export function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== '')) records.push(row);
    row = [];
  };

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++; } // guillemet échappé
        else inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') endField();
    else if (char === '\r') continue;
    else if (char === '\n') endRow();
    else field += char;
  }

  if (field !== '' || row.length > 0) endRow();
  return records;
}

const splitMulti = (value: string) =>
  value.split(';').map((entry) => entry.trim()).filter(Boolean);

const toOptionalInt = (value: string) => {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
};

export function csvToPayload(csv: string): unknown {
  const records = parseCsvRecords(csv);
  if (records.length < 2) throw new AppError('CSV file is empty', 400);

  const headers = records[0].map((header) => header.trim());
  const personalRecipes: unknown[] = [];
  const byCookbook = new Map<string, unknown[]>();

  for (const record of records.slice(1)) {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = record[index] ?? ''; });

    if (!row.title?.trim()) continue; // ligne sans titre : rien d'exploitable

    const recipe = {
      title: row.title.trim(),
      description: row.description?.trim() || undefined,
      prepTime: toOptionalInt(row.prepTime ?? ''),
      cookTime: toOptionalInt(row.cookTime ?? ''),
      portions: toOptionalInt(row.portions ?? '') ?? 4,
      sourceUrl: row.sourceUrl?.trim() || undefined,
      ingredients: splitMulti(row.ingredients ?? '').map((name, index) => ({ name, orderIndex: index })),
      steps: splitMulti(row.steps ?? '').map((description, index) => ({ description, orderIndex: index })),
      tags: splitMulti(row.tags ?? ''),
    };

    const cookbook = row.cookbook?.trim();
    if (!cookbook || cookbook === 'Personal') {
      personalRecipes.push(recipe);
    } else {
      if (!byCookbook.has(cookbook)) byCookbook.set(cookbook, []);
      byCookbook.get(cookbook)!.push(recipe);
    }
  }

  return {
    personalRecipes,
    cookbooks: Array.from(byCookbook, ([name, recipes]) => ({ name, recipes })),
  };
}

/**
 * Reconnaît le format du fichier puis le ramène à la charge utile interne.
 *
 * Trois entrées sont acceptées (§2.2.7) : l'export JSON de SUPMEAL, un CSV, et un export Mealie —
 * ce dernier était annoncé dans l'interface et le manuel sans être implémenté, tout fichier Mealie
 * réel étant rejeté en « Invalid import format ».
 */
export function parseImportFile(content: string, filename: string): ImportPayload {
  if (filename.toLowerCase().endsWith('.csv')) {
    return importPayloadSchema.parse(csvToPayload(content));
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new AppError('File is not valid JSON', 400);
  }

  // Le format propre à SUPMEAL est reconnaissable à ses deux collections nommées.
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const isNative = record !== null && ('personalRecipes' in record || 'cookbooks' in record);

  if (!isNative) {
    const converted = mealieToPayload(raw);
    if (converted) return importPayloadSchema.parse(converted);
  }

  return importPayloadSchema.parse(raw);
}

// ─────────────────────────────────────────
// Import
// ─────────────────────────────────────────

type TxClient = Prisma.TransactionClient;

async function createRecipe(
  tx: TxClient,
  recipe: ImportedRecipe,
  userId: string,
  cookbookId: string | null,
) {
  const ingredients = await Promise.all(
    recipe.ingredients.map((ing) =>
      tx.ingredient.upsert({
        where: { name: canonicalName(ing.name) },
        update: {},
        create: { name: canonicalName(ing.name) },
      }),
    ),
  );

  const tags = await Promise.all(
    recipe.tags.map((tag) => {
      const name = canonicalName(typeof tag === 'string' ? tag : tag.name);
      const type = typeof tag === 'string' ? TagType.CUSTOM : tag.type ?? TagType.CUSTOM;
      return tx.tag.upsert({ where: { name }, update: {}, create: { name, type } });
    }),
  );

  await tx.recipe.create({
    data: {
      title: recipe.title,
      description: recipe.description,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      portions: recipe.portions ?? 4,
      // Une URL invalide ne doit pas faire échouer l'import d'une recette par ailleurs valide.
      sourceUrl: z.string().url().safeParse(recipe.sourceUrl).success ? recipe.sourceUrl : null,
      isPersonal: !cookbookId,
      createdById: userId,
      cookbookId,
      ingredients: {
        create: recipe.ingredients.map((ing, index) => ({
          ingredientId: ingredients[index].id,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          notes: ing.notes ?? null,
          orderIndex: ing.orderIndex ?? index,
        })),
      },
      steps: {
        create: recipe.steps.map((step, index) => ({
          orderIndex: step.orderIndex ?? index,
          description: step.description,
          duration: step.duration ?? null,
        })),
      },
      tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
    },
  });
}

export interface ImportReport {
  recipes: number;
  cookbooks: number;
  errors: string[];
}

/**
 * L'utilisateur qui importe devient le créateur des cookbooks importés (§2.2.7).
 *
 * Chaque cookbook est importé dans une transaction : soit il arrive complet avec ses recettes,
 * soit il n'est pas créé du tout. Les erreurs sont rapportées élément par élément plutôt que de
 * faire échouer l'ensemble, pour qu'un fichier partiellement valide reste exploitable.
 */
export async function importData(userId: string, payload: ImportPayload): Promise<ImportReport> {
  const report: ImportReport = { recipes: 0, cookbooks: 0, errors: [] };

  for (const recipe of payload.personalRecipes) {
    try {
      await prisma.$transaction((tx) => createRecipe(tx, recipe, userId, null));
      report.recipes++;
    } catch (err) {
      report.errors.push(`Recipe "${recipe.title}": ${(err as Error).message}`);
    }
  }

  for (const cookbook of payload.cookbooks) {
    try {
      const imported = await prisma.$transaction(async (tx) => {
        const created = await tx.cookbook.create({
          data: {
            name: cookbook.name,
            description: cookbook.description ?? null,
            createdById: userId,
            members: { create: { userId, role: 'CREATOR' } },
          },
        });

        for (const recipe of cookbook.recipes) {
          await createRecipe(tx, recipe, userId, created.id);
        }

        return cookbook.recipes.length;
      });

      report.cookbooks++;
      report.recipes += imported;
    } catch (err) {
      report.errors.push(`Cookbook "${cookbook.name}": ${(err as Error).message}`);
    }
  }

  return report;
}
