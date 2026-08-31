import prisma from './database';

/**
 * Index de recherche textuelle.
 *
 * Le schéma est appliqué par `prisma db push`, qui ne sait pas déclarer d'extension PostgreSQL ni
 * d'index fonctionnel. Ce complément est donc exécuté au démarrage, en DDL idempotente : il peut
 * être rejoué à chaque boot sans effet de bord.
 *
 * Deux manques sont couverts :
 *
 * 1. **Accents** — `ILIKE '%creme%'` ne trouvait pas « crème ». Les deux côtés de la comparaison
 *    passent maintenant par `supmeal_normalize`, qui retire les diacritiques et met en minuscules.
 *
 * 2. **Performance** — un `ILIKE '%…%'` ne peut utiliser aucun index B-tree : chaque recherche
 *    lisait toute la table. Les index GIN trigrammes (`pg_trgm`) rendent la recherche par sous-chaîne
 *    indexable.
 */

/**
 * `unaccent(text)` est déclarée STABLE et non IMMUTABLE, ce qui interdit son usage dans un index.
 * La forme à deux arguments, qui reçoit explicitement le dictionnaire, est immuable : c'est elle
 * qu'on encapsule.
 */
const STATEMENTS = [
  'CREATE EXTENSION IF NOT EXISTS unaccent',
  'CREATE EXTENSION IF NOT EXISTS pg_trgm',
  `CREATE OR REPLACE FUNCTION supmeal_normalize(input text)
     RETURNS text
     LANGUAGE sql
     IMMUTABLE PARALLEL SAFE STRICT
   AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, input)) $$`,
  `CREATE INDEX IF NOT EXISTS supmeal_recipe_title_trgm
     ON "Recipe" USING gin (supmeal_normalize(title) gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS supmeal_recipe_description_trgm
     ON "Recipe" USING gin (supmeal_normalize(coalesce(description, '')) gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS supmeal_ingredient_name_trgm
     ON "Ingredient" USING gin (supmeal_normalize(name) gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS supmeal_tag_name_trgm
     ON "Tag" USING gin (supmeal_normalize(name) gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS supmeal_step_description_trgm
     ON "RecipeStep" USING gin (supmeal_normalize(description) gin_trgm_ops)`,
];

let ready = false;

/** Vrai lorsque `supmeal_normalize` et ses index sont disponibles. */
export const isSearchIndexReady = () => ready;

export async function ensureSearchIndex(): Promise<void> {
  try {
    for (const statement of STATEMENTS) {
      await prisma.$executeRawUnsafe(statement);
    }
    ready = true;
    console.log('✅ Search index ready (unaccent + pg_trgm)');
  } catch (err) {
    // Créer une extension demande des droits superutilisateur, dont on ne dispose pas forcément sur
    // une base managée. La recherche retombe alors sur `ILIKE`, sensible aux accents et non indexée,
    // mais l'application reste parfaitement fonctionnelle.
    ready = false;
    console.warn(
      '⚠️  Search index unavailable — falling back to unindexed, accent-sensitive search.\n' +
        `   Reason: ${(err as Error).message.split('\n')[0]}`,
    );
  }
}
