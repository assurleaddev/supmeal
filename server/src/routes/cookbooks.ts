import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CookbookRole } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireCookbookRole } from '../middleware/permissions';
import { uploadRecipeImage } from '../middleware/upload';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─────────────────────────────────────────
// GET /api/cookbooks  — list user's cookbooks
// ─────────────────────────────────────────
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.cookbookMember.findMany({
      where: { userId: req.user.id },
      include: {
        cookbook: {
          include: {
            createdBy: { select: { id: true, username: true, avatar: true } },
            _count: { select: { recipes: true, members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const cookbooks = memberships.map((m) => ({
      ...m.cookbook,
      myRole: m.role,
    }));

    res.json({ success: true, data: cookbooks });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/cookbooks — create cookbook
// ─────────────────────────────────────────
const createCookbookSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = createCookbookSchema.parse(req.body);

    const cookbook = await prisma.cookbook.create({
      data: {
        ...body,
        createdById: req.user.id,
        members: {
          create: { userId: req.user.id, role: CookbookRole.CREATOR },
        },
      },
      include: {
        createdBy: { select: { id: true, username: true, avatar: true } },
        _count: { select: { recipes: true, members: true } },
      },
    });

    res.status(201).json({ success: true, data: { ...cookbook, myRole: CookbookRole.CREATOR } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// GET /api/cookbooks/:id
// ─────────────────────────────────────────
router.get(
  '/:id',
  requireAuth as any,
  requireCookbookRole(CookbookRole.READER) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const cookbook = await prisma.cookbook.findUnique({
        where: { id: req.params.id },
        include: {
          createdBy: { select: { id: true, username: true, avatar: true } },
          members: {
            include: { user: { select: { id: true, username: true, avatar: true, email: true } } },
          },
          _count: { select: { recipes: true } },
        },
      });

      if (!cookbook) throw new AppError('Cookbook not found', 404);

      res.json({ success: true, data: { ...cookbook, myRole: (req as any).cookbookRole } });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// PATCH /api/cookbooks/:id
// ─────────────────────────────────────────
const updateCookbookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

router.patch(
  '/:id',
  requireAuth as any,
  requireCookbookRole(CookbookRole.EDITOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = updateCookbookSchema.parse(req.body);
      const cookbook = await prisma.cookbook.update({
        where: { id: req.params.id },
        data: body,
        include: { createdBy: { select: { id: true, username: true } } },
      });
      res.json({ success: true, data: cookbook });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// POST /api/cookbooks/:id/cover — upload cover image
// ─────────────────────────────────────────
router.post(
  '/:id/cover',
  requireAuth as any,
  requireCookbookRole(CookbookRole.EDITOR) as any,
  (req, res, next) => uploadRecipeImage(req, res, next),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No image uploaded', 400);
      const imageUrl = `/uploads/recipes/${req.file.filename}`;
      const cookbook = await prisma.cookbook.update({
        where: { id: req.params.id },
        data: { coverImage: imageUrl },
      });
      res.json({ success: true, data: { coverImage: cookbook.coverImage } });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// DELETE /api/cookbooks/:id
// ─────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth as any,
  requireCookbookRole(CookbookRole.CREATOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await prisma.cookbook.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: 'Cookbook deleted' });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// POST /api/cookbooks/:id/invite
// ─────────────────────────────────────────
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['EDITOR', 'COMMENTER', 'READER']).default('READER'),
});

router.post(
  '/:id/invite',
  requireAuth as any,
  requireCookbookRole(CookbookRole.EDITOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = inviteSchema.parse(req.body);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await prisma.cookbookInvite.create({
        data: {
          cookbookId: req.params.id,
          email: body.email,
          role: body.role as CookbookRole,
          invitedById: req.user.id,
          expiresAt,
        },
      });

      res.status(201).json({
        success: true,
        data: { token: invite.token, email: invite.email, expiresAt: invite.expiresAt },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// POST /api/cookbooks/join/:token
// ─────────────────────────────────────────
router.post('/join/:token', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invite = await prisma.cookbookInvite.findUnique({
      where: { token: req.params.token },
      include: { cookbook: { select: { id: true, name: true } } },
    });

    if (!invite) throw new AppError('Invite not found', 404);
    if (invite.usedAt) throw new AppError('Invite already used', 400);
    if (invite.expiresAt < new Date()) throw new AppError('Invite expired', 400);

    // Check if already a member
    const existing = await prisma.cookbookMember.findUnique({
      where: { cookbookId_userId: { cookbookId: invite.cookbookId, userId: req.user.id } },
    });
    if (existing) throw new AppError('Already a member of this cookbook', 409);

    await prisma.$transaction([
      prisma.cookbookMember.create({
        data: { cookbookId: invite.cookbookId, userId: req.user.id, role: invite.role },
      }),
      prisma.cookbookInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({
      success: true,
      data: { cookbookId: invite.cookbookId, cookbookName: invite.cookbook.name, role: invite.role },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// PATCH /api/cookbooks/:id/members/:userId — update role
// ─────────────────────────────────────────
router.patch(
  '/:id/members/:userId',
  requireAuth as any,
  requireCookbookRole(CookbookRole.CREATOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { role } = z.object({ role: z.enum(['EDITOR', 'COMMENTER', 'READER']) }).parse(req.body);

      if (req.params.userId === req.user.id) {
        throw new AppError('Cannot change your own role', 400);
      }

      const member = await prisma.cookbookMember.update({
        where: { cookbookId_userId: { cookbookId: req.params.id, userId: req.params.userId } },
        data: { role: role as CookbookRole },
        include: { user: { select: { id: true, username: true } } },
      });

      res.json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// DELETE /api/cookbooks/:id/members/:userId — remove member
// ─────────────────────────────────────────
router.delete(
  '/:id/members/:userId',
  requireAuth as any,
  requireCookbookRole(CookbookRole.CREATOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.params.userId === req.user.id) {
        throw new AppError('Use the leave endpoint to leave a cookbook', 400);
      }
      await prisma.cookbookMember.delete({
        where: { cookbookId_userId: { cookbookId: req.params.id, userId: req.params.userId } },
      });
      res.json({ success: true, message: 'Member removed' });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────
// DELETE /api/cookbooks/:id/leave
// ─────────────────────────────────────────
router.delete('/:id/leave', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.cookbookMember.findUnique({
      where: { cookbookId_userId: { cookbookId: req.params.id, userId: req.user.id } },
    });

    if (!member) throw new AppError('Not a member', 404);
    if (member.role === CookbookRole.CREATOR) {
      throw new AppError('Creator cannot leave — transfer ownership or delete the cookbook', 400);
    }

    await prisma.cookbookMember.delete({
      where: { cookbookId_userId: { cookbookId: req.params.id, userId: req.user.id } },
    });

    res.json({ success: true, message: 'Left cookbook' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// GET /api/cookbooks/:cookbookId/messages
// ─────────────────────────────────────────
router.get(
  '/:cookbookId/messages',
  requireAuth as any,
  requireCookbookRole(CookbookRole.READER) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const before = req.query.before as string | undefined;

      const messages = await prisma.message.findMany({
        where: {
          cookbookId: req.params.cookbookId,
          ...(before && { createdAt: { lt: new Date(before) } }),
        },
        include: { user: { select: { id: true, username: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({ success: true, data: messages.reverse() });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
