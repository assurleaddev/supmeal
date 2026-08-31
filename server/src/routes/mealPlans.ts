import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import * as mealPlanService from '../services/mealPlanService';

/**
 * Adaptateur HTTP de la planification. Les règles métier — appartenance des plannings, bornes de
 * semaine, agrégation de la liste de courses — vivent dans services/mealPlanService.ts.
 */
const router = Router();

// GET /api/meal-plans
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await mealPlanService.listPlans(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/meal-plans/week?offset=0
// Déclarée avant '/:id', sinon Express ferait correspondre « week » à un identifiant de planning.
router.get('/week', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { offset } = mealPlanService.weekQuerySchema.parse(req.query);
    const data = await mealPlanService.getWeek(req.user.id, offset);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/meal-plans
router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = mealPlanService.mealPlanSchema.parse(req.body);
    const data = await mealPlanService.createPlan(req.user.id, input);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/meal-plans/:id
router.get('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await mealPlanService.getPlan(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meal-plans/:id
router.delete('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await mealPlanService.deletePlan(req.params.id, req.user.id);
    res.json({ success: true, message: 'Meal plan deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/meal-plans/:id/items
router.post('/:id/items', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = mealPlanService.mealPlanItemSchema.parse(req.body);
    const data = await mealPlanService.addItem(req.params.id, req.user.id, input);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meal-plans/:id/items/:itemId
router.delete('/:id/items/:itemId', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await mealPlanService.removeItem(req.params.id, req.params.itemId, req.user.id);
    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    next(err);
  }
});

// GET /api/meal-plans/:id/shopping-list
router.get('/:id/shopping-list', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await mealPlanService.getShoppingList(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
