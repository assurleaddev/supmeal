import { Router, Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { CookbookRole } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireCookbookRole } from '../middleware/permissions';
import { uploadRecipeImage } from '../middleware/upload';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';
import {
  optionalPositiveInt,
  optionalPositiveNumber,
  optionalString,
  optionalUrl,
} from '../utils/validation';

const router = Router();

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

const recipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: optionalString(2000),
  prepTime: optionalPositiveInt,
  cookTime: optionalPositiveInt,
  portions: z.number().int().min(1).max(1000).default(4),
  sourceUrl: optionalUrl,
  cookbookId: optionalString(100),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  tags: z.array(z.string()).optional().default([]),
});

// ─────────────────────────────────────────
// Helper: build recipe include clause
// ─────────────────────────────────────────
const recipeInclude = {
  createdBy: { select: { id: true, username: true, avatar: true } },
  cookbook: { select: { id: true, name: true } },
  ingredients: {
    include: { ingredient: true },
    orderBy: { orderIndex: 'asc' as const },
  },
  steps: { orderBy: { orderIndex: 'asc' as const } },
  tags: { include: { tag: true } },
  _count: { select: { favorites: true, comments: true } },
};

// ─────────────────────────────────────────
// GET /api/recipes — search & filter
// ─────────────────────────────────────────
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      q,
      cookbookId,
      tags,
      ingredients: ingredientFilter,
      maxPrepTime,
      maxCookTime,
      favorites: favoritesOnly,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Les critères sont accumulés dans un AND plutôt qu'assignés sur un objet partagé : le filtre
    // d'accès ci-dessous ne doit JAMAIS pouvoir être écrasé par un filtre ultérieur, sans quoi la
    // requête exposerait les recettes des autres utilisateurs.
    const filters: any[] = [
      {
        OR: [
          { createdById: req.user.id },
          {
            cookbookId: { not: null },
            cookbook: {
              members: { some: { userId: req.user.id } },
            },
          },
        ],
      },
    ];

    if (cookbookId) filters.push({ cookbookId: cookbookId as string });

    if (q) {
      const searchTerm = q as string;
      // Recherche sur titre, description, étapes (le « contenu » au sens du §2.2.2),
      // ingrédients et tags.
      filters.push({
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { steps: { some: { description: { contains: searchTerm, mode: 'insensitive' } } } },
          { ingredients: { some: { ingredient: { name: { contains: searchTerm, mode: 'insensitive' } } } } },
          { tags: { some: { tag: { name: { contains: searchTerm, mode: 'insensitive' } } } } },
        ],
      });
    }

    if (tags) {
      const tagList = (tags as string).split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        filters.push({ tags: { some: { tag: { name: { in: tagList } } } } });
      }
    }

    if (ingredientFilter) {
      const ingList = (ingredientFilter as string).split(',').map((i) => i.trim()).filter(Boolean);
      if (ingList.length > 0) {
        // `mode: insensitive` est sans effet sur un filtre `in` : on développe donc la liste en
        // un OR de `contains`, ce qui rend aussi le filtre tolérant aux saisies partielles.
        filters.push({
          OR: ingList.map((name) => ({
            ingredients: {
              some: { ingredient: { name: { contains: name, mode: 'insensitive' as const } } },
            },
          })),
        });
      }
    }

    if (maxPrepTime) filters.push({ prepTime: { lte: Number(maxPrepTime) } });
    if (maxCookTime) filters.push({ cookTime: { lte: Number(maxCookTime) } });

    if (favoritesOnly === 'true') {
      filters.push({ favorites: { some: { userId: req.user.id } } });
    }

    const where = { AND: filters };

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        include: {
          ...recipeInclude,
          favorites: {
            where: { userId: req.user.id },
            select: { userId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.recipe.count({ where }),
    ]);

    const enriched = recipes.map((r) => ({
      ...r,
      isFavorite: r.favorites.length > 0,
      favorites: undefined,
    }));

    res.json({
      success: true,
      data: {
        items: enriched,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/recipes
// ─────────────────────────────────────────
router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = recipeSchema.parse(req.body);

    // If adding to a cookbook, verify membership with at least EDITOR role
    if (body.cookbookId) {
      const member = await prisma.cookbookMember.findUnique({
        where: { cookbookId_userId: { cookbookId: body.cookbookId, userId: req.user.id } },
      });
      if (!member || ['READER', 'COMMENTER'].includes(member.role)) {
        throw new AppError('Insufficient permissions to add recipes to this cookbook', 403);
      }
    }

    // Upsert ingredients
    const ingredientUpserts = await Promise.all(
      body.ingredients.map((ing) =>
        prisma.ingredient.upsert({
          where: { name: ing.name.toLowerCase().trim() },
          update: {},
          create: { name: ing.name.toLowerCase().trim() },
        }),
      ),
    );

    // Upsert tags
    const tagUpserts = await Promise.all(
      body.tags.map((tagName) =>
        prisma.tag.upsert({
          where: { name: tagName.toLowerCase().trim() },
          update: {},
          create: { name: tagName.toLowerCase().trim() },
        }),
      ),
    );

    const recipe = await prisma.recipe.create({
      data: {
        title: body.title,
        description: body.description,
        prepTime: body.prepTime,
        cookTime: body.cookTime,
        portions: body.portions,
        sourceUrl: body.sourceUrl,
        // Règle métier : une recette est personnelle si et seulement si elle n'est rattachée à
        // aucun cookbook. Dérivée ici et jamais reçue du client, pour rester la seule source de vérité.
        isPersonal: !body.cookbookId,
        createdById: req.user.id,
        cookbookId: body.cookbookId,
        ingredients: {
          create: body.ingredients.map((ing, i) => ({
            ingredientId: ingredientUpserts[i].id,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
            orderIndex: ing.orderIndex,
          })),
        },
        steps: {
          create: body.steps.map((step) => ({
            orderIndex: step.orderIndex,
            description: step.description,
            duration: step.duration,
          })),
        },
        tags: {
          create: tagUpserts.map((tag) => ({ tagId: tag.id })),
        },
      },
      include: recipeInclude,
    });

    res.status(201).json({ success: true, data: recipe });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400, err.flatten().fieldErrors as any));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// GET /api/recipes/:id
// ─────────────────────────────────────────
router.get('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id },
      include: {
        ...recipeInclude,
        favorites: { where: { userId: req.user.id }, select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!recipe) throw new AppError('Recipe not found', 404);

    // Access check: personal recipe must be own, cookbook recipe must be a member
    if (recipe.isPersonal && recipe.createdById !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    if (recipe.cookbookId) {
      const member = await prisma.cookbookMember.findUnique({
        where: { cookbookId_userId: { cookbookId: recipe.cookbookId, userId: req.user.id } },
      });
      if (!member) throw new AppError('Access denied', 403);
    }

    res.json({
      success: true,
      data: { ...recipe, isFavorite: recipe.favorites.length > 0, favorites: undefined },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// PUT /api/recipes/:id — full update
// ─────────────────────────────────────────
router.put('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = recipeSchema.partial().parse(req.body);

    const existing = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Recipe not found', 404);

    // Permission check
    if (existing.createdById !== req.user.id) {
      if (existing.cookbookId) {
        const member = await prisma.cookbookMember.findUnique({
          where: { cookbookId_userId: { cookbookId: existing.cookbookId, userId: req.user.id } },
        });
        if (!member || ['READER', 'COMMENTER'].includes(member.role)) {
          throw new AppError('Insufficient permissions', 403);
        }
      } else {
        throw new AppError('Access denied', 403);
      }
    }

    // Re-create ingredients and steps
    const updates: any = {
      title: body.title,
      description: body.description,
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      portions: body.portions,
      sourceUrl: body.sourceUrl,
    };

    if (body.ingredients) {
      const ingredientUpserts = await Promise.all(
        body.ingredients.map((ing) =>
          prisma.ingredient.upsert({
            where: { name: ing.name!.toLowerCase().trim() },
            update: {},
            create: { name: ing.name!.toLowerCase().trim() },
          }),
        ),
      );
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: req.params.id } });
      updates.ingredients = {
        create: body.ingredients.map((ing, i) => ({
          ingredientId: ingredientUpserts[i].id,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
          orderIndex: ing.orderIndex ?? i,
        })),
      };
    }

    if (body.steps) {
      await prisma.recipeStep.deleteMany({ where: { recipeId: req.params.id } });
      updates.steps = {
        create: body.steps.map((step) => ({
          orderIndex: step.orderIndex!,
          description: step.description!,
          duration: step.duration,
        })),
      };
    }

    if (body.tags) {
      const tagUpserts = await Promise.all(
        body.tags.map((name) =>
          prisma.tag.upsert({
            where: { name: name.toLowerCase().trim() },
            update: {},
            create: { name: name.toLowerCase().trim() },
          }),
        ),
      );
      await prisma.recipeTag.deleteMany({ where: { recipeId: req.params.id } });
      updates.tags = { create: tagUpserts.map((t) => ({ tagId: t.id })) };
    }

    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: updates,
      include: recipeInclude,
    });

    res.json({ success: true, data: recipe });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// POST /api/recipes/:id/image
// ─────────────────────────────────────────
router.post(
  '/:id/image',
  requireAuth as any,
  (req: Request, res: Response, next: NextFunction) => uploadRecipeImage(req, res, next),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No image uploaded', 400);

      const existing = await prisma.recipe.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new AppError('Recipe not found', 404);
      if (existing.createdById !== req.user.id) throw new AppError('Access denied', 403);

      const imageUrl = `/uploads/recipes/${req.file.filename}`;
      const recipe = await prisma.recipe.update({
        where: { id: req.params.id },
        data: { imageUrl },
        select: { id: true, imageUrl: true },
      });

      res.json({ success: true, data: recipe });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// DELETE /api/recipes/:id
// ─────────────────────────────────────────
router.delete('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!recipe) throw new AppError('Recipe not found', 404);

    if (recipe.createdById !== req.user.id) {
      if (recipe.cookbookId) {
        const member = await prisma.cookbookMember.findUnique({
          where: { cookbookId_userId: { cookbookId: recipe.cookbookId, userId: req.user.id } },
        });
        if (!member || member.role === 'READER' || member.role === 'COMMENTER') {
          throw new AppError('Insufficient permissions', 403);
        }
      } else {
        throw new AppError('Access denied', 403);
      }
    }

    await prisma.recipe.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Recipe deleted' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/recipes/:id/favorite
// ─────────────────────────────────────────
router.post('/:id/favorite', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.favorite.upsert({
      where: { userId_recipeId: { userId: req.user.id, recipeId: req.params.id } },
      update: {},
      create: { userId: req.user.id, recipeId: req.params.id },
    });
    res.json({ success: true, data: { isFavorite: true } });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// DELETE /api/recipes/:id/favorite
// ─────────────────────────────────────────
router.delete('/:id/favorite', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user.id, recipeId: req.params.id },
    });
    res.json({ success: true, data: { isFavorite: false } });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// GET /api/recipes/:id/comments
// ─────────────────────────────────────────
router.get('/:id/comments', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { recipeId: req.params.id },
      include: { user: { select: { id: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: comments });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/recipes/:id/comments
// ─────────────────────────────────────────
router.post('/:id/comments', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { content } = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);

    const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!recipe) throw new AppError('Recipe not found', 404);

    if (recipe.cookbookId) {
      const member = await prisma.cookbookMember.findUnique({
        where: { cookbookId_userId: { cookbookId: recipe.cookbookId, userId: req.user.id } },
      });
      if (!member) throw new AppError('Not a member', 403);
      if (member.role === 'READER') throw new AppError('Insufficient permissions to comment', 403);
    }

    const comment = await prisma.comment.create({
      data: { recipeId: req.params.id, userId: req.user.id, content },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });

    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// DELETE /api/recipes/:recipeId/comments/:commentId
// ─────────────────────────────────────────
router.delete('/:recipeId/comments/:commentId', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.userId !== req.user.id) throw new AppError('Access denied', 403);

    await prisma.comment.delete({ where: { id: req.params.commentId } });
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
