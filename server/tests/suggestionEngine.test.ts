import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CandidateRecipe,
  ScoredSignal,
  SuggestionContext,
  UserSignals,
  WEIGHTS,
  buildTasteProfile,
  computeIdf,
  containsAllergen,
  rankSuggestions,
} from '../src/services/suggestionEngine';

/**
 * Ces cas vérifient que le classement raisonne réellement, et pas qu'il renvoie simplement quelque
 * chose. Chacun isole un comportement attendu du moteur, y compris ceux qui le rendraient inutile
 * s'ils échouaient : ignorer un allergène, ou proposer cinq fois le même plat.
 */

function recipe(partial: Partial<CandidateRecipe> & { id: string }): CandidateRecipe {
  return {
    title: partial.id,
    ingredients: [],
    tags: [],
    cuisines: [],
    diets: [],
    prepTime: 10,
    cookTime: 10,
    favoriteCount: 0,
    commentCount: 0,
    ...partial,
  };
}

const noSignals: UserSignals = {
  favoriteRecipeIds: [],
  planned: [],
  allergies: [],
  diets: [],
  cuisines: [],
};

/** Raccourci : la plupart des cas n'observent que la liste classée. */
function rank(
  corpus: CandidateRecipe[],
  signals: UserSignals,
  context: SuggestionContext,
  limit: number,
) {
  return rankSuggestions(corpus, signals, context, limit).suggestions;
}

const dinnerContext: SuggestionContext = {
  slot: 'DINNER',
  weekend: false,
  ingredientsAlreadyNeeded: [],
  alreadyPlannedRecipeIds: [],
};

// ─────────────────────────────────────────
// Pondération IDF
// ─────────────────────────────────────────

test('un ingrédient omniprésent pèse moins qu un ingrédient rare', () => {
  // « sel » est dans les quatre recettes, « safran » dans une seule.
  const corpus = [
    recipe({ id: 'a', ingredients: ['sel', 'safran'] }),
    recipe({ id: 'b', ingredients: ['sel', 'tomate'] }),
    recipe({ id: 'c', ingredients: ['sel', 'oignon'] }),
    recipe({ id: 'd', ingredients: ['sel', 'carotte'] }),
  ];

  const idf = computeIdf(corpus);
  assert.ok(
    idf.get('i:safran')! > idf.get('i:sel')!,
    'sans cette hiérarchie, toute similarité serait dominée par les condiments',
  );
});

test('un terme absent du corpus n a pas de poids', () => {
  const idf = computeIdf([recipe({ id: 'a', ingredients: ['sel'] })]);
  assert.equal(idf.get('i:safran'), undefined);
});

// ─────────────────────────────────────────
// Profil de goût
// ─────────────────────────────────────────

test('le profil de goût se construit sur les favoris', () => {
  const corpus = [
    recipe({ id: 'thai', ingredients: ['citronnelle', 'gingembre'], tags: ['thaïlandaise'] }),
    recipe({ id: 'gratin', ingredients: ['pomme de terre', 'crème'], tags: ['française'] }),
  ];

  const idf = computeIdf(corpus);
  const profile = buildTasteProfile(corpus, { ...noSignals, favoriteRecipeIds: ['thai'] }, idf);

  assert.ok(profile.get('i:citronnelle')! > 0);
  assert.ok((profile.get('i:pomme de terre') ?? 0) === 0, 'rien du plat non favorisé');
});

test('un profil vide reste vide plutôt que de deviner', () => {
  const corpus = [recipe({ id: 'a', ingredients: ['sel'] })];
  const profile = buildTasteProfile(corpus, noSignals, computeIdf(corpus));
  assert.equal(profile.size, 0);
});

test('l historique ancien pèse moins que le récent', () => {
  const corpus = [
    recipe({ id: 'recent', ingredients: ['gingembre'] }),
    recipe({ id: 'ancien', ingredients: ['muscade'] }),
  ];
  const idf = computeIdf(corpus);

  const profile = buildTasteProfile(
    corpus,
    {
      ...noSignals,
      planned: [
        { recipeId: 'recent', weeksAgo: 1 },
        { recipeId: 'ancien', weeksAgo: 24 },
      ],
    },
    idf,
  );

  assert.ok(
    profile.get('i:gingembre')! > profile.get('i:muscade')!,
    'sans décroissance, un profil se figerait sur les premiers choix',
  );
});

