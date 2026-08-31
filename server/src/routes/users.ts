import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import * as userService from '../services/userService';

/** Adaptateur HTTP du compte utilisateur — voir services/userService.ts. */
const router = Router();

// GET /api/users/me
router.get('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await userService.getProfile(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/me/stats
router.get('/me/stats', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await userService.getStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/me
router.patch('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = userService.updateProfileSchema.parse(req.body);
    const data = await userService.updateProfile(req.user.id, input);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/me/change-password
router.post('/me/change-password', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = userService.changePasswordSchema.parse(req.body);
    await userService.changePassword(req.user.id, input);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/me/preferences
router.patch('/me/preferences', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = userService.preferencesSchema.parse(req.body);
    const data = await userService.updatePreferences(req.user.id, input);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/me/oauth/:provider
router.delete('/me/oauth/:provider', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await userService.unlinkOAuth(req.user.id, req.params.provider);
    res.json({ success: true, message: 'OAuth account unlinked' });
  } catch (err) {
    next(err);
  }
});

export default router;
