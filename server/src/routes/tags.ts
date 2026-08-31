import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import * as catalogService from '../services/catalogService';

/** Adaptateur HTTP des catalogues partagés — voir services/catalogService.ts. */
const router = Router();

// GET /api/tags/ingredients — déclarée avant les routes plus générales
router.get('/ingredients', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const query = catalogService.ingredientQuerySchema.parse(req.query);
    const data = await catalogService.searchIngredients(query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/tags
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = catalogService.tagQuerySchema.parse(req.query);
    const data = await catalogService.listTags(type);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/tags
router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = catalogService.createTagSchema.parse(req.body);
    const data = await catalogService.createTag(input);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
