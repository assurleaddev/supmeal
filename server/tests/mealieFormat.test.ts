import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mealieToPayload,
  minutesToIsoDuration,
  parseDurationToMinutes,
  toMealieRecipe,
} from '../src/services/mealieFormat';

/**
 * Mealie n'écrit ni les durées, ni les portions, ni les ingrédients comme SUPMEAL. Ces cas fixent
 * la traduction dans les deux sens, en particulier les formes qu'un export réel produit.
 */

test('durées ISO 8601', () => {
  assert.equal(parseDurationToMinutes('PT1H30M'), 90);
  assert.equal(parseDurationToMinutes('PT45M'), 45);
  assert.equal(parseDurationToMinutes('PT2H'), 120);
  assert.equal(parseDurationToMinutes('P1DT2H'), 1560);
  assert.equal(parseDurationToMinutes('PT0M'), undefined);
});

test('durées en texte libre', () => {
  assert.equal(parseDurationToMinutes('45 minutes'), 45);
  assert.equal(parseDurationToMinutes('45 min'), 45);
  // Les minutes peuvent suivre l'heure sans unité : « 1 h 15 » vaut 75, pas 60.
  assert.equal(parseDurationToMinutes('1 h 15'), 75);
  assert.equal(parseDurationToMinutes('1 hour 30 minutes'), 90);
  assert.equal(parseDurationToMinutes('2h'), 120);
  assert.equal(parseDurationToMinutes('30'), 30);
  assert.equal(parseDurationToMinutes(''), undefined);
  assert.equal(parseDurationToMinutes(null), undefined);
});

test('minutes vers ISO 8601', () => {
  assert.equal(minutesToIsoDuration(90), 'PT1H30M');
  assert.equal(minutesToIsoDuration(45), 'PT45M');
  assert.equal(minutesToIsoDuration(120), 'PT2H');
  assert.equal(minutesToIsoDuration(0), null);
  assert.equal(minutesToIsoDuration(null), null);
});

const MEALIE_NATIVE = {
  id: 'abc',
  name: 'Chocolate Chip Cookies',
  slug: 'chocolate-chip-cookies',
  description: 'Classic cookies',
  recipeYield: '24 cookies',
  prepTime: 'PT15M',
  performTime: 'PT12M',
  orgURL: 'https://example.com/cookies',
  recipeIngredient: [
    { quantity: 2.5, unit: { name: 'cups' }, food: { name: 'flour' }, note: 'sifted' },
    { quantity: 1, unit: { name: 'tsp' }, food: { name: 'baking soda' }, note: '' },
  ],
  recipeInstructions: [
    { id: '1', title: '', text: 'Preheat oven to 190C' },
    { id: '2', title: '', text: 'Mix dry ingredients' },
  ],
  tags: [{ name: 'dessert', slug: 'dessert' }],
  recipeCategory: [{ name: 'Baking' }],
};

test('export Mealie natif : ingrédients en objets', () => {
  const payload = mealieToPayload(MEALIE_NATIVE);
  assert.ok(payload);

  const recipe = payload.personalRecipes[0] as any;
  assert.equal(recipe.title, 'Chocolate Chip Cookies');
  assert.equal(recipe.portions, 24, 'recipeYield « 24 cookies » doit donner 24');
  assert.equal(recipe.prepTime, 15);
  assert.equal(recipe.cookTime, 12, 'le temps de cuisson vient de performTime');
  assert.equal(recipe.sourceUrl, 'https://example.com/cookies');
  assert.deepEqual(
    recipe.ingredients.map((i: any) => [i.name, i.quantity, i.unit, i.notes]),
    [['flour', 2.5, 'cups', 'sifted'], ['baking soda', 1, 'tsp', null]],
  );
  assert.deepEqual(recipe.steps.map((s: any) => s.description), [
    'Preheat oven to 190C',
    'Mix dry ingredients',
  ]);
  // Mealie sépare tags et recipeCategory ; SUPMEAL n'a qu'une notion de tag.
  assert.deepEqual(recipe.tags.sort(), ['baking', 'dessert']);
});

test('variante schema.org : ingrédients et étapes en chaînes', () => {
  const payload = mealieToPayload({
    name: 'Salade niçoise',
    recipeYield: 4,
    prepTime: 'PT20M',
    recipeIngredient: ['200 g de thon', '4 tomates'],
    recipeInstructions: ['Laver les légumes', 'Assembler'],
    tags: ['entrée'],
  });
  assert.ok(payload);

  const recipe = payload.personalRecipes[0] as any;
  assert.deepEqual(recipe.ingredients.map((i: any) => i.name), ['200 g de thon', '4 tomates']);
  assert.deepEqual(recipe.steps.map((s: any) => s.description), ['Laver les légumes', 'Assembler']);
  assert.equal(recipe.portions, 4);
});

test('tableau de recettes et objet englobant', () => {
  assert.equal(mealieToPayload([MEALIE_NATIVE, MEALIE_NATIVE])!.personalRecipes.length, 2);
  assert.equal(mealieToPayload({ recipes: [MEALIE_NATIVE] })!.personalRecipes.length, 1);
});

test('ce qui ne doit pas être pris pour du Mealie', () => {
  // L'export natif de SUPMEAL doit continuer d'être traité comme tel.
  assert.equal(mealieToPayload({ personalRecipes: [], cookbooks: [] }), null);
  assert.equal(mealieToPayload({ hello: 'world' }), null);
  assert.equal(mealieToPayload({ name: 'sans contenu de recette' }), null);
  assert.equal(mealieToPayload(null), null);
});

test('recette Mealie sans ingrédient ni instruction reste importable', () => {
  const payload = mealieToPayload({ name: 'Minimal', recipeIngredient: [], recipeInstructions: [] });
  assert.ok(payload);

  const recipe = payload.personalRecipes[0] as any;
  // L'import exige au moins un ingrédient et une étape : un contenu explicite vaut mieux qu'un rejet.
  assert.equal(recipe.ingredients.length, 1);
  assert.equal(recipe.steps.length, 1);
});

test('aller-retour SUPMEAL vers Mealie et retour', () => {
  const exported = {
    title: 'Tarte Tatin',
    description: 'Dessert renversé',
    prepTime: 25,
    cookTime: 40,
    portions: 6,
    sourceUrl: 'https://marmiton.org/tatin',
    ingredients: [{ name: 'pommes', quantity: 6, unit: 'pièce', notes: 'Golden' }],
    steps: [{ description: 'Caraméliser' }],
    tags: [{ name: 'dessert' }],
  };

  const mealie = toMealieRecipe(exported as any);
  assert.equal(mealie.name, 'Tarte Tatin');
  assert.equal(mealie.slug, 'tarte-tatin', 'le slug doit être dépourvu de diacritiques');
  assert.equal(mealie.recipeYield, '6');
  assert.equal(mealie.prepTime, 'PT25M');
  assert.equal(mealie.performTime, 'PT40M');
  assert.equal(mealie.totalTime, 'PT1H5M');

  const back = mealieToPayload(mealie)!.personalRecipes[0] as any;
  assert.equal(back.title, 'Tarte Tatin');
  assert.deepEqual([back.prepTime, back.cookTime], [25, 40]);
  assert.equal(back.portions, 6);
  assert.deepEqual(
    [back.ingredients[0].name, back.ingredients[0].quantity, back.ingredients[0].unit],
    ['pommes', 6, 'pièce'],
  );
  assert.equal(back.steps[0].description, 'Caraméliser');
});
