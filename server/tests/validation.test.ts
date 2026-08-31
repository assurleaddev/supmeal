import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  optionalPositiveInt,
  optionalPositiveNumber,
  optionalString,
  optionalUrl,
} from '../src/utils/validation';
import { getCookbookPermissions } from '../src/middleware/permissions';
import { canonicalName } from '../src/utils/text';

/**
 * Un formulaire HTML n'a pas de notion de champ absent : un texte vide arrive en chaîne vide, et un
 * champ numérique vide lu avec `valueAsNumber` arrive en NaN. Sans normalisation, ces valeurs
 * échouaient sur les schémas et rendaient toute création de recette impossible.
 */

const recipeLike = z.object({
  description: optionalString(2000),
  prepTime: optionalPositiveInt,
  quantity: optionalPositiveNumber,
  sourceUrl: optionalUrl,
});

test('un formulaire ne remplissant que les champs obligatoires est accepté', () => {
  const parsed = recipeLike.parse({
    description: '',
    prepTime: NaN,
    quantity: NaN,
    sourceUrl: '',
  });

  assert.deepEqual(parsed, {
    description: null,
    prepTime: null,
    quantity: null,
    sourceUrl: null,
  });
});

test('undefined équivaut à absent', () => {
  assert.deepEqual(recipeLike.parse({}), {
    description: null,
    prepTime: null,
    quantity: null,
    sourceUrl: null,
  });
});

test('la validation reste stricte sur les valeurs réellement fournies', () => {
  assert.equal(recipeLike.safeParse({ sourceUrl: 'pas-une-url' }).success, false);
  assert.equal(recipeLike.safeParse({ prepTime: -5 }).success, false);
  assert.equal(recipeLike.safeParse({ prepTime: 0 }).success, false);
  assert.equal(recipeLike.safeParse({ prepTime: 1.5 }).success, false, 'un entier est attendu');
  assert.equal(recipeLike.safeParse({ quantity: -1 }).success, false);
  assert.equal(recipeLike.safeParse({ description: 'x'.repeat(2001) }).success, false);
});

test('les valeurs valides passent inchangées', () => {
  const parsed = recipeLike.parse({
    description: 'Un dessert',
    prepTime: 20,
    quantity: 1.5,
    sourceUrl: 'https://marmiton.org/tatin',
  });

  assert.equal(parsed.prepTime, 20);
  assert.equal(parsed.quantity, 1.5, 'les quantités décimales sont légitimes');
  assert.equal(parsed.sourceUrl, 'https://marmiton.org/tatin');
});

// ─────────────────────────────────────────
// Hiérarchie des rôles
// ─────────────────────────────────────────

test('droits accordés par chaque rôle de cookbook', () => {
  assert.deepEqual(getCookbookPermissions('CREATOR'), {
    canComment: true,
    canChat: true,
    canEditRecipes: true,
    canManageMembers: true,
    canDeleteCookbook: true,
  });

  assert.deepEqual(getCookbookPermissions('EDITOR'), {
    canComment: true,
    canChat: true,
    canEditRecipes: true,
    canManageMembers: false,
    canDeleteCookbook: false,
  });

  assert.deepEqual(getCookbookPermissions('COMMENTER'), {
    canComment: true,
    canChat: true,
    canEditRecipes: false,
    canManageMembers: false,
    canDeleteCookbook: false,
  });

  // Un lecteur ne peut ni écrire de recette, ni commenter, ni participer au chat.
  assert.deepEqual(getCookbookPermissions('READER'), {
    canComment: false,
    canChat: false,
    canEditRecipes: false,
    canManageMembers: false,
    canDeleteCookbook: false,
  });
});

// ─────────────────────────────────────────
// Canonicalisation des libellés
// ─────────────────────────────────────────

test('les libellés partagés sont ramenés à une forme unique', () => {
  // Sans cela, « Tomate » et « tomate  » créeraient deux lignes et fausseraient le filtrage.
  assert.equal(canonicalName('Tomate'), 'tomate');
  assert.equal(canonicalName('  tomate  '), 'tomate');
  assert.equal(canonicalName('TOMATE'), 'tomate');
  // Les diacritiques sont conservés : c'est la recherche, non le stockage, qui les ignore.
  assert.equal(canonicalName('Crème Fraîche'), 'crème fraîche');
});

// ─────────────────────────────────────────
// Préférences culinaires
// ─────────────────────────────────────────

test('correspondance des allergènes par inclusion', () => {
  // « arachide » doit alerter sur « beurre d'arachide » : une égalité stricte manquerait le cas.
  const match = (allergies: string[], ingredients: string[]) =>
    [...new Set(allergies.filter((a) => {
      const needle = canonicalName(a);
      return needle.length > 0 && ingredients.some((name) => name.includes(needle));
    }))];

  assert.deepEqual(match(['arachide'], ["beurre d'arachide", 'lait']), ['arachide']);
  assert.deepEqual(match(['Lactose'], ['lait', 'farine']), []);
  assert.deepEqual(match(['gluten', 'arachide'], ['farine de gluten', 'cacahuète']), ['gluten']);
  assert.deepEqual(match([], ['arachide']), [], 'sans allergie déclarée, aucun avertissement');
  assert.deepEqual(match([''], ['arachide']), [], 'une entrée vide ne doit pas tout faire correspondre');
});
