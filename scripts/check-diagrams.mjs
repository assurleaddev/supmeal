/**
 * Contrôle les diagrammes Mermaid de la documentation.
 *
 *   node scripts/check-diagrams.mjs
 *
 * Trois choses se dégradent silencieusement quand on édite un diagramme à la main : un bloc mal
 * fermé, un `end` oublié, ou un nouveau diagramme ajouté sans l'en-tête de thème — ce dernier ne
 * casse rien, il produit simplement un diagramme violet au milieu de treize autres verts. Aucun de
 * ces défauts ne se voit dans un `git diff` ; tous se voient à la lecture du rendu, c'est-à-dire
 * trop tard.
 *
 * Le contrôle est volontairement **sans dépendance** : il vérifie la structure, pas la grammaire
 * complète de Mermaid. Pour une validation grammaticale, rendre la page sur GitHub reste le juge.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const THEME_MARKER = '%%{init:';
const ACCENT = '#16a34a';

/** Compte les lignes qui ouvrent un bloc et celles qui le ferment, par type de diagramme. */
function structuralProblems(kind, lines) {
  const problems = [];
  const count = (re) => lines.filter((l) => re.test(l)).length;

  if (kind === 'graph' || kind === 'flowchart') {
    const open = count(/^\s*subgraph\b/);
    const close = count(/^\s*end\s*$/);
    if (open !== close) problems.push(`subgraph ${open} != end ${close}`);
  } else if (kind === 'sequenceDiagram') {
    const open = count(/^\s*(alt|opt|loop|par|critical|break|rect)\b/);
    const close = count(/^\s*end\s*$/);
    if (open !== close) problems.push(`alt/opt ${open} != end ${close}`);
  } else if (kind.startsWith('stateDiagram')) {
    const open = count(/^\s*state\b.*\{\s*$/);
    const close = count(/^\s*\}\s*$/);
    if (open !== close) problems.push(`state{ ${open} != } ${close}`);
    const nOpen = count(/^\s*note\b/i);
    const nEnd = count(/^\s*end note\s*$/);
    if (nOpen !== nEnd) problems.push(`note ${nOpen} != end note ${nEnd}`);
  } else if (kind === 'erDiagram') {
    // Les lignes de relation portent des accolades dans leur notation de cardinalité (`||--o{`) :
    // les compter fausserait le total.
    const entities = lines.filter((l) => !/--/.test(l)).join('\n');
    const open = entities.split('{').length - 1;
    const close = entities.split('}').length - 1;
    if (open !== close) problems.push(`entités { ${open} != } ${close}`);
  } else if (kind === 'classDiagram') {
    const body = lines.join('\n');
    const open = body.split('{').length - 1;
    const close = body.split('}').length - 1;
    if (open !== close) problems.push(`classes { ${open} != } ${close}`);
  }

  // Une classe appliquée sans classDef correspondant ne colore rien, en silence.
  const defined = new Set(
    lines.flatMap((l) => (l.match(/^\s*classDef\s+(\w+)/) || []).slice(1)),
  );
  for (const l of lines) {
    const m = l.match(/^\s*class\s+[\w,]+\s+(\w+)\s*$/);
    if (m && !defined.has(m[1])) problems.push(`classe « ${m[1]} » appliquée sans classDef`);
  }

  return problems;
}

let blocks = 0;
let failures = 0;

for (const file of readdirSync(DOCS).filter((f) => f.endsWith('.md')).sort()) {
  const lines = readFileSync(join(DOCS, file), 'utf8').split('\n');
  let inBlock = false;
  let buf = [];
  let start = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock && line.trim() === '```mermaid') {
      inBlock = true;
      buf = [];
      start = i + 1;
      continue;
    }

    if (inBlock && line.trim() === '```') {
      inBlock = false;
      blocks++;

      const themed = buf.some((l) => l.trim().startsWith(THEME_MARKER));
      const useful = buf.find((l) => l.trim() && !l.trim().startsWith(THEME_MARKER)) || '';
      const kind = useful.trim().split(/\s+/)[0];

      const problems = structuralProblems(kind, buf);
      if (!themed) problems.push("en-tête de thème absent (les couleurs de la charte ne s'appliqueront pas)");
      else if (!buf.some((l) => l.includes(ACCENT))) problems.push(`en-tête présent mais sans l'accent ${ACCENT}`);

      const where = `${file}:${start}`;
      if (problems.length === 0) {
        console.log(`  OK   ${where.padEnd(34)} ${kind}`);
      } else {
        failures++;
        console.log(`  ERR  ${where.padEnd(34)} ${kind}`);
        for (const p of problems) console.log(`         ${p}`);
      }
      continue;
    }

    if (inBlock) buf.push(line);
  }

  if (inBlock) {
    failures++;
    console.log(`  ERR  ${file} — bloc mermaid ouvert et jamais fermé`);
  }
}

console.log(`\n${blocks - failures}/${blocks} diagrammes conformes.`);
if (failures > 0) {
  console.error(`${failures} diagramme(s) à corriger.`);
  process.exit(1);
}
