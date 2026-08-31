import test from 'node:test';
import assert from 'node:assert/strict';
import {
  csvToPayload,
  importPayloadSchema,
  parseCsvRecords,
  toCsv,
} from '../src/services/transferService';

/** Le lecteur CSV est écrit à la main : ces cas fixent ce qu'il doit tolérer. */

test('champ entre guillemets contenant un retour à la ligne', () => {
  const csv = 'cookbook,title,steps\n"Personal","Tarte","Étape 1\nÉtape 2"\n"Personal","Cake","Mélanger"';
  const records = parseCsvRecords(csv);

  // Un découpage naïf sur \n produisait quatre lignes bancales au lieu de trois enregistrements.
  assert.equal(records.length, 3);
  assert.equal(records[1][2], 'Étape 1\nÉtape 2');
  assert.equal(records[2][1], 'Cake', "l'enregistrement suivant doit rester intact");
});

test('guillemets échappés et fins de ligne Windows', () => {
  assert.equal(parseCsvRecords('a\n"il a dit ""oui"""')[1][0], 'il a dit "oui"');
  assert.deepEqual(parseCsvRecords('a,b\r\n1,2')[1], ['1', '2']);
});

test('lignes vides ignorées', () => {
  assert.equal(parseCsvRecords('a,b\n\n1,2\n\n').length, 2);
});

test('CSV multiligne vers charge utile exploitable', () => {
  const csv = 'cookbook,title,steps\n"Personal","Tarte","Étape 1\nÉtape 2"\n"Personal","Cake","Mélanger"';
  const payload = importPayloadSchema.parse(csvToPayload(csv));

  assert.equal(payload.personalRecipes.length, 2);
  assert.deepEqual(payload.personalRecipes.map((r) => r.title), ['Tarte', 'Cake']);
});

test('ligne sans titre écartée', () => {
  const payload = importPayloadSchema.parse(
    csvToPayload('cookbook,title\n"Personal","Vraie"\n"Personal",""'),
  );
  assert.equal(payload.personalRecipes.length, 1);
});

test('regroupement par cookbook', () => {
  const payload = importPayloadSchema.parse(
    csvToPayload('cookbook,title\n"Personal","A"\n"Famille","B"\n"Famille","C"'),
  );
  assert.equal(payload.personalRecipes.length, 1);
  assert.equal(payload.cookbooks.length, 1);
  assert.equal(payload.cookbooks[0].name, 'Famille');
  assert.equal(payload.cookbooks[0].recipes.length, 2);
});

test('aller-retour export CSV puis import', () => {
  const exported = {
    exportedAt: '',
    version: '1.0.0',
    user: { email: '', username: '' },
    personalRecipes: [
      {
        title: 'Soupe',
        description: 'Bonne, très bonne',
        prepTime: 10,
        cookTime: 20,
        portions: 4,
        sourceUrl: null,
        imageUrl: null,
        ingredients: [{ name: 'carotte', quantity: 2, unit: 'pièce', notes: null, orderIndex: 0 }],
        steps: [{ orderIndex: 0, description: 'Éplucher, couper', duration: null }],
        tags: [{ name: 'soupe', type: 'CATEGORY' as const }],
      },
    ],
    cookbooks: [],
  };

  const recipe = importPayloadSchema.parse(csvToPayload(toCsv(exported as any))).personalRecipes[0];

  assert.equal(recipe.title, 'Soupe');
  // Les virgules internes doivent survivre à l'échappement.
  assert.equal(recipe.description, 'Bonne, très bonne');
  assert.equal(recipe.steps[0].description, 'Éplucher, couper');
});

test('charge utile vide refusée', () => {
  assert.equal(importPayloadSchema.safeParse({ personalRecipes: [], cookbooks: [] }).success, false);
});

test('recette sans titre refusée', () => {
  assert.equal(importPayloadSchema.safeParse({ personalRecipes: [{ title: '' }] }).success, false);
});

test('bornes de volume appliquées', () => {
  const tooMany = Array.from({ length: 2001 }, () => ({ title: 'x' }));
  assert.equal(importPayloadSchema.safeParse({ personalRecipes: tooMany }).success, false);
});
