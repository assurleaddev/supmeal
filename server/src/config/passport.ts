import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import prisma from './database';
import { env } from './env';

const CALLBACK_BASE = env.OAUTH_CALLBACK_BASE;

// ─────────────────────────────────────────
// Google OAuth2
// ─────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${CALLBACK_BASE}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google'), undefined);

          const user = await upsertOAuthUser({
            provider: 'google',
            providerId: profile.id,
            email,
            username: email.split('@')[0],
            avatar: profile.photos?.[0]?.value,
            accessToken: _accessToken,
            refreshToken: _refreshToken ?? undefined,
          });

          return done(null, user);
        } catch (err) {
          return done(err as Error, undefined);
        }
      },
    ),
  );
}

// ─────────────────────────────────────────
// GitHub OAuth2
// ─────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${CALLBACK_BASE}/api/auth/github/callback`,
        scope: ['user:email'],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email =
            profile.emails?.find((e: any) => e.primary)?.value || profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from GitHub'), undefined);

          const user = await upsertOAuthUser({
            provider: 'github',
            providerId: String(profile.id),
            email,
            username: profile.username || email.split('@')[0],
            avatar: profile.photos?.[0]?.value,
            accessToken: _accessToken,
            refreshToken: _refreshToken,
          });

          return done(null, user);
        } catch (err) {
          return done(err as Error, undefined);
        }
      },
    ),
  );
}

// ─────────────────────────────────────────
// Microsoft OAuth2
// ─────────────────────────────────────────
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${CALLBACK_BASE}/api/auth/microsoft/callback`,
        scope: ['user.read'],
      } as any,
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value || profile._json?.mail;
          if (!email) return done(new Error('No email from Microsoft'), undefined);

          const user = await upsertOAuthUser({
            provider: 'microsoft',
            providerId: profile.id,
            email,
            username: profile.displayName?.replace(/\s+/g, '_').toLowerCase() || email.split('@')[0],
            avatar: undefined,
            accessToken: _accessToken,
            refreshToken: _refreshToken,
          });

          return done(null, user);
        } catch (err) {
          return done(err as Error, undefined);
        }
      },
    ),
  );
}

// ─────────────────────────────────────────
// Shared upsert logic
// ─────────────────────────────────────────
async function upsertOAuthUser(data: {
  provider: string;
  providerId: string;
  email: string;
  username: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  // Check for existing OAuth account
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider: data.provider, providerId: data.providerId } },
    include: { user: true },
  });

  if (existing) {
    // Update tokens and return user
    await prisma.oAuthAccount.update({
      where: { id: existing.id },
      data: { accessToken: data.accessToken, refreshToken: data.refreshToken },
    });
    return existing.user;
  }

  // Check if a user with this email already exists
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

  if (existingUser) {
    // Link OAuth account to existing user
    await prisma.oAuthAccount.create({
      data: {
        userId: existingUser.id,
        provider: data.provider,
        providerId: data.providerId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    });
    return existingUser;
  }

  // Generate a unique username
  let username = data.username.slice(0, 20).replace(/[^a-zA-Z0-9_]/g, '_');
  const usernameExists = await prisma.user.findUnique({ where: { username } });
  if (usernameExists) {
    username = `${username}_${Date.now().toString().slice(-4)}`;
  }

  // Create new user with OAuth account
  const user = await prisma.user.create({
    data: {
      email: data.email,
      username,
      avatar: data.avatar,
      oauthAccounts: {
        create: {
          provider: data.provider,
          providerId: data.providerId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      },
    },
  });

  return user;
}

export default passport;
