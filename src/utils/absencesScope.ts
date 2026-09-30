export const TOUTE_ETABLISSEMENT = "Toute l'établissement"

export function classeScopeLabel(classe: string): string {
  return classe === TOUTE_ETABLISSEMENT ? "Toute l'Établissement" : `Classe ${classe}`
}
