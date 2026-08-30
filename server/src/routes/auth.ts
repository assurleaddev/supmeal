import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import passport from '../config/passport';
import prisma from '../config/database';
import { generateTokens } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { RefreshTokenPayload } from '../types';
import { env } from '../config/env';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    const [emailExists, usernameExists] = await Promise.all([
      prisma.user.findUnique({ where: { email: body.email } }),
      prisma.user.findUnique({ where: { username: body.username } }),
    ]);

    if (emailExists) throw new AppError('Email already in use', 409);
    if (usernameExists) throw new AppError('Username already taken', 409);

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        passwordHash,
        preferences: { create: {} },
      },
      select: { id: true, email: true, username: true, avatar: true, createdAt: true },
    });

    const tokens = generateTokens(user);
    res.status(201).json({ success: true, data: { user, ...tokens } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400, err.flatten().fieldErrors as any));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, username: true, avatar: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid credentials', 401);
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) throw new AppError('Invalid credentials', 401);

    const { passwordHash: _, ...safeUser } = user;
    const tokens = generateTokens(safeUser);
    res.json({ success: true, data: { user: safeUser, ...tokens } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('Validation error', 400));
    } else {
      next(err);
    }
  }
});

// ─────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400);

    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true },
    });

    if (!user) throw new AppError('User not found', 401);

    const tokens = generateTokens(user);
    res.json({ success: true, data: tokens });
  } catch {
    next(new AppError('Invalid or expired refresh token', 401));
  }
});

// ─────────────────────────────────────────
// OAuth2 Routes — Google
// ─────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  oauthCallback,
);

// ─────────────────────────────────────────
// OAuth2 Routes — GitHub
// ─────────────────────────────────────────
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login?error=oauth' }),
  oauthCallback,
);

// ─────────────────────────────────────────
// OAuth2 Routes — Microsoft
// ─────────────────────────────────────────
router.get('/microsoft', passport.authenticate('microsoft', { session: false } as any));

router.get(
  '/microsoft/callback',
  passport.authenticate('microsoft', { session: false, failureRedirect: '/login?error=oauth' } as any),
  oauthCallback,
);

function oauthCallback(req: Request, res: Response) {
  const user = req.user as any;
  const tokens = generateTokens({ id: user.id, email: user.email, username: user.username });
  const clientUrl = env.CLIENT_URL;
  res.redirect(
    `${clientUrl}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
  );
}

export default router;
