import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';

const router = Router();

// GET /api/tags — list all tags (optionally by type)
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query;
    const tags = await prisma.tag.findMany({
      where: type ? { type: (type as string).toUpperCase() as any } : undefined,
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
});

// POST /api/tags — create a tag
router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(50),
      type: z.enum(['CATEGORY', 'DIET', 'DIFFICULTY', 'CUISINE', 'CUSTOM']).default('CUSTOM'),
    }).parse(req.body);

    const tag = await prisma.tag.upsert({
      where: { name: body.name.toLowerCase().trim() },
      update: {},
      create: { name: body.name.toLowerCase().trim(), type: body.type },
    });

    res.status(201).json({ success: true, data: tag });
  } catch (err) {
    next(err);
  }
});

// GET /api/tags/ingredients — search ingredients
router.get('/ingredients', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const ingredients = await prisma.ingredient.findMany({
      where: q ? { name: { contains: q.toLowerCase(), mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      take: 20,
    });
    res.json({ success: true, data: ingredients });
  } catch (err) {
    next(err);
  }
});

export default router;
