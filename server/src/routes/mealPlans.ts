import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MealType } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';

const router = Router();

const mealPlanSchema = z.object({
  name: z.string().max(100).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cookbookId: z.string().optional().nullable(),
});

const mealPlanItemSchema = z.object({
  recipeId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  portions: z.number().int().min(1).optional(),
});

// GET /api/meal-plans
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.mealPlan.findMany({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            recipe: { select: { id: true, title: true, imageUrl: true, prepTime: true, cookTime: true } },
          },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
        },
        cookbook: { select: { id: true, name: true } },
      },
      orderBy: { weekStart: 'desc' },
    });
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

// POST /api/meal-plans
router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = mealPlanSchema.parse(req.body);
    const plan = await prisma.mealPlan.create({
      data: {
        userId: req.user.id,
        name: body.name,
        weekStart: new Date(body.weekStart),
        cookbookId: body.cookbookId,
      },
      include: { items: true, cookbook: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// GET /api/meal-plans/:id
router.get('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.mealPlan.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            recipe: {
              select: {
                id: true, title: true, imageUrl: true,
                prepTime: true, cookTime: true, portions: true,
              },
            },
          },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
        },
        cookbook: { select: { id: true, name: true } },
      },
    });

    if (!plan) throw new AppError('Meal plan not found', 404);
    if (plan.userId !== req.user.id) throw new AppError('Access denied', 403);

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// POST /api/meal-plans/:id/items
router.post('/:id/items', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = mealPlanItemSchema.parse(req.body);

    const plan = await prisma.mealPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new AppError('Meal plan not found', 404);
    if (plan.userId !== req.user.id) throw new AppError('Access denied', 403);

    const item = await prisma.mealPlanItem.create({
      data: {
        mealPlanId: req.params.id,
        recipeId: body.recipeId,
        date: new Date(body.date),
        mealType: body.mealType as MealType,
        portions: body.portions,
      },
      include: {
        recipe: { select: { id: true, title: true, imageUrl: true } },
      },
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meal-plans/:id/items/:itemId
router.delete('/:id/items/:itemId', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.mealPlan.findUnique({ where: { id: req.params.id } });
    if (!plan || plan.userId !== req.user.id) throw new AppError('Access denied', 403);

    await prisma.mealPlanItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meal-plans/:id
router.delete('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.mealPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new AppError('Meal plan not found', 404);
    if (plan.userId !== req.user.id) throw new AppError('Access denied', 403);

    await prisma.mealPlan.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Meal plan deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/meal-plans/:id/shopping-list — generate shopping list
router.get('/:id/shopping-list', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.mealPlan.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            recipe: {
              include: {
                ingredients: {
                  include: { ingredient: true },
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!plan) throw new AppError('Meal plan not found', 404);
    if (plan.userId !== req.user.id) throw new AppError('Access denied', 403);

    // Aggregate ingredients across all meals
    const aggregated = new Map<string, { name: string; totalQuantity: number | null; unit: string | null; notes: string[] }>();

    for (const item of plan.items) {
      const scaleFactor = item.portions ? item.portions / item.recipe.portions : 1;
      for (const ri of item.recipe.ingredients) {
        const key = `${ri.ingredient.name}|${ri.unit || ''}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            name: ri.ingredient.name,
            totalQuantity: ri.quantity ? ri.quantity * scaleFactor : null,
            unit: ri.unit,
            notes: ri.notes ? [ri.notes] : [],
          });
        } else {
          const existing = aggregated.get(key)!;
          if (ri.quantity && existing.totalQuantity !== null) {
            existing.totalQuantity += ri.quantity * scaleFactor;
          }
          if (ri.notes) existing.notes.push(ri.notes);
        }
      }
    }

    const shoppingList = Array.from(aggregated.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    res.json({ success: true, data: shoppingList });
  } catch (err) {
    next(err);
  }
});

export default router;
