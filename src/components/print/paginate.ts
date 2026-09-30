export interface MeasuredBlock {
  key: string
  height: number
  /** Force le bloc en haut d'une nouvelle page (sauf si la page courante est encore vide). */
  breakBefore?: boolean
}

/**
 * Greedily packs blocks (in order) into pages of at most `availableHeight`, never splitting
 * a block. A single block taller than `availableHeight` is placed alone on its own page rather
 * than causing an infinite loop. `availableHeight` may vary per page (e.g. a taller page-0 header
 * leaves less room than the shorter header repeated on later pages) by passing a function instead
 * of a fixed number. A block with `breakBefore` always starts a new page.
 */
export function packBlocksIntoPages(
  blocks: MeasuredBlock[],
  availableHeight: number | ((pageIndex: number) => number),
  gap: number
): string[][] {
  const budgetFor = typeof availableHeight === 'function' ? availableHeight : () => availableHeight
  const pages: string[][] = [[]]
  let used = 0
  for (const block of blocks) {
    const pageIndex = pages.length - 1
    const currentPage = pages[pageIndex]
    const budget = budgetFor(pageIndex)
    const withGap = currentPage.length > 0 ? block.height + gap : block.height
    if ((block.breakBefore || used + withGap > budget) && currentPage.length > 0) {
      pages.push([block.key])
      used = block.height
    } else {
      currentPage.push(block.key)
      used += withGap
    }
  }
  return pages
}
