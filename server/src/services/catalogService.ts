import { TagType } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { canonicalName } from '../utils/text';

/**
 * Catalogues partagés entre toutes les recettes : tags et ingrédients. Ils ne sont rattachés à
 * aucun utilisateur, d'où un service distinct de celui des recettes.
 */

export const tagQuerySchema = z.object({
  type: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.nativeEnum(TagType))
    .optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.nativeEnum(TagType).default(TagType.CUSTOM),
});

export const ingredientQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function listTags(type?: TagType) {
  return prisma.tag.findMany({
    where: type ? { type } : undefined,
    orderBy: { name: 'asc' },
  });
}

export function createTag(input: z.infer<typeof createTagSchema>) {
  const name = canonicalName(input.name);

  return prisma.tag.upsert({
    where: { name },
    update: {},
    create: { name, type: input.type },
  });
}

/** Suggestion d'ingrédients pour l'autocomplétion du formulaire et du filtre. */
export function searchIngredients(query: z.infer<typeof ingredientQuerySchema>) {
  return prisma.ingredient.findMany({
    where: query.q ? { name: { contains: query.q, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    take: query.limit,
  });
}
