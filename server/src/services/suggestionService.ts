import { MealType, TagType } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { visibleRecipeFilter } from './recipeService';
import { startOfWeek, toDateString } from '../utils/week';
import {
  CandidateRecipe,
  MealSlot,
  ScoredSuggestion,
  SuggestionContext,
  UserSignals,
  rankSuggestions,
} from './suggestionEngine';

/**
 * Suggestions de recettes : rassemble les signaux, délègue le classement à `suggestionEngine`.
 *
 * La séparation est volontaire — le classement est du calcul pur et testable, cette couche ne fait
 * que lire la base et traduire.
 */

export const suggestionQuerySchema = z.object({
  /** Date du créneau à garnir. Par défaut aujourd'hui. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mealType: z.nativeEnum(MealType).default(MealType.DINNER),
  limit: z.coerce.number().int().min(1).max(10).default(4),
});

export type SuggestionQuery = z.infer<typeof suggestionQuerySchema>;

/**
 * Nombre de recettes examinées au plus.
 *
 * Le classement est en O(n) sur le corpus, mais l'IDF et la diversification imposent de tout charger
 * en mémoire. La borne garde la requête prévisible ; au-delà, il faudrait précalculer les vecteurs.
 */
const CORPUS_CAP = 500;

/** Profondeur d'historique retenue : au-delà, la décroissance rend la contribution négligeable. */
const HISTORY_WEEKS = 26;

const recipeSelection = {
  id: true,
  title: true,
  prepTime: true,
  cookTime: true,
  ingredients: { select: { ingredient: { select: { name: true } } } },
  tags: { select: { tag: { select: { name: true, type: true } } } },
  _count: { select: { favorites: true, comments: true } },
} as const;

type LoadedRecipe = {
  id: string;
  title: string;
  prepTime: number | null;
  cookTime: number | null;
  ingredients: { ingredient: { name: string } }[];
  tags: { tag: { name: string; type: TagType } }[];
  _count: { favorites: number; comments: number };
};

function toCandidate(recipe: LoadedRecipe): CandidateRecipe {
  const tags = recipe.tags.map((link) => link.tag);

  return {
    id: recipe.id,
    title: recipe.title,
    ingredients: recipe.ingredients.map((line) => line.ingredient.name),
    tags: tags.map((tag) => tag.name),
    cuisines: tags.filter((tag) => tag.type === TagType.CUISINE).map((tag) => tag.name),
    diets: tags.filter((tag) => tag.type === TagType.DIET).map((tag) => tag.name),
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    favoriteCount: recipe._count.favorites,
    commentCount: recipe._count.comments,
  };
}

/** Écart en semaines entre deux lundis, borné à zéro. */
function weeksBetween(from: Date, to: Date): number {
  const millisecondsPerWeek = 7 * 86_400_000;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / millisecondsPerWeek));
}

export interface SuggestionResult {
  /** Créneau effectivement considéré, tel que résolu par le serveur. */
  context: { date: string; mealType: MealType; weekend: boolean; weekStart: string };
  suggestions: ScoredSuggestion[];
  /** Ce sur quoi le classement s'est appuyé — rend le résultat interprétable. */
  basis: {
    corpusSize: number;
    favorites: number;
    plannedHistory: number;
    ingredientsAlreadyNeeded: number;
    allergiesExcluded: number;
    hasDeclaredPreferences: boolean;
    /** Vrai si toutes les recettes étaient déjà planifiées et que des répétitions ont été proposées. */
    relaxed: boolean;
  };
}

export async function suggestRecipes(
  userId: string,
  query: SuggestionQuery,
): Promise<SuggestionResult> {
  const targetDate = query.date ? new Date(`${query.date}T00:00:00Z`) : new Date();
  const weekStart = startOfWeek(targetDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  // Le samedi et le dimanche autorisent des préparations plus longues.
  const dayOfWeek = targetDate.getUTCDay();
  const weekend = dayOfWeek === 0 || dayOfWeek === 6;

  const historyStart = new Date(weekStart);
  historyStart.setUTCDate(historyStart.getUTCDate() - HISTORY_WEEKS * 7);

  const visible = visibleRecipeFilter(userId);

  const [corpus, preferences, favorites, history, weekItems] = await Promise.all([
    prisma.recipe.findMany({
      where: visible,
      select: recipeSelection,
      orderBy: { createdAt: 'desc' },
      take: CORPUS_CAP,
    }),

    prisma.userPreferences.findUnique({
      where: { userId },
      select: { allergies: true, diet: true, cuisineTypes: true },
    }),

    prisma.favorite.findMany({ where: { userId }, select: { recipeId: true } }),

    // Historique : ce que l'utilisateur a planifié, y compris via les plannings partagés.
    prisma.mealPlanItem.findMany({
      where: {
        mealPlan: {
          OR: [{ userId }, { cookbookId: { not: null }, cookbook: { members: { some: { userId } } } }],
        },
        date: { gte: historyStart, lt: weekStart },
      },
      select: { recipeId: true, date: true },
    }),

    // La semaine visée : ses recettes ne sont pas resuggérées, ses ingrédients servent de garde-manger.
    prisma.mealPlanItem.findMany({
      where: {
        mealPlan: {
          OR: [{ userId }, { cookbookId: { not: null }, cookbook: { members: { some: { userId } } } }],
        },
        date: { gte: weekStart, lte: weekEnd },
      },
      select: {
        recipeId: true,
        recipe: { select: { ingredients: { select: { ingredient: { select: { name: true } } } } } },
      },
    }),
  ]);

  const signals: UserSignals = {
    favoriteRecipeIds: favorites.map((entry) => entry.recipeId),
    planned: history.map((item) => ({
      recipeId: item.recipeId,
      weeksAgo: weeksBetween(startOfWeek(item.date), weekStart),
    })),
    allergies: preferences?.allergies ?? [],
    diets: preferences?.diet ?? [],
    cuisines: preferences?.cuisineTypes ?? [],
  };

  const context: SuggestionContext = {
    slot: query.mealType as MealSlot,
    weekend,
    ingredientsAlreadyNeeded: [
      ...new Set(
        weekItems.flatMap((item) => item.recipe.ingredients.map((line) => line.ingredient.name)),
      ),
    ],
    alreadyPlannedRecipeIds: [...new Set(weekItems.map((item) => item.recipeId))],
  };

  const candidates = corpus.map(toCandidate);
  const { suggestions, relaxed } = rankSuggestions(candidates, signals, context, query.limit);

  return {
    context: {
      date: toDateString(targetDate),
      mealType: query.mealType,
      weekend,
      weekStart: toDateString(weekStart),
    },
    suggestions,
    basis: {
      corpusSize: candidates.length,
      favorites: signals.favoriteRecipeIds.length,
      plannedHistory: signals.planned.length,
      ingredientsAlreadyNeeded: context.ingredientsAlreadyNeeded.length,
      allergiesExcluded: signals.allergies.length,
      hasDeclaredPreferences: signals.diets.length > 0 || signals.cuisines.length > 0,
      relaxed,
    },
  };
}
