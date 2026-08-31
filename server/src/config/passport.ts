import passport from 'passport';
import { Request } from 'express';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { User } from '@prisma/client';
import prisma from './database';
import { env } from './env';
import { readLinkState } from '../utils/oauthState';

/**
 * Stratégies OAuth2.
 *
 * Chaque fournisseur n'est monté que si sa paire identifiant/secret est configurée. La liste des
 * fournisseurs réellement disponibles est exposée pour que le client n'affiche que des boutons
 * fonctionnels et que les routes répondent 503 plutôt que de planter sur une stratégie inconnue.
 */

export const OAUTH_PROVIDERS = ['google', 'github', 'microsoft'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Profil normalisé, commun aux trois fournisseurs dont les formats diffèrent. */
interface NormalizedProfile {
  providerId: string;
  email?: string;
  username?: string;
  avatar?: string;
}

const configured = new Set<OAuthProvider>();

export const isProviderConfigured = (provider: string): provider is OAuthProvider =>
  configured.has(provider as OAuthProvider);

export const configuredProviders = (): OAuthProvider[] =>
  OAUTH_PROVIDERS.filter((provider) => configured.has(provider));

/**
 * Rattache l'identité du fournisseur à un compte.
 *
 * `linkUserId` est renseigné lorsque l'utilisateur est déjà connecté et ajoute un fournisseur
 * depuis ses paramètres (§2.2.5) : le compte courant est alors la cible, quelle que soit l'adresse
 * e-mail renvoyée par le fournisseur. Sans cet identifiant, on est dans un flux de connexion et
 * l'adresse e-mail sert de point de rapprochement.
 */
async function resolveUser(
  provider: OAuthProvider,
  profile: NormalizedProfile,
  tokens: { accessToken?: string; refreshToken?: string },
  linkUserId: string | null,
): Promise<User> {
  const { providerId, email } = profile;

  const existingLink = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });

  if (linkUserId) {
    if (existingLink && existingLink.userId !== linkUserId) {
      throw new Error('This account is already linked to another SUPMEAL user');
    }

    if (!existingLink) {
      await prisma.oAuthAccount.create({
        data: { userId: linkUserId, provider, providerId, ...tokens },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: linkUserId } });
    if (!user) throw new Error('User not found');
    return user;
  }

  if (existingLink) {
    await prisma.oAuthAccount.update({ where: { id: existingLink.id }, data: tokens });
    return existingLink.user;
  }

  if (!email) throw new Error(`No email returned by ${provider}`);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    await prisma.oAuthAccount.create({
      data: { userId: byEmail.id, provider, providerId, ...tokens },
    });
    return byEmail;
  }

  return prisma.user.create({
    data: {
      email,
      username: await uniqueUsername(profile.username ?? email.split('@')[0]),
      avatar: profile.avatar,
      preferences: { create: {} },
      oauthAccounts: { create: { provider, providerId, ...tokens } },
    },
  });
}

/** Le nom d'utilisateur est unique en base : un suffixe est ajouté en cas de collision. */
async function uniqueUsername(candidate: string): Promise<string> {
  const base = candidate.slice(0, 20).replace(/[^a-zA-Z0-9_]/g, '_') || 'user';

  for (let attempt = 0; attempt < 5; attempt++) {
    const username = attempt === 0 ? base : `${base}_${attempt}`;
    const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!taken) return username;
  }

  return `${base}_${Math.floor(Math.random() * 1e6)}`;
}

/** Fabrique le callback de vérification commun aux trois stratégies. */
function verify(provider: OAuthProvider, normalize: (profile: any) => NormalizedProfile) {
  return async (
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: Error | null, user?: User) => void,
  ) => {
    try {
      const user = await resolveUser(
        provider,
        normalize(profile),
        { accessToken, refreshToken: refreshToken ?? undefined },
        readLinkState(req.query.state),
      );
      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  };
}

const callbackUrl = (provider: OAuthProvider) =>
  `${env.OAUTH_CALLBACK_BASE}/api/auth/${provider}/callback`;

// ─────────────────────────────────────────
// Google
// ─────────────────────────────────────────
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackUrl('google'),
        passReqToCallback: true,
      },
      verify('google', (profile) => ({
        providerId: profile.id,
        email: profile.emails?.[0]?.value,
        username: profile.emails?.[0]?.value?.split('@')[0],
        avatar: profile.photos?.[0]?.value,
      })) as any,
    ),
  );
  configured.add('google');
}

// ─────────────────────────────────────────
// GitHub
// ─────────────────────────────────────────
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: callbackUrl('github'),
        scope: ['user:email'],
        passReqToCallback: true,
      },
      verify('github', (profile) => ({
        providerId: String(profile.id),
        email:
          profile.emails?.find((entry: any) => entry.primary)?.value ?? profile.emails?.[0]?.value,
        username: profile.username,
        avatar: profile.photos?.[0]?.value,
      })) as any,
    ),
  );
  configured.add('github');
}

// ─────────────────────────────────────────
// Microsoft
// ─────────────────────────────────────────
if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        callbackURL: callbackUrl('microsoft'),
        scope: ['user.read'],
        passReqToCallback: true,
      } as any,
      verify('microsoft', (profile) => ({
        providerId: profile.id,
        email: profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName,
        username: profile.displayName?.replace(/\s+/g, '_').toLowerCase(),
      })) as any,
    ),
  );
  configured.add('microsoft');
}

export default passport;