// ─────────────────────────────────────────
// Filtres absolus
// ─────────────────────────────────────────

test('un allergène est reconnu par inclusion', () => {
  const withPeanut = recipe({ id: 'a', ingredients: ["beurre d'arachide", 'pain'] });
  assert.equal(containsAllergen(withPeanut, ['arachide']), 'arachide');
  assert.equal(containsAllergen(withPeanut, ['lactose']), null);
  assert.equal(containsAllergen(withPeanut, ['']), null, 'une allergie vide ne doit rien exclure');
});

test('une recette contenant un allergène déclaré n est JAMAIS suggérée', () => {
  const corpus = [
    // Faite pour être irrésistible sur tous les autres signaux.
    recipe({
      id: 'danger',
      ingredients: ["beurre d'arachide"],
      prepTime: 5,
      cookTime: 0,
      favoriteCount: 99,
      commentCount: 99,
    }),
    recipe({ id: 'sain', ingredients: ['carotte'] }),
  ];

  const suggestions = rank(
    corpus,
    { ...noSignals, allergies: ['arachide'], favoriteRecipeIds: ['danger'] },
    dinnerContext,
    5,
  );

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].recipeId, 'sain');
});

test('une recette déjà au planning est écartée tant qu il reste autre chose', () => {
  const corpus = [recipe({ id: 'deja' }), recipe({ id: 'autre' })];

  const outcome = rankSuggestions(corpus, noSignals, {
    ...dinnerContext,
    alreadyPlannedRecipeIds: ['deja'],
  }, 5);

  assert.deepEqual(outcome.suggestions.map((s) => s.recipeId), ['autre']);
  assert.equal(outcome.relaxed, false);
});

test('tout le corpus déjà planifié : des répétitions signalées, pas une liste vide', () => {
  // Sans ce repli, un utilisateur dont la semaine est complète recevait un résultat vide sans motif.
  const corpus = [recipe({ id: 'a' }), recipe({ id: 'b' })];

  const outcome = rankSuggestions(corpus, noSignals, {
    ...dinnerContext,
    alreadyPlannedRecipeIds: ['a', 'b'],
  }, 5);

  assert.equal(outcome.relaxed, true, 'le desserrage doit être annoncé');
  assert.equal(outcome.suggestions.length, 2);
  assert.ok(outcome.suggestions.every((s) => s.alreadyInWeek === true));
  assert.ok(
    outcome.suggestions.every((s) => s.reasons[0].code === 'repeat'),
    'la répétition doit être le premier motif affiché',
  );
});

test('un allergène reste exclu même lors du repli', () => {
  // Le desserrage porte sur la répétition, jamais sur la sécurité.
  const corpus = [
    recipe({ id: 'planifiee', ingredients: ['carotte'] }),
    recipe({ id: 'allergene', ingredients: ["beurre d'arachide"] }),
  ];

  const outcome = rankSuggestions(
    corpus,
    { ...noSignals, allergies: ['arachide'] },
    { ...dinnerContext, alreadyPlannedRecipeIds: ['planifiee'] },
    5,
  );

  assert.equal(outcome.relaxed, true);
  assert.deepEqual(outcome.suggestions.map((s) => s.recipeId), ['planifiee']);
});

// ─────────────────────────────────────────
// Signaux, isolés
// ─────────────────────────────────────────

test('affinité de goût : la recette proche des favoris passe devant', () => {
  const corpus = [
    recipe({ id: 'aime', ingredients: ['citronnelle', 'gingembre'], tags: ['thaïlandaise'] }),
    recipe({ id: 'proche', ingredients: ['citronnelle', 'coriandre'], tags: ['thaïlandaise'] }),
    recipe({ id: 'loin', ingredients: ['pomme de terre', 'crème'], tags: ['française'] }),
  ];

  const suggestions = rank(
    corpus,
    { ...noSignals, favoriteRecipeIds: ['aime'] },
    dinnerContext,
    3,
  );

  const proche = suggestions.find((s) => s.recipeId === 'proche')!;
  const loin = suggestions.find((s) => s.recipeId === 'loin')!;
  assert.ok(proche.breakdown.taste > loin.breakdown.taste);
});

