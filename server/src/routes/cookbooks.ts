import { Router, Response, NextFunction } from 'express';
import { CookbookRole } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireCookbookRole } from '../middleware/permissions';
import { uploadRecipeImage } from '../middleware/upload';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';
import * as cookbookService from '../services/cookbookService';

/**
 * Adaptateur HTTP des cookbooks. L'autorisation est portée par `requireCookbookRole`, les règles
 * métier par services/cookbookService.ts ; ce fichier ne fait que router.
 */
const router = Router();

/** Rôle de l'appelant, renseigné par `requireCookbookRole`. */
const roleOf = (req: AuthenticatedRequest) => (req as any).cookbookRole as CookbookRole;

// GET /api/cookbooks
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await cookbookService.listCookbooks(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/cookbooks
router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = cookbookService.createCookbookSchema.parse(req.body);
    const data = await cookbookService.createCookbook(req.user.id, input);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/cookbooks/:id
router.get(
  '/:id',
  requireAuth as any,
  requireCookbookRole(CookbookRole.READER) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await cookbookService.getCookbook(req.params.id, roleOf(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/cookbooks/:id
router.patch(
  '/:id',
  requireAuth as any,
  requireCookbookRole(CookbookRole.EDITOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = cookbookService.updateCookbookSchema.parse(req.body);
      const data = await cookbookService.updateCookbook(req.params.id, input);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/cookbooks/:id/cover
router.post(
  '/:id/cover',
  requireAuth as any,
  requireCookbookRole(CookbookRole.EDITOR) as any,
  (req, res, next) => uploadRecipeImage(req, res, next),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No image uploaded', 400);
      const data = await cookbookService.setCoverImage(req.params.id, req.file.filename);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/cookbooks/:id
router.delete(
  '/:id',
  requireAuth as any,
  requireCookbookRole(CookbookRole.CREATOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await cookbookService.deleteCookbook(req.params.id);
      res.json({ success: true, message: 'Cookbook deleted' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/cookbooks/:id/invite — gérer les membres est réservé au créateur (canManageMembers)
router.post(
  '/:id/invite',
  requireAuth as any,
  requireCookbookRole(CookbookRole.CREATOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = cookbookService.inviteSchema.parse(req.body);
      const data = await cookbookService.createInvite(req.params.id, req.user.id, input);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/cookbooks/join/:token
router.post('/join/:token', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await cookbookService.acceptInvite(req.params.token, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cookbooks/:id/members/:userId
router.patch(
  '/:id/members/:userId',
  requireAuth as any,
  requireCookbookRole(CookbookRole.CREATOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { role } = cookbookService.memberRoleSchema.parse(req.body);
      const data = await cookbookService.updateMemberRole(
        req.params.id,
        req.params.userId,
        req.user.id,
        role,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/cookbooks/:id/members/:userId
router.delete(
  '/:id/members/:userId',
  requireAuth as any,
  requireCookbookRole(CookbookRole.CREATOR) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await cookbookService.removeMember(req.params.id, req.params.userId, req.user.id);
      res.json({ success: true, message: 'Member removed' });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/cookbooks/:id/leave
router.delete('/:id/leave', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await cookbookService.leaveCookbook(req.params.id, req.user.id);
    res.json({ success: true, message: 'Left cookbook' });
  } catch (err) {
    next(err);
  }
});

// GET /api/cookbooks/:cookbookId/messages
router.get(
  '/:cookbookId/messages',
  requireAuth as any,
  requireCookbookRole(CookbookRole.READER) as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = cookbookService.messageQuerySchema.parse(req.query);
      const data = await cookbookService.listMessages(req.params.cookbookId, query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
