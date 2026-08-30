import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';
import { resolveWeek } from '../utils/week';

const router = Router();

// ─────────────────────────────────────────
// GET /api/users/me
// ─────────────────────────────────────────
router.get('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// GET /api/users/me/stats — compteurs du tableau de bord
// ─────────────────────────────────────────
// Ces compteurs étaient auparavant dérivés côté client à partir de trois listes paginées, ce qui
// donnait des totaux faux dès que la pagination tronquait les résultats. Ils sont comptés en base.
router.get('/me/stats', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const { weekStart, weekEnd } = resolveWeek();

    const [recipes, cookbooks, favorites, plannedThisWeek] = await Promise.all([
      prisma.recipe.count({
        where: {
          OR: [
            { createdById: userId },
            { cookbookId: { not: null }, cookbook: { members: { some: { userId } } } },
          ],
        },
      }),
      prisma.cookbookMember.count({ where: { userId } }),
      prisma.favorite.count({ where: { userId } }),
      prisma.mealPlanItem.count({
        where: {
          mealPlan: { userId },
          date: { gte: weekStart, lte: weekEnd },
        },
      }),
    ]);

    res.json({ success: true, data: { recipes, cookbooks, favorites, plannedThisWeek } });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// PATCH /api/users/me
// ─────────────────────────────────────────
const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar: z.string().url().optional().nullable(),
});

router.patch('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = updateProfileSchema.parse(req.body);

    if (body.username) {
      const exists = await prisma.user.findFirst({
        where: { username: body.username, NOT: { id: req.user.id } },
      });
      if (exists) throw new AppError('Username already taken', 409);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: body,
      select: { id: true, email: true, username: true, avatar: true, updatedAt: true },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// POST /api/users/me/change-password
// ─────────────────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

router.post('/me/change-password', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new AppError('No password set — use OAuth to sign in', 400);
    }

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) throw new AppError('Current password is incorrect', 400);

    const newHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: newHash } });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// PATCH /api/users/me/preferences
// ─────────────────────────────────────────
const prefsSchema = z.object({
  diet: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  defaultPortions: z.number().int().min(1).max(100).optional(),
});

router.patch('/me/preferences', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = prefsSchema.parse(req.body);

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user.id },
      update: body,
      create: { userId: req.user.id, ...body },
    });

    res.json({ success: true, data: prefs });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// DELETE /api/users/me/oauth/:provider
// ─────────────────────────────────────────
router.delete('/me/oauth/:provider', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true, _count: { select: { oauthAccounts: true } } },
    });

    if (!user?.passwordHash && (user?._count.oauthAccounts ?? 0) <= 1) {
      throw new AppError(
        'Cannot remove last login method without setting a password first',
        400,
      );
    }

    await prisma.oAuthAccount.deleteMany({
      where: { userId: req.user.id, provider: req.params.provider },
    });

    res.json({ success: true, message: 'OAuth account unlinked' });
  } catch (err) {
    next(err);
  }
});

export default router;