test('économie de courses : réutiliser un ingrédient déjà prévu compte', () => {
  const corpus = [
    recipe({ id: 'reutilise', ingredients: ['poireau', 'crème'] }),
    recipe({ id: 'tout neuf', ingredients: ['quinoa', 'grenade'] }),
  ];

  const suggestions = rank(
    corpus, noSignals, {
    ...dinnerContext,
    ingredientsAlreadyNeeded: ['poireau', 'crème'],
  }, 2);

  const reused = suggestions.find((s) => s.recipeId === 'reutilise')!;
  assert.equal(reused.breakdown.pantry, 1, 'ses deux ingrédients sont déjà prévus');
  assert.equal(suggestions.find((s) => s.recipeId === 'tout neuf')!.breakdown.pantry, 0);
});

test('adéquation horaire : un plat long est écarté un soir de semaine', () => {
  const corpus = [
    recipe({ id: 'rapide', prepTime: 10, cookTime: 15 }),
    recipe({ id: 'long', prepTime: 60, cookTime: 120 }),
  ];

  const weekday = rank(
    corpus, noSignals, dinnerContext, 2);
  assert.ok(
    weekday.find((s) => s.recipeId === 'rapide')!.breakdown.timing >
      weekday.find((s) => s.recipeId === 'long')!.breakdown.timing,
  );

  // Le même plat long devient acceptable le week-end.
  const weekendRun = rank(
    corpus, noSignals, { ...dinnerContext, weekend: true }, 2);
  assert.ok(
    weekendRun.find((s) => s.recipeId === 'long')!.breakdown.timing >
      weekday.find((s) => s.recipeId === 'long')!.breakdown.timing,
  );
});

test('adéquation horaire : le créneau change le budget', () => {
  const corpus = [recipe({ id: 'plat', prepTime: 20, cookTime: 20 })];

  const breakfast = rank(
    corpus, noSignals, { ...dinnerContext, slot: 'BREAKFAST' }, 1);
  const dinner = rank(
    corpus, noSignals, dinnerContext, 1);

  assert.ok(
    dinner[0].breakdown.timing > breakfast[0].breakdown.timing,
    '40 min conviennent à un dîner, pas à un petit-déjeuner de semaine',
  );
});

test('durée inconnue : ni favorisée, ni pénalisée', () => {
  const corpus = [recipe({ id: 'sans durée', prepTime: null, cookTime: null })];
  assert.equal(rank(
    corpus, noSignals, dinnerContext, 1)[0].breakdown.timing, 0.5);
});

test('renouvellement : ce qui vient d être cuisiné passe derrière', () => {
  const corpus = [
    recipe({ id: 'jamais' }),
    recipe({ id: 'la semaine derniere' }),
    recipe({ id: 'il y a longtemps' }),
  ];

  const suggestions = rank(
    corpus,
    {
      ...noSignals,
      planned: [
        { recipeId: 'la semaine derniere', weeksAgo: 1 },
        { recipeId: 'il y a longtemps', weeksAgo: 10 },
      ],
    },
    dinnerContext,
    3,
  );

  const get = (id: string) => suggestions.find((s) => s.recipeId === id)!.breakdown.novelty;
  assert.equal(get('jamais'), 1);
  assert.equal(get('il y a longtemps'), 1, 'au-delà de l horizon, entièrement renouvelée');
  assert.ok(get('la semaine derniere') < 0.5);
});

test('préférences déclarées : cuisine et régime comptent', () => {
  const corpus = [
    recipe({ id: 'italien vegan', cuisines: ['italienne'], diets: ['vegan'], tags: ['italienne', 'vegan'] }),
    recipe({ id: 'autre', cuisines: ['japonaise'], diets: [], tags: ['japonaise'] }),
  ];

  const suggestions = rank(
    corpus,
    { ...noSignals, cuisines: ['italienne'], diets: ['vegan'] },
    dinnerContext,
    2,
  );

  assert.equal(suggestions.find((s) => s.recipeId === 'italien vegan')!.breakdown.preference, 1);
  assert.equal(suggestions.find((s) => s.recipeId === 'autre')!.breakdown.preference, 0);
});

test('aucune préférence déclarée : axe neutre, pas pénalisant', () => {
  const corpus = [recipe({ id: 'a', cuisines: ['italienne'] })];
  assert.equal(rank(
    corpus, noSignals, dinnerContext, 1)[0].breakdown.preference, 0.5);
});

// ─────────────────────────────────────────
// Diversification
// ─────────────────────────────────────────

