import { z } from 'zod';

/**
 * Les formulaires HTML n'ont pas de notion de « champ absent » : un champ texte non rempli est
 * transmis comme chaîne vide, et un `<input type="number">` vide devient `NaN` dès qu'il est lu
 * avec `valueAsNumber`. Sans normalisation préalable, ces valeurs échouent sur les schémas
 * `z.string().url()` ou `z.number()` et renvoient un 400 alors que le champ est optionnel.
 *
 * Ces helpers ramènent toute valeur « vide » à `null` avant validation, ce qui correspond à la
 * représentation utilisée en base pour les colonnes nullables.
 */
function blankToNull(value: unknown): unknown {
  if (value === '' || value === undefined) return null;
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  return value;
}

/** Chaîne libre optionnelle, bornée en longueur. */
export const optionalString = (max: number) =>
  z.preprocess(blankToNull, z.string().max(max).nullable());

/** URL optionnelle — accepte l'absence de valeur, refuse une URL malformée. */
export const optionalUrl = z.preprocess(blankToNull, z.string().url().nullable());

/** Entier strictement positif optionnel (durées en minutes, etc.). */
export const optionalPositiveInt = z.preprocess(
  blankToNull,
  z.number().int().positive().nullable(),
);

/** Nombre strictement positif optionnel (quantités, pouvant être décimales). */
export const optionalPositiveNumber = z.preprocess(
  blankToNull,
  z.number().positive().nullable(),
);
