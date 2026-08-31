import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * Jeton d'état d'un rattachement de compte OAuth2.
 *
 * Lier un fournisseur à un compte existant demande de transporter « qui » est en train de lier à
 * travers l'aller-retour chez le fournisseur. Le paramètre `state` d'OAuth2 est prévu pour cela,
 * mais il transite par le navigateur : il est donc signé et de courte durée plutôt que de contenir
 * l'identifiant en clair, qui serait alors falsifiable.
 */

const PURPOSE = 'oauth-link';
const LIFETIME = '10m';

interface LinkStatePayload {
  sub: string;
  purpose: typeof PURPOSE;
}

export function createLinkState(userId: string): string {
  return jwt.sign({ sub: userId, purpose: PURPOSE }, env.JWT_SECRET, { expiresIn: LIFETIME });
}

/** Renvoie l'identifiant de l'utilisateur à rattacher, ou null si l'état est absent ou invalide. */
export function readLinkState(state: unknown): string | null {
  if (typeof state !== 'string' || state.length === 0) return null;

  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as LinkStatePayload;
    return payload.purpose === PURPOSE ? payload.sub : null;
  } catch {
    return null;
  }
}