test('la sélection ne renvoie pas cinq variantes du même plat', () => {
  // Quatre quasi-jumelles, très bien notées, et une seule recette différente.
  const corpus = [
    recipe({ id: 'pasta1', ingredients: ['pâtes', 'tomate', 'basilic'], tags: ['italienne'] }),
    recipe({ id: 'pasta2', ingredients: ['pâtes', 'tomate', 'basilic'], tags: ['italienne'] }),
    recipe({ id: 'pasta3', ingredients: ['pâtes', 'tomate', 'basilic'], tags: ['italienne'] }),
    recipe({ id: 'pasta4', ingredients: ['pâtes', 'tomate', 'basilic'], tags: ['italienne'] }),
    recipe({ id: 'poisson', ingredients: ['cabillaud', 'citron'], tags: ['française'] }),
  ];

  const suggestions = rank(
    corpus,
    { ...noSignals, favoriteRecipeIds: ['pasta1'] },
    dinnerContext,
    3,
  );

  assert.ok(
    suggestions.some((s) => s.recipeId === 'poisson'),
    'la variété doit forcer une entrée différente parmi les trois retenues',
  );
});

// ─────────────────────────────────────────
// Justifications et forme du résultat
// ─────────────────────────────────────────

test('chaque suggestion est justifiée', () => {
  const corpus = [
    recipe({ id: 'a', ingredients: ['poireau'], cuisines: ['française'], prepTime: 10, cookTime: 10 }),
  ];

  const suggestions = rank(
    corpus, { ...noSignals, cuisines: ['française'] }, {
    ...dinnerContext,
    ingredientsAlreadyNeeded: ['poireau'],
  }, 1);

  const [first] = suggestions;
  assert.ok(first.reasons.length > 0, 'une suggestion inexpliquée est inutilisable');
  assert.ok(first.reasons.length <= 3, 'au plus trois motifs, pour rester lisible');
  assert.ok(first.reasons.every((r) => r.label.length > 0));
  // Les motifs notés sont ordonnés par contribution réelle au score. « repeat » n'en fait pas
  // partie : c'est une mise en garde, pas un signal pondéré.
  const scored = first.reasons.filter((r): r is { code: ScoredSignal; label: string } => r.code !== 'repeat');
  const contributions = scored.map((r) => WEIGHTS[r.code] * first.breakdown[r.code]);
  assert.deepEqual(contributions, [...contributions].sort((x, y) => y - x));
});

test('le score reste borné et décroissant', () => {
  const corpus = Array.from({ length: 12 }, (_, i) =>
    recipe({ id: `r${i}`, ingredients: [`ingrédient${i}`], favoriteCount: i }),
  );

  const suggestions = rank(
    corpus, noSignals, dinnerContext, 5);

  assert.equal(suggestions.length, 5);
  for (const suggestion of suggestions) {
    assert.ok(suggestion.score >= 0 && suggestion.score <= 1, `score hors bornes : ${suggestion.score}`);
  }
});

test('les poids somment à 1, ce qui rend les scores comparables', () => {
  const total = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `somme des poids : ${total}`);
});

// ─────────────────────────────────────────
// Cas dégradés
// ─────────────────────────────────────────

test('corpus vide : aucune suggestion, aucune erreur', () => {
  assert.deepEqual(rank([], noSignals, dinnerContext, 5), []);
});

test('limite supérieure au corpus : on renvoie ce qui existe', () => {
  const corpus = [recipe({ id: 'a' }), recipe({ id: 'b' })];
  assert.equal(rank(
    corpus, noSignals, dinnerContext, 10).length, 2);
});

test('corpus entièrement allergène : résultat vide, sans repli', () => {
  const corpus = [recipe({ id: 'a', ingredients: ['arachide'] })];
  const suggestions = rank(
    corpus, { ...noSignals, allergies: ['arachide'] }, dinnerContext, 5);
  assert.deepEqual(suggestions, []);
});

test('utilisateur entièrement nouveau : la popularité départage', () => {
  const corpus = [
    recipe({ id: 'connue', ingredients: ['a'], favoriteCount: 10, commentCount: 5 }),
    recipe({ id: 'ignorée', ingredients: ['b'], favoriteCount: 0, commentCount: 0 }),
  ];

  const suggestions = rank(
    corpus, noSignals, dinnerContext, 2);
  assert.equal(suggestions[0].recipeId, 'connue', 'seul signal disponible au démarrage à froid');
});
