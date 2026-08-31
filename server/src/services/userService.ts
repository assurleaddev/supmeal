import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { resolveWeek } from '../utils/week';
import { visibleRecipeFilter } from './recipeService';

/**
 * Logique métier du compte utilisateur : profil, mot de passe, préférences culinaires, comptes
 * OAuth liés et compteurs du tableau de bord.
 */

/** Coût bcrypt. Partagé avec l'inscription pour que tous les condensats aient la même force. */
export const PASSWORD_COST = 12;

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar: z.string().url().optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const preferencesSchema = z.object({
  diet: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  defaultPortions: z.number().int().min(1).max(100).optional(),
});

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      createdAt: true,
      preferences: true,
      oauthAccounts: { select: { provider: true, id: true } },
    },
  });

  if (!user) throw new AppError('User not found', 404);
  return user;
}

/**
 * Compteurs du tableau de bord.
 *
 * Comptés en base plutôt que dérivés de listes paginées côté client, qui donnaient des totaux
 * tronqués à la taille de page.
 */
export async function getStats(userId: string) {
  const { weekStart, weekEnd } = resolveWeek();

  const [recipes, cookbooks, favorites, plannedThisWeek] = await Promise.all([
    prisma.recipe.count({ where: visibleRecipeFilter(userId) }),
    prisma.cookbookMember.count({ where: { userId } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.mealPlanItem.count({
      where: { mealPlan: { userId }, date: { gte: weekStart, lte: weekEnd } },
    }),
  ]);

  return { recipes, cookbooks, favorites, plannedThisWeek };
}

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  if (input.username) {
    const taken = await prisma.user.findFirst({
      where: { username: input.username, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw new AppError('Username already taken', 409);
  }

  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: { id: true, email: true, username: true, avatar: true, updatedAt: true },
  });
}

export async function changePassword(
  userId: string,
  input: z.infer<typeof changePasswordSchema>,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    throw new AppError('No password set — use OAuth to sign in', 400);
  }

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new AppError('Current password is incorrect', 400);

  const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_COST);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export function updatePreferences(userId: string, input: z.infer<typeof preferencesSchema>) {
  return prisma.userPreferences.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
}

/**
 * Le dernier moyen de connexion ne peut pas être retiré : un compte sans mot de passe ni compte
 * OAuth lié deviendrait définitivement inaccessible.
 */
export async function unlinkOAuth(userId: string, provider: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, _count: { select: { oauthAccounts: true } } },
  });

  if (!user) throw new AppError('User not found', 404);

  if (!user.passwordHash && user._count.oauthAccounts <= 1) {
    throw new AppError('Cannot remove last login method without setting a password first', 400);
  }

  const { count } = await prisma.oAuthAccount.deleteMany({ where: { userId, provider } });
  if (count === 0) throw new AppError('No linked account for this provider', 404);
}
