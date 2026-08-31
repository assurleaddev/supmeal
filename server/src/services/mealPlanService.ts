import { MealType, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { resolveWeek, toDateString } from '../utils/week';
import { visibleRecipeFilter } from './recipeService';

/**
 * Logique métier de la planification : appartenance des plannings, résolution des semaines et
 * agrégation de la liste de courses.
 */

// ─────────────────────────────────────────
// Contrats d'entrée
// ─────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected format YYYY-MM-DD');

export const mealPlanSchema = z.object({
  name: z.string().max(100).optional(),
  weekStart: isoDate,
  cookbookId: z.string().optional().nullable(),
});

export const mealPlanItemSchema = z.object({
  recipeId: z.string().min(1),
  date: isoDate,
  mealType: z.nativeEnum(MealType),
  portions: z.number().int().min(1).optional(),
});

export const weekQuerySchema = z.object({
  offset: z.coerce.number().int().min(-520).max(520).default(0),
});

const planInclude = {
  items: {
    include: {
      recipe: {
        select: { id: true, title: true, imageUrl: true, prepTime: true, cookTime: true, portions: true },
      },
    },
    orderBy: [{ date: 'asc' as const }, { mealType: 'asc' as const }],
  },
  cookbook: { select: { id: true, name: true } },
} satisfies Prisma.MealPlanInclude;

// ─────────────────────────────────────────
// Appartenance
// ─────────────────────────────────────────

/** Un planning n'est accessible qu'à son propriétaire. */
async function assertOwnsPlan(planId: string, userId: string) {
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError('Meal plan not found', 404);
  if (plan.userId !== userId) throw new AppError('Access denied', 403);
  return plan;
}

// ─────────────────────────────────────────
// Lecture
// ─────────────────────────────────────────

export function listPlans(userId: string) {
  return prisma.mealPlan.findMany({
    where: { userId },
    include: planInclude,
    orderBy: { weekStart: 'desc' },
  });
}

export async function getPlan(planId: string, userId: string) {
  await assertOwnsPlan(planId, userId);
  return prisma.mealPlan.findUnique({ where: { id: planId }, include: planInclude });
}

/**
 * Résout une semaine à partir d'un simple décalage et renvoie ses bornes avec le planning
 * correspondant. Le client n'a ainsi aucun calcul de calendrier à faire (§2.3.1).
 */
export async function getWeek(userId: string, offset: number) {
  const { weekStart, weekStartString, weekEndString, days } = resolveWeek(offset);

  const plan = await prisma.mealPlan.findFirst({
    where: { userId, weekStart },
    include: planInclude,
  });

  const formattedStart = weekStart.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return {
    weekStart: weekStartString,
    weekEnd: weekEndString,
    days,
    today: toDateString(new Date()),
    defaultName: `Semaine du ${formattedStart}`,
    plan,
  };
}

// ─────────────────────────────────────────
// Écriture
// ─────────────────────────────────────────

export function createPlan(userId: string, input: z.infer<typeof mealPlanSchema>) {
  return prisma.mealPlan.create({
    data: {
      userId,
      name: input.name,
      weekStart: new Date(input.weekStart),
      cookbookId: input.cookbookId,
    },
    include: planInclude,
  });
}

export async function deletePlan(planId: string, userId: string) {
  await assertOwnsPlan(planId, userId);
  await prisma.mealPlan.delete({ where: { id: planId } });
}

export async function addItem(
  planId: string,
  userId: string,
  input: z.infer<typeof mealPlanItemSchema>,
) {
  await assertOwnsPlan(planId, userId);

  // La recette doit être visible par l'utilisateur : sans ce contrôle, n'importe quel identifiant
  // de recette pouvait être planifié, y compris celui d'une recette privée d'un autre compte.
  const recipe = await prisma.recipe.findFirst({
    where: { id: input.recipeId, ...visibleRecipeFilter(userId) },
    select: { id: true },
  });
  if (!recipe) throw new AppError('Recipe not found', 404);

  return prisma.mealPlanItem.create({
    data: {
      mealPlanId: planId,
      recipeId: input.recipeId,
      date: new Date(input.date),
      mealType: input.mealType,
      portions: input.portions,
    },
    include: { recipe: { select: { id: true, title: true, imageUrl: true } } },
  });
}

export async function removeItem(planId: string, itemId: string, userId: string) {
  await assertOwnsPlan(planId, userId);

  // Filtré sur `mealPlanId` : sans cette contrainte, le propriétaire d'un planning pouvait
  // supprimer l'entrée d'un planning appartenant à quelqu'un d'autre en fournissant son identifiant.
  const { count } = await prisma.mealPlanItem.deleteMany({
    where: { id: itemId, mealPlanId: planId },
  });
  if (count === 0) throw new AppError('Item not found in this meal plan', 404);
}

// ─────────────────────────────────────────
// Liste de courses
// ─────────────────────────────────────────

export interface ShoppingListEntry {
  name: string;
  totalQuantity: number | null;
  unit: string | null;
  notes: string[];
}

/**
 * Les ingrédients sont regroupés par couple (nom, unité) dans une `Map`, soit un seul passage sur
 * les entrées du planning. L'unité sert de clé sous forme normalisée pour que « g » et « G » ne
 * produisent pas deux lignes distinctes, mais c'est la forme saisie qui reste affichée.
 *
 * Aucune conversion entre unités n'est tentée : 200 g et 0,2 kg restent deux lignes, faute d'un
 * référentiel d'unités fiable pour les ingrédients de cuisine.
 */
/** Entrée de planning telle que consommée par l'agrégation — sans dépendance à Prisma. */
export interface PlannedRecipe {
  portions: number | null;
  recipe: {
    portions: number;
    ingredients: {
      quantity: number | null;
      unit: string | null;
      notes: string | null;
      ingredient: { name: string };
    }[];
  };
}

/** Fonction pure, isolée de l'accès aux données pour rester directement testable. */
export function aggregateIngredients(items: PlannedRecipe[]): ShoppingListEntry[] {
  const aggregated = new Map<string, ShoppingListEntry>();

  for (const item of items) {
    // Une entrée peut demander un nombre de portions différent de celui de la recette.
    const scale = item.portions && item.recipe.portions ? item.portions / item.recipe.portions : 1;

    for (const line of item.recipe.ingredients) {
      const key = `${line.ingredient.name}|${line.unit?.trim().toLowerCase() ?? ''}`;
      const scaledQuantity = line.quantity === null ? null : line.quantity * scale;
      const existing = aggregated.get(key);

      if (!existing) {
        aggregated.set(key, {
          name: line.ingredient.name,
          totalQuantity: scaledQuantity,
          unit: line.unit,
          notes: line.notes ? [line.notes] : [],
        });
        continue;
      }

      // Une première occurrence sans quantité ne doit pas faire disparaître les suivantes :
      // le total repart de 0 plutôt que de rester bloqué à null.
      if (scaledQuantity !== null) {
        existing.totalQuantity = (existing.totalQuantity ?? 0) + scaledQuantity;
      }
      if (line.notes) existing.notes.push(line.notes);
    }
  }

  return Array.from(aggregated.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function getShoppingList(planId: string, userId: string): Promise<ShoppingListEntry[]> {
  await assertOwnsPlan(planId, userId);

  const plan = await prisma.mealPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        include: {
          recipe: {
            include: { ingredients: { include: { ingredient: true }, orderBy: { orderIndex: 'asc' } } },
          },
        },
      },
    },
  });

  if (!plan) throw new AppError('Meal plan not found', 404);

  return aggregateIngredients(plan.items);
}
