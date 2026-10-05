/** Minuscules, sans accents, tout ce qui n'est pas lettre/chiffre devient un espace unique — pour comparer
 * des noms et des mots-clés sans se soucier de la casse, des accents ni de la ponctuation. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Mots « significatifs » d'un nom : au moins `minLen` lettres, ce qui écarte les particules (El, Al, De, Ben…). */
export function significantTokens(input: string, minLen = 3): string[] {
  return normalizeText(input)
    .split(' ')
    .filter((t) => t.length >= minLen)
}
