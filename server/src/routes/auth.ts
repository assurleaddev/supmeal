import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import {
  OAUTH_PROVIDERS,
  OAuthProvider,
  configuredProviders,
  isProviderConfigured,
} from '../config/passport';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';
import { createLinkState } from '../utils/oauthState';
import * as authService from '../services/authService';
import { env } from '../config/env';

/**
 * Adaptateur HTTP de l'authentification. Les stratégies OAuth2 sont montées par Passport ; les
 * règles métier vivent dans services/authService.ts.
 */
const router = Router();

// ─────────────────────────────────────────
// Authentification locale
// ─────────────────────────────────────────

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = authService.registerSchema.parse(req.body);
    res.status(201).json({ success: true, data: await authService.register(input) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = authService.loginSchema.parse(req.body);
    res.json({ success: true, data: await authService.login(input) });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = authService.refreshSchema.parse(req.body);
    res.json({ success: true, data: await authService.refresh(refreshToken) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// OAuth2
// ─────────────────────────────────────────

/**
 * Fournisseurs réellement utilisables sur ce déploiement.
 *
 * Le client interroge cette route pour n'afficher que des boutons fonctionnels : sans elle, un
 * fournisseur non configuré n'était découvert qu'au clic, sous la forme d'une erreur 500.
 */
router.get('/providers', (_req: Request, res: Response) => {
  res.json({ success: true, data: { providers: configuredProviders() } });
});

/**
 * Prépare le rattachement d'un fournisseur au compte connecté (§2.2.5).
 *
 * Renvoie une URL d'autorisation portant un `state` signé qui identifie l'utilisateur courant.
 * Auparavant, « Lier » relançait une simple connexion : le rapprochement ne se faisait que par
 * coïncidence d'adresse e-mail et, si elle différait, la session basculait silencieusement sur un
 * autre compte.
 */
router.post(
  '/link/:provider',
  requireAuth as any,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.params;
      assertProviderAvailable(provider);

      const state = createLinkState(req.user.id);
      res.json({
        success: true,
        data: { url: `${env.OAUTH_CALLBACK_BASE}/api/auth/${provider}?state=${encodeURIComponent(state)}` },
      });
    } catch (err) {
      next(err);
    }
  },
);

function assertProviderAvailable(provider: string): asserts provider is OAuthProvider {
  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    throw new AppError(`Unknown OAuth provider: ${provider}`, 404);
  }

  if (!isProviderConfigured(provider)) {
    throw new AppError(
      `OAuth provider "${provider}" is not configured on this deployment. ` +
        `Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET to enable it.`,
      503,
    );
  }
}

/** Refuse proprement un fournisseur absent avant d'atteindre une stratégie Passport inexistante. */
function requireProvider(provider: OAuthProvider) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    try {
      assertProviderAvailable(provider);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Point de retour commun aux trois fournisseurs. */
function oauthCallback(req: Request, res: Response) {
  const user = req.user as { id: string; email: string; username: string };
  res.redirect(authService.buildOAuthRedirect(user));
}

const SCOPES: Record<OAuthProvider, string[]> = {
  google: ['profile', 'email'],
  github: ['user:email'],
  microsoft: ['user.read'],
};

// Les trois fournisseurs exposent le même couple de routes : on les monte en boucle plutôt que de
// recopier six déclarations quasi identiques.
for (const provider of OAUTH_PROVIDERS) {
  router.get(
    `/${provider}`,
    requireProvider(provider),
    (req: Request, res: Response, next: NextFunction) =>
      passport.authenticate(provider, {
        scope: SCOPES[provider],
        session: false,
        // Retransmis au fournisseur puis restitué au callback : c'est lui qui distingue un
        // rattachement de compte d'une simple connexion.
        state: typeof req.query.state === 'string' ? req.query.state : undefined,
      } as any)(req, res, next),
  );

  router.get(
    `/${provider}/callback`,
    requireProvider(provider),
    passport.authenticate(provider, {
      session: false,
      failureRedirect: `${env.CLIENT_URL}/login?error=oauth`,
    } as any),
    oauthCallback,
  );
}

export default router;
