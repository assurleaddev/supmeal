import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateIngredients, PlannedRecipe } from '../src/services/mealPlanService';
import { resolveWeek, startOfWeek, toDateString, weekDays } from '../src/utils/week';

const line = (name: string, quantity: number | null, unit: string | null, notes: string | null = null) => ({
  quantity,
  unit,
  notes,
  ingredient: { name },
});

const planned = (
  portions: number | null,
  recipePortions: number,
  lines: ReturnType<typeof line>[],
): PlannedRecipe => ({ portions, recipe: { portions: recipePortions, ingredients: lines } });

// ─────────────────────────────────────────
// Bornes de semaine
// ─────────────────────────────────────────

test('la semaine commence le lundi', () => {
  // 2026-09-02 est un mercredi ; sa semaine commence le lundi 2026-08-31.
  assert.equal(toDateString(startOfWeek(new Date('2026-09-02T12:00:00Z'))), '2026-08-31');
});

test('le dimanche appartient à la semaine commencée six jours plus tôt', () => {
  // getUTCDay() vaut 0 le dimanche : un décalage naïf renvoyait au lundi SUIVANT, si bien que les
  // repas du dimanche tombaient hors de leur propre grille.
  assert.equal(toDateString(startOfWeek(new Date('2026-09-06T12:00:00Z'))), '2026-08-31');
});

test('le lundi est son propre début de semaine', () => {
  assert.equal(toDateString(startOfWeek(new Date('2026-08-31T00:00:00Z'))), '2026-08-31');
});

test('une semaine couvre sept jours consécutifs', () => {
  const days = weekDays(startOfWeek(new Date('2026-09-06T12:00:00Z')));
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-08-31');
  assert.equal(days[6], '2026-09-06', 'le dimanche doit être le septième jour');
});

test('décalage de semaine', () => {
  const current = resolveWeek(0);
  const next = resolveWeek(1);
  const previous = resolveWeek(-1);

  const days = (from: string, to: string) =>
    (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86_400_000;

  assert.equal(days(current.weekStartString, next.weekStartString), 7);
  assert.equal(days(previous.weekStartString, current.weekStartString), 7);
  assert.equal(days(current.weekStartString, current.weekEndString), 6);
});

// ─────────────────────────────────────────
// Liste de courses
// ─────────────────────────────────────────

test('quantités additionnées entre recettes', () => {
  const list = aggregateIngredients([
    planned(null, 4, [line('tomate', 2, 'pièce')]),
    planned(null, 4, [line('tomate', 3, 'pièce')]),
  ]);

  assert.equal(list.length, 1);
  assert.equal(list[0].totalQuantity, 5);
});

test('une première occurrence sans quantité ne fait pas disparaître les suivantes', () => {
  // Le total restait bloqué à null, effaçant silencieusement toutes les quantités ultérieures.
  const list = aggregateIngredients([
    planned(null, 4, [line('sel', null, null)]),
    planned(null, 4, [line('sel', 10, null)]),
  ]);

  assert.equal(list[0].totalQuantity, 10);
});

test('unités de casse différente regroupées', () => {
  const list = aggregateIngredients([
    planned(null, 4, [line('farine', 200, 'g')]),
    planned(null, 4, [line('farine', 100, 'G')]),
  ]);

  assert.equal(list.length, 1, '« g » et « G » désignent la même unité');
  assert.equal(list[0].totalQuantity, 300);
});

test('unités réellement différentes gardées séparées', () => {
  // Aucune conversion n'est tentée : 200 g et 1 l restent deux lignes.
  const list = aggregateIngredients([
    planned(null, 4, [line('lait', 200, 'g')]),
    planned(null, 4, [line('lait', 1, 'l')]),
  ]);

  assert.equal(list.length, 2);
});

test('mise à l échelle par portions', () => {
  const list = aggregateIngredients([planned(8, 4, [line('oeuf', 2, 'pièce')])]);
  assert.equal(list[0].totalQuantity, 4);
});

test('ordre alphabétique et notes cumulées', () => {
  const list = aggregateIngredients([
    planned(null, 4, [line('zeste', 1, null), line('ail', 1, null)]),
  ]);
  assert.deepEqual(list.map((entry) => entry.name), ['ail', 'zeste']);

  const withNotes = aggregateIngredients([
    planned(null, 4, [line('beurre', 50, 'g', 'doux')]),
    planned(null, 4, [line('beurre', 50, 'g', 'fondu')]),
  ]);
  assert.deepEqual(withNotes[0].notes, ['doux', 'fondu']);
});

test('planning vide donne une liste vide', () => {
  assert.deepEqual(aggregateIngredients([]), []);
});
