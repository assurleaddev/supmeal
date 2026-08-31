/**
 * Moteur de suggestion de recettes — cœur de calcul, sans accès aux données.
 *
 * Tout est fonction pure : le service qui l'appelle rassemble les données, celui-ci ne fait que
 * classer. C'est ce qui permet de le tester exhaustivement sans base.
 *
 * ─── Principe ───
 *
 * Une suggestion n'est pas un tri par popularité. Six signaux indépendants sont pondérés, chacun
 * produisant une justification lisible, et deux règles absolues filtrent en amont ce qui ne doit
 * jamais être proposé.
 *
 * Le signal central est une similarité cosinus entre le goût de l'utilisateur et la recette, sur un
 * espace d'ingrédients et de tags pondérés par IDF. La pondération est ce qui rend la mesure
 * pertinente : dans un corpus de cuisine, « sel » et « poivre » apparaissent presque partout et ne
 * disent rien de la parenté entre deux plats, alors que « jaunes d'œuf » ou « safran » sont très
 * discriminants. Sans IDF, toute similarité serait dominée par les condiments.
 */

// ─────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

/** Recette réduite à ce dont le classement a besoin. */
export interface CandidateRecipe {
  id: string;
  title: string;
  /** Noms canoniques des ingrédients. */
  ingredients: string[];
  /** Noms des tags, tous types confondus. */
  tags: string[];
  /** Tags de type CUISINE, pour la correspondance aux cuisines préférées. */
  cuisines: string[];
  /** Tags de type DIET, pour la correspondance au régime déclaré. */
  diets: string[];
  prepTime: number | null;
  cookTime: number | null;
  favoriteCount: number;
  commentCount: number;
}

/** Ce que l'utilisateur a déjà manifesté. */
export interface UserSignals {
  /** Recettes mises en favori — l'expression de goût la plus explicite. */
  favoriteRecipeIds: string[];
  /**
   * Historique de planification : identifiant de recette et ancienneté en semaines.
   * `0` signifie la semaine en cours.
   */
  planned: { recipeId: string; weeksAgo: number }[];
  /** Préférences déclarées dans les paramètres. */
  allergies: string[];
  diets: string[];
  cuisines: string[];
}

/** Le créneau à garnir, qui conditionne le temps disponible. */
export interface SuggestionContext {
  slot: MealSlot;
  /** Vrai pour un samedi ou un dimanche : on accepte des préparations plus longues. */
  weekend: boolean;
  /** Ingrédients déjà requis par le planning de la semaine, sous forme canonique. */
  ingredientsAlreadyNeeded: string[];
  /** Recettes déjà présentes dans la semaine visée : jamais resuggérées. */
  alreadyPlannedRecipeIds: string[];
}

// ─────────────────────────────────────────
// Types de sortie
// ─────────────────────────────────────────

export interface SuggestionReason {
  /**
   * Identifiant stable du signal, pour un affichage ou un tri côté client.
   *
   * `repeat` n'est pas un signal noté : c'est une mise en garde, émise seulement quand le classement
   * a dû se rabattre sur des recettes déjà présentes dans la semaine.
   */
  code: 'taste' | 'pantry' | 'timing' | 'novelty' | 'preference' | 'popularity' | 'repeat';
  /** Formulation destinée à l'utilisateur. */
  label: string;
}

/** Les six signaux réellement notés. `repeat` en est exclu : c'est une mise en garde. */
export type ScoredSignal = Exclude<SuggestionReason['code'], 'repeat'>;

export interface ScoredSuggestion {
  recipeId: string;
  title: string;
  /** Score final, borné à [0, 1]. */
  score: number;
  /** Détail par signal, utile au débogage et à la documentation. */
  breakdown: Record<ScoredSignal, number>;
  /** Justifications, du signal le plus contributif au moins. */
  reasons: SuggestionReason[];
  /** Vrai si la recette figure déjà dans la semaine visée et n'a été retenue qu'à défaut d'autre. */
  alreadyInWeek?: boolean;
}

/** Ce que le classement a produit, et s'il a dû desserrer ses contraintes. */
export interface RankingOutcome {
  suggestions: ScoredSuggestion[];
  /**
   * Vrai lorsque toutes les recettes éligibles étaient déjà au planning et qu'il a fallu les
   * réintroduire. Rendre ce fait explicite vaut mieux que de renvoyer une liste vide sans motif.
   */
  relaxed: boolean;
}

// ─────────────────────────────────────────
// Paramètres du classement
// ─────────────────────────────────────────

