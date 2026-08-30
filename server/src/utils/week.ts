/**
 * Calcul des semaines de planification.
 *
 * Les bornes de semaine sont une règle métier (la semaine SUPMEAL commence le lundi) et le client
 * ne doit pas les recalculer : il demande une semaine par décalage relatif et reçoit ses bornes.
 *
 * Tout est calculé en UTC car les colonnes `weekStart` et `date` sont de type `@db.Date` : passer
 * par l'heure locale décalerait la journée pour les fuseaux à l'est de Greenwich.
 */

/** Lundi (00:00 UTC) de la semaine contenant `reference`. */
export function startOfWeek(reference: Date = new Date()): Date {
  const date = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );

  // getUTCDay() renvoie 0 pour dimanche : ce jour appartient à la semaine commencée 6 jours plus tôt.
  const dayOfWeek = date.getUTCDay();
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  date.setUTCDate(date.getUTCDate() + offsetToMonday);
  return date;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Format `YYYY-MM-DD`, celui attendu par les colonnes `@db.Date`. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Les 7 jours d'une semaine, du lundi au dimanche inclus. */
export function weekDays(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => toDateString(addDays(weekStart, index)));
}

/**
 * Bornes de la semaine située à `offset` semaines de la semaine courante.
 * `offset: 0` = semaine en cours, `-1` = précédente, `1` = suivante.
 */
export function resolveWeek(offset = 0) {
  const weekStart = addDays(startOfWeek(), offset * 7);
  const weekEnd = addDays(weekStart, 6);

  return {
    weekStart,
    weekEnd,
    weekStartString: toDateString(weekStart),
    weekEndString: toDateString(weekEnd),
    days: weekDays(weekStart),
  };
}
