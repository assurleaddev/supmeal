import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { generateTokens } from '../middleware/auth';
import { RefreshTokenPayload } from '../types';
import { env } from '../config/env';
import { PASSWORD_COST } from './userService';

/** Logique métier de l'authentification locale et du rafraîchissement de jetons. */

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function register(input: z.infer<typeof registerSchema>) {
  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { username: input.username }, select: { id: true } }),
  ]);

  if (emailTaken) throw new AppError('Email already in use', 409);
  if (usernameTaken) throw new AppError('Username already taken', 409);

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_COST);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      preferences: { create: {} },
    },
    select: { id: true, email: true, username: true, avatar: true, createdAt: true },
  });

  return { user, ...generateTokens(user) };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, username: true, avatar: true, passwordHash: true },
  });

  // Message identique que le compte soit inconnu, sans mot de passe (OAuth seul) ou le mot de
  // passe incorrect : distinguer les cas révélerait quelles adresses sont enregistrées.
  if (!user?.passwordHash) throw new AppError('Invalid credentials', 401);

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401);

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { user: safeUser, ...generateTokens(safeUser) };
}

export async function refresh(refreshToken: string) {
  let payload: RefreshTokenPayload;

  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, username: true },
  });

  if (!user) throw new AppError('Invalid or expired refresh token', 401);

  return generateTokens(user);
}

/** Destination du navigateur après un aller-retour OAuth2 réussi. */
export function buildOAuthRedirect(user: { id: string; email: string; username: string }) {
  const tokens = generateTokens(user);
  const params = new URLSearchParams({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });

  return `${env.CLIENT_URL}/oauth/callback?${params.toString()}`;
}