/**
 * Poids des six signaux. Ils somment à 1 pour que le score reste dans [0, 1] et donc comparable
 * d'une requête à l'autre.
 *
 * Le goût domine, parce que c'est le seul signal réellement personnel. L'économie de courses vient
 * ensuite : dans un outil de planification, réutiliser un ingrédient déjà nécessaire a une valeur
 * concrète et immédiate. La popularité ne pèse presque rien — elle ne sert qu'à départager quand
 * l'utilisateur est nouveau et que tous les autres signaux sont muets.
 */
export const WEIGHTS: Record<ScoredSignal, number> = {
  taste: 0.34,
  pantry: 0.2,
  timing: 0.15,
  novelty: 0.12,
  preference: 0.14,
  popularity: 0.05,
};

/**
 * Budget de temps total, en minutes, par créneau. Un petit-déjeuner de deux heures n'a pas de sens
 * un mardi ; un dîner de fin de semaine peut en prendre le temps.
 */
const TIME_BUDGET: Record<MealSlot, { weekday: number; weekend: number }> = {
  BREAKFAST: { weekday: 15, weekend: 40 },
  LUNCH: { weekday: 30, weekend: 75 },
  DINNER: { weekday: 50, weekend: 120 },
  SNACK: { weekday: 15, weekend: 30 },
};

/** Un favori pèse trois fois un repas simplement planifié : le geste est délibéré. */
const FAVORITE_WEIGHT = 3;
const PLANNED_WEIGHT = 1;

/** Demi-vie de l'historique de planification, en semaines. */
const HISTORY_HALF_LIFE = 6;

/** Au-delà, une recette jamais revue est considérée comme entièrement renouvelée. */
const NOVELTY_HORIZON_WEEKS = 8;

/**
 * Arbitrage entre pertinence et variété lors de la sélection finale.
 * 0 = pertinence pure, 1 = variété pure.
 */
const DIVERSITY_TRADEOFF = 0.3;

// ─────────────────────────────────────────
// Vectorisation
// ─────────────────────────────────────────

/** Les termes d'une recette : ses ingrédients et ses tags, dans un même espace. */
function termsOf(recipe: CandidateRecipe): string[] {
  return [
    ...recipe.ingredients.map((name) => `i:${name}`),
    ...recipe.tags.map((name) => `t:${name}`),
  ];
}

/**
 * Fréquence inverse de document.
 *
 * `ln(1 + N / (1 + df))` : décroît quand le terme se répand, reste positif, et ne diverge pas sur un
 * terme présent partout.
 */
