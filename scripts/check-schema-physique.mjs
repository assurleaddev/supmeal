/**
 * Vérifie que docs/schema-physique.sql correspond encore à server/prisma/schema.prisma.
 *
 *   node scripts/check-schema-physique.mjs          # échoue si le fichier a dérivé
 *   node scripts/check-schema-physique.mjs --write  # le régénère
 *
 * Un fichier généré et versionné n'a de valeur que s'il est vrai. Sans ce contrôle, une évolution du
 * schéma Prisma laisserait un modèle physique périmé dans la documentation — pire qu'aucun modèle,
 * parce qu'un lecteur lui fait confiance. Le contrôle règle l'unique objection à sa présence dans le
 * dépôt.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'docs', 'schema-physique.sql');
const SERVER = join(ROOT, 'server');

const HEADER = `-- =====================================================================================
-- SUPMEAL — modèle physique de données (MPD)
--
-- Ce fichier est **généré**, pas écrit à la main. Il est la traduction PostgreSQL 16 exacte de
-- server/prisma/schema.prisma, obtenue par :
--
--     node scripts/check-schema-physique.mjs --write
--
-- Il sert de référence de lecture : types physiques, contraintes, index et actions référentielles.
-- Ce n'est **pas** un script de migration à exécuter : au démarrage, le conteneur server applique le
-- schéma avec \` prisma db push\`, qui produit ces mêmes objets.
--
-- Deux éléments n'y figurent pas, parce qu'ils ne dérivent pas du schéma Prisma et sont créés au
-- démarrage par server/src/config/searchIndex.ts :
--   • les extensions unaccent et pg_trgm ;
--   • la fonction IMMUTABLE supmeal_normalize() et les index GIN trigrammes de recherche.
--
-- Regarder ce fichier plutôt que le schéma Prisma apprend une chose : les longueurs maximales
-- (titre ≤ 200, nom d'ingrédient ≤ 100…) sont **applicatives**, validées par Zod. Aucune n'est une
-- contrainte de base — toutes les chaînes sont des \`TEXT\` sans borne. Voir §5.7 de la
-- documentation technique.
--
-- \`node scripts/check-schema-physique.mjs\` échoue si ce fichier a dérivé du schéma.
-- =====================================================================================

`;

/** DDL produite par Prisma, sans l'en-tête de commentaires. */
function generate() {
  const out = execFileSync(
    'npx',
    ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    { cwd: SERVER, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1024 * 1024 * 32 },
  );
  return out.replace(/\r\n/g, '\n').trim() + '\n';
}

/** Retire l'en-tête pour ne comparer que la DDL : reformuler un commentaire ne doit pas échouer. */
const ddlOnly = (text) => {
  const body = text.replace(/\r\n/g, '\n');
  const start = body.indexOf('-- CreateEnum');
  return (start >= 0 ? body.slice(start) : body).trim() + '\n';
};

const generated = generate();

if (process.argv.includes('--write')) {
  writeFileSync(TARGET, HEADER + generated, 'utf8');
  console.log(`✓ docs/schema-physique.sql régénéré (${generated.split('\n').length} lignes de DDL)`);
  process.exit(0);
}

if (!existsSync(TARGET)) {
  console.error('✗ docs/schema-physique.sql est absent. Régénérez-le : --write');
  process.exit(1);
}

const committed = readFileSync(TARGET, 'utf8');

if (ddlOnly(committed) === ddlOnly(generated)) {
  const tables = (generated.match(/CREATE TABLE/g) || []).length;
  const indexes = (generated.match(/CREATE (UNIQUE )?INDEX/g) || []).length;
  const fks = (generated.match(/ADD CONSTRAINT/g) || []).length;
  console.log(`✓ modèle physique à jour : ${tables} tables, ${indexes} index, ${fks} clés étrangères`);
  process.exit(0);
}

console.error('✗ docs/schema-physique.sql ne correspond plus à server/prisma/schema.prisma.');
console.error('  Le schéma a évolué sans que le modèle physique soit régénéré.');
console.error('  Corrigez-le : node scripts/check-schema-physique.mjs --write');
process.exit(1);
