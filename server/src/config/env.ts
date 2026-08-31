// Charge un éventuel server/.env en développement local. En conteneur, les variables sont déjà
// injectées par docker-compose et ce chargement est simplement sans effet.
import 'dotenv/config';
import { z } from 'zod';

/**
 * Validation des variables d'environnement au démarrage du serveur.
 *
 * Aucune valeur de repli n'est fournie pour les secrets : un secret codé en dur dans les sources
 * serait à la fois exposé dans le dépôt et utilisé silencieusement en production si la variable
 * venait à manquer, rendant tous les jetons forgeables. Le serveur refuse donc de démarrer plutôt
 * que de signer avec une valeur connue publiquement.
 */
/**
 * Variable facultative dont la chaîne vide vaut absence.
 *
 * `docker-compose.yml` transmet `${VAR:-}` pour les fournisseurs OAuth2 non configurés : la
 * variable existe donc dans l'environnement du conteneur, avec une valeur vide. Un simple
 * `.optional()` ne l'accepterait pas, puisqu'il ne tolère que `undefined`.
 */
const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requise'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET est requis (16 caractères minimum)'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET est requis (16 caractères minimum)'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_URL: z.string().url().default('http://localhost:8080'),
  OAUTH_CALLBACK_BASE: z.string().url().default('http://localhost:3000'),

  // Chaque fournisseur OAuth2 est facultatif : sa stratégie n'est montée que si la paire
  // identifiant/secret est fournie, et l'application reste utilisable sans aucun d'entre eux.
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  GITHUB_CLIENT_ID: optionalSecret,
  GITHUB_CLIENT_SECRET: optionalSecret,
  MICROSOFT_CLIENT_ID: optionalSecret,
  MICROSOFT_CLIENT_SECRET: optionalSecret,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(
    `Configuration d'environnement invalide :\n${details}\n\n` +
      'Copiez .env.example en .env et renseignez les valeurs manquantes.\n' +
      'Générez les secrets avec : openssl rand -base64 64',
  );
}

export const env = parsed.data;

// Les valeurs d'exemple sont volontairement acceptées pour qu'un `docker compose up` fonctionne
// immédiatement, mais elles ne doivent jamais atteindre un déploiement réel.
const PLACEHOLDER_MARKERS = ['change_this', 'dev_secret', 'change_me'];

const usesPlaceholder = [env.JWT_SECRET, env.JWT_REFRESH_SECRET].some((secret) =>
  PLACEHOLDER_MARKERS.some((marker) => secret.toLowerCase().includes(marker)),
);

if (usesPlaceholder) {
  console.warn(
    '\n⚠️  Les secrets JWT utilisent encore les valeurs d\'exemple de .env.example.\n' +
      '   Remplacez-les avant tout déploiement : openssl rand -base64 64\n',
  );
}

export const isProduction = env.NODE_ENV === 'production';
