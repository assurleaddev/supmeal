/**
 * Forme canonique d'un libellé partagé entre recettes (nom d'ingrédient, nom de tag).
 *
 * Ces libellés servent de clé d'unicité en base : sans normalisation, « Tomate », « tomate » et
 * « tomate  » créeraient trois lignes distinctes et le filtrage par ingrédient deviendrait faux.
 */
export function canonicalName(value: string): string {
  return value.toLowerCase().trim();
}