export function computeIdf(corpus: CandidateRecipe[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();

  for (const recipe of corpus) {
    for (const term of new Set(termsOf(recipe))) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  const total = corpus.length;

  for (const [term, df] of documentFrequency) {
    idf.set(term, Math.log(1 + total / (1 + df)));
  }

  return idf;
}

type Vector = Map<string, number>;

function normalize(vector: Vector): Vector {
  let sumOfSquares = 0;
  for (const value of vector.values()) sumOfSquares += value * value;

  const norm = Math.sqrt(sumOfSquares);
  if (norm === 0) return vector;

  const unit: Vector = new Map();
  for (const [term, value] of vector) unit.set(term, value / norm);
  return unit;
}

function recipeVector(recipe: CandidateRecipe, idf: Map<string, number>): Vector {
  const vector: Vector = new Map();
  for (const term of new Set(termsOf(recipe))) {
    vector.set(term, idf.get(term) ?? 0);
  }
  return normalize(vector);
}

function cosine(a: Vector, b: Vector): number {
  // Parcourir le plus petit des deux : les vecteurs sont très creux.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];

  let dot = 0;
  for (const [term, value] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += value * other;
  }

  return dot;
}

/**
 * Profil de goût : barycentre pondéré des recettes que l'utilisateur a favorisées ou planifiées.
 *
 * L'historique décroît exponentiellement — ce qu'on cuisinait il y a six mois pèse moitié moins que
 * le mois dernier. Sans cette décroissance, un profil se figerait sur les premiers choix.
 */
export function buildTasteProfile(
  corpus: CandidateRecipe[],
  signals: UserSignals,
  idf: Map<string, number>,
): Vector {
  const byId = new Map(corpus.map((recipe) => [recipe.id, recipe]));
  const profile: Vector = new Map();

  const contribute = (recipe: CandidateRecipe, weight: number) => {
    for (const term of new Set(termsOf(recipe))) {
      const value = (idf.get(term) ?? 0) * weight;
      profile.set(term, (profile.get(term) ?? 0) + value);
    }
  };

  for (const id of signals.favoriteRecipeIds) {
    const recipe = byId.get(id);
    if (recipe) contribute(recipe, FAVORITE_WEIGHT);
  }

  for (const { recipeId, weeksAgo } of signals.planned) {
    const recipe = byId.get(recipeId);
    if (!recipe) continue;
    const decay = Math.pow(0.5, Math.max(0, weeksAgo) / HISTORY_HALF_LIFE);
    contribute(recipe, PLANNED_WEIGHT * decay);
  }

  return normalize(profile);
}

// ─────────────────────────────────────────
// Signaux
// ─────────────────────────────────────────

/** Part des ingrédients de la recette déjà nécessaires cette semaine. */
function pantryOverlap(recipe: CandidateRecipe, alreadyNeeded: Set<string>): number {
  if (recipe.ingredients.length === 0 || alreadyNeeded.size === 0) return 0;

  const shared = recipe.ingredients.filter((name) => alreadyNeeded.has(name)).length;
  return shared / recipe.ingredients.length;
}

/**
 * Adéquation au temps disponible.
 *
 * Sous le budget, l'adéquation est totale ; au-delà elle décroît proportionnellement plutôt que de
 * tomber à zéro — une recette dix minutes trop longue reste envisageable, pas une de trois heures.
 */
function timingFit(recipe: CandidateRecipe, context: SuggestionContext): number {
  const total = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  if (total === 0) return 0.5; // durée inconnue : ni favorisée, ni pénalisée

  const budget = TIME_BUDGET[context.slot][context.weekend ? 'weekend' : 'weekday'];
  return total <= budget ? 1 : budget / total;
}

/** Renouvellement : une recette jamais planifiée, ou de longue date, vaut mieux qu'une répétition. */
function novelty(recipeId: string, planned: UserSignals['planned']): number {
  const occurrences = planned.filter((entry) => entry.recipeId === recipeId);
  if (occurrences.length === 0) return 1;

  const mostRecent = Math.min(...occurrences.map((entry) => entry.weeksAgo));
  return Math.min(1, mostRecent / NOVELTY_HORIZON_WEEKS);
}

/**
 * Correspondance aux préférences déclarées.
 *
 * Les axes non renseignés sont ignorés au lieu de compter comme un échec : un utilisateur qui n'a
 * déclaré aucune cuisine ne doit pas voir toutes les recettes pénalisées de la même façon.
 */
function preferenceMatch(recipe: CandidateRecipe, signals: UserSignals): number {
  const scores: number[] = [];

  if (signals.cuisines.length > 0) {
    scores.push(recipe.cuisines.some((c) => signals.cuisines.includes(c)) ? 1 : 0);
  }

  if (signals.diets.length > 0) {
    scores.push(recipe.diets.some((d) => signals.diets.includes(d)) ? 1 : 0);
  }

  if (scores.length === 0) return 0.5;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

/** Popularité, comprimée logarithmiquement et ramenée au maximum du corpus. */
function popularity(recipe: CandidateRecipe, maxSignal: number): number {
  if (maxSignal <= 0) return 0;
  const raw = Math.log1p(recipe.favoriteCount + recipe.commentCount);
  return raw / maxSignal;
}

// ─────────────────────────────────────────
// Filtres absolus
// ─────────────────────────────────────────

/**
 * Un allergène déclaré exclut la recette, sans pondération possible.
 *
 * La correspondance est par inclusion sur les formes canoniques : « arachide » doit écarter
 * « beurre d'arachide », qu'une égalité stricte laisserait passer.
 */
export function containsAllergen(recipe: CandidateRecipe, allergies: string[]): string | null {
  for (const allergen of allergies) {
    const needle = allergen.trim().toLowerCase();
    if (needle.length === 0) continue;
    if (recipe.ingredients.some((name) => name.includes(needle))) return allergen;
  }
  return null;
}

// ─────────────────────────────────────────
// Classement
// ─────────────────────────────────────────

/** Formulations des justifications, du plus au moins parlant. */
function describe(code: ScoredSignal, recipe: CandidateRecipe, value: number): string {
  switch (code) {
    case 'taste':
      return 'Proche des recettes que vous aimez';
    case 'pantry': {
      const percent = Math.round(value * 100);
      return `${percent} % de ses ingrédients sont déjà prévus cette semaine`;
    }
    case 'timing': {
      const total = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
      if (total === 0) return 'Durée non renseignée';
      // Ne revendiquer la compatibilité que lorsqu'elle est réelle : le signal est aussi émis à
      // partir d'un ajustement partiel, et annoncer « compatible » pour un plat qui dépasse le
      // budget serait une justification fausse.
      return value >= 1
        ? `Tient en ${total} min, compatible avec ce créneau`
        : `${total} min — un peu long pour ce créneau`;
    }
    case 'novelty':
      return 'Vous ne l’avez pas cuisinée depuis longtemps';
    case 'preference':
      return 'Correspond à vos préférences culinaires';
    case 'popularity':
      return 'Appréciée dans vos cookbooks';
  }
}

/** Seuil en dessous duquel un signal n'est pas jugé digne d'être invoqué. */
const REASON_THRESHOLD = 0.25;

/** Au-delà, la liste de motifs cesse d'être lisible d'un coup d'œil. */
const MAX_REASONS = 3;

interface Ranked extends ScoredSuggestion {
  vector: Vector;
}

/**
 * Classe les candidats, puis sélectionne en arbitrant pertinence et variété.
 *
 * La sélection finale n'est pas un simple « les N meilleurs » : les scores les plus élevés se
 * ressemblent souvent beaucoup, et proposer cinq variantes du même plat n'aide personne. Une
 * pertinence marginale maximale retire, à chaque tour, le candidat qui maximise son score diminué de
 * sa ressemblance avec ce qui est déjà retenu.
 */
export function rankSuggestions(
  corpus: CandidateRecipe[],
  signals: UserSignals,
  context: SuggestionContext,
  limit: number,
): RankingOutcome {
  const idf = computeIdf(corpus);
  const profile = buildTasteProfile(corpus, signals, idf);

  const alreadyNeeded = new Set(context.ingredientsAlreadyNeeded);
  const alreadyInWeek = new Set(context.alreadyPlannedRecipeIds);

  const maxPopularitySignal = Math.max(
    0,
    ...corpus.map((recipe) => Math.log1p(recipe.favoriteCount + recipe.commentCount)),
  );

  const score = (recipe: CandidateRecipe): Ranked => {
    const vector = recipeVector(recipe, idf);

    const breakdown: ScoredSuggestion['breakdown'] = {
      taste: cosine(profile, vector),
      pantry: pantryOverlap(recipe, alreadyNeeded),
      timing: timingFit(recipe, context),
      novelty: novelty(recipe.id, signals.planned),
      preference: preferenceMatch(recipe, signals),
      popularity: popularity(recipe, maxPopularitySignal),
    };

    let total = 0;
    for (const code of Object.keys(WEIGHTS) as ScoredSignal[]) {
      total += WEIGHTS[code] * breakdown[code];
    }

    const reasons: SuggestionReason[] = (Object.keys(breakdown) as ScoredSignal[])
      .filter((code) => breakdown[code] >= REASON_THRESHOLD)
      // Trier par contribution réelle au score, non par valeur brute du signal.
      .sort((a, b) => WEIGHTS[b] * breakdown[b] - WEIGHTS[a] * breakdown[a])
      .slice(0, MAX_REASONS)
      .map((code) => ({ code, label: describe(code, recipe, breakdown[code]) }));

    const inWeek = alreadyInWeek.has(recipe.id);
    if (inWeek) {
      // La mise en garde passe devant et prend une place : trois lignes au total restent lisibles.
      reasons.unshift({ code: 'repeat', label: 'Déjà prévue cette semaine' });
      reasons.length = Math.min(reasons.length, MAX_REASONS);
    }

    return {
      recipeId: recipe.id,
      title: recipe.title,
      score: total,
      breakdown,
      reasons,
      ...(inWeek ? { alreadyInWeek: true } : {}),
      vector,
    };
  };

  // Un allergène déclaré est le seul motif d'exclusion absolue : c'est une question de sécurité,
  // pas de préférence.
  const safe = corpus.filter((recipe) => !containsAllergen(recipe, signals.allergies));

  const fresh = safe.filter((recipe) => !alreadyInWeek.has(recipe.id));

  /**
   * « Déjà au planning » est une forte préférence, pas une interdiction : répéter un plat dans la
   * semaine est légitime. Si tout le corpus est déjà planifié, mieux vaut proposer des répétitions
   * signalées comme telles que de rendre une liste vide sans explication.
   */
  const relaxed = fresh.length === 0 && safe.length > 0;
  const pooled = relaxed ? safe : fresh;

  const ranked: Ranked[] = pooled.map(score);
  ranked.sort((a, b) => b.score - a.score);

  // Pertinence marginale maximale.
  const selected: Ranked[] = [];
  const pool = [...ranked];

  while (selected.length < limit && pool.length > 0) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const redundancy = selected.length
        ? Math.max(...selected.map((chosen) => cosine(candidate.vector, chosen.vector)))
        : 0;

      const value = (1 - DIVERSITY_TRADEOFF) * candidate.score - DIVERSITY_TRADEOFF * redundancy;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    selected.push(pool.splice(bestIndex, 1)[0]);
  }

  return {
    suggestions: selected.map(({ vector: _vector, ...suggestion }) => suggestion),
    relaxed,
  };
}
