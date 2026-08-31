import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import * as authService from '../services/authService';

/**
 * Adaptateur HTTP de l'authentification. Les stratégies OAuth2 sont montées par Passport ; les
 * règles métier vivent dans services/authService.ts.
 */
const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = authService.registerSchema.parse(req.body);
    const data = await authService.register(input);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = authService.loginSchema.parse(req.body);
    const data = await authService.login(input);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = authService.refreshSchema.parse(req.body);
    const data = await authService.refresh(refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/** Point de retour commun aux trois fournisseurs OAuth2. */
function oauthCallback(req: Request, res: Response) {
  const user = req.user as { id: string; email: string; username: string };
  res.redirect(authService.buildOAuthRedirect(user));
}

// OAuth2 — Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  oauthCallback,
);

// OAuth2 — GitHub
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login?error=oauth' }),
  oauthCallback,
);

// OAuth2 — Microsoft
router.get('/microsoft', passport.authenticate('microsoft', { session: false } as any));
router.get(
  '/microsoft/callback',
  passport.authenticate('microsoft', { session: false, failureRedirect: '/login?error=oauth' } as any),
  oauthCallback,
);

export default router;
