/**
 * Fabrique l'archive de rendu et vérifie qu'aucun secret n'y figure.
 *
 *   node scripts/package-rendu.mjs
 *
 * L'archive est produite par `git archive`, qui n'inclut **que les fichiers suivis**. Tout ce que
 * `.gitignore` écarte en est donc absent par construction : `.env` et ses secrets OAuth réels,
 * `node_modules`, les artefacts de build, les images téléversées, et les dossiers d'outillage local.
 *
 * Zipper le dossier de travail à la main ferait exactement l'inverse : `.env` partirait avec le
 * rendu, ce que le sujet sanctionne d'un malus proportionnel à la criticité du secret exposé.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'dist-rendu');
const ARCHIVE = join(OUT_DIR, 'SUPMEAL.zip');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

/** Motifs qui ne doivent jamais se trouver dans le rendu. */
const FORBIDDEN = [
  { label: 'identifiant client Google', pattern: /\d{10,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com/ },
  { label: 'secret client Google', pattern: /GOCSPX-[A-Za-z0-9_-]{20,}/ },
  { label: 'identifiant OAuth GitHub', pattern: /\bOv2[0-9a-zA-Z]{18,}\b/ },
  // Une chaîne de 40 hexadécimaux est aussi la forme d'un SHA-1 : les empreintes des lockfiles en
  // sont pleines. On n'alerte donc que si elle est affectée à une clé qui sent le secret.
  {
    label: 'secret OAuth GitHub',
    pattern: /(?:secret|token|password|passwd|api[_-]?key)["'\s]*[:=]["'\s]*[0-9a-f]{40}\b/i,
  },
  { label: 'clé privée', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'jeton GitHub', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { label: 'clé API Google', pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
];

/** Fichiers dont le contenu est par nature un exemple, et qu'on n'inspecte pas. */
const EXEMPT = new Set(['.env.example']);

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

// ─────────────────────────────────────────
// 1. L'arbre de travail doit être propre
// ─────────────────────────────────────────

const dirty = git('status', '--porcelain')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('??'));

if (dirty.length > 0) {
  fail(
    'des modifications ne sont pas committées — l\'archive ne refléterait pas le dépôt :\n' +
      dirty.map((line) => `    ${line}`).join('\n'),
  );
}

// ─────────────────────────────────────────
// 2. Vérifier ce que contiendra l'archive
// ─────────────────────────────────────────

const tracked = git('ls-files').split('\n').filter(Boolean);
console.log(`Fichiers suivis : ${tracked.length}`);

/** Chemin exact, ou segment de chemin — pour ne pas confondre `.env` avec `.env.example`. */
const isOrContains = (path, forbidden) =>
  path === forbidden ||
  path.startsWith(`${forbidden}/`) ||
  path.includes(`/${forbidden}/`) ||
  path.endsWith(`/${forbidden}`);

const mustBeAbsent = ['.env', 'node_modules', 'dist', 'uploads/recipes'];
for (const forbidden of mustBeAbsent) {
  const hits = tracked.filter((path) => isOrContains(path, forbidden));
  if (hits.length > 0) {
    fail(
      `« ${forbidden} » est suivi par Git et partirait dans le rendu :\n` +
        hits.slice(0, 5).map((path) => `    ${path}`).join('\n'),
    );
  }
}
console.log('  ✓ ni .env, ni node_modules, ni artefacts de build ne sont suivis');

// ─────────────────────────────────────────
// 3. Chercher un secret dans le contenu suivi
// ─────────────────────────────────────────

let scanned = 0;
const findings = [];

for (const path of tracked) {
  if (EXEMPT.has(path)) continue;
  if (/\.(png|jpe?g|gif|svg|webp|ico|zip|pdf)$/i.test(path)) continue;

  let content;
  try {
    content = git('show', `HEAD:${path}`);
  } catch {
    continue;
  }
  scanned++;

  for (const { label, pattern } of FORBIDDEN) {
    const match = pattern.exec(content);
    if (match) findings.push({ path, label, sample: `${match[0].slice(0, 12)}…` });
  }
}

console.log(`  ✓ ${scanned} fichiers texte inspectés`);

if (findings.length > 0) {
  fail(
    'secret(s) détecté(s) dans des fichiers suivis :\n' +
      findings.map((f) => `    ${f.path} — ${f.label} (${f.sample})`).join('\n'),
  );
}
console.log('  ✓ aucun secret détecté');

// ─────────────────────────────────────────
// 4. Produire l'archive
// ─────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(ARCHIVE)) unlinkSync(ARCHIVE);

// `--prefix` donne à l'archive un dossier racine. Sans lui, l'extraire dans un répertoire déjà
// occupé y déverse les 136 fichiers en vrac, et le correcteur ne sait plus ce qui vient du rendu.
git('archive', '--format=zip', '-9', '--prefix=SUPMEAL/', '-o', ARCHIVE, 'HEAD');

const size = statSync(ARCHIVE).size;
console.log(`\n✓ Archive écrite : dist-rendu/SUPMEAL.zip (${(size / 1024 / 1024).toFixed(1)} Mo)`);

const head = git('log', '-1', '--format=%h %s').trim();
console.log(`  contenu du commit ${head}`);
console.log('\nÀ joindre au rendu, avec le lien du dépôt Git passé en public.');
