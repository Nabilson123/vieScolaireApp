import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { packBlocksIntoPages } from './paginate'

export interface PaginatedBlock {
  key: string
  node: ReactNode
  /** Commence ce bloc sur une nouvelle page. */
  breakBefore?: boolean
}

interface PaginatedPrintDocumentProps {
  blocks: PaginatedBlock[]
  renderHeader: (pageIndex: number, pageCount: number) => ReactNode
  renderFooter: (pageIndex: number, pageCount: number) => ReactNode
  pageStyle: CSSProperties
  paddingXPx: number
  paddingYPx: number
  gapPx: number
}

const PAGE_WIDTH_PX = 794
const PAGE_HEIGHT_PX = 1123

const FLEX_COLUMN: CSSProperties = { display: 'flex', flexDirection: 'column' }

/**
 * Gabarits mesurés hors écran pour l'en-tête et le pied de page. `renderHeader`/`renderFooter`
 * dépendent de `(pageIndex, pageCount)` : un document d'une seule page n'affiche pas le compteur
 * « Page X / Y », la dernière page peut porter un cachet que les autres n'ont pas, etc. Le nombre
 * de pages n'est connu qu'après la pagination, donc on mesure les deux cas — document d'une page
 * (`single`) et document de plusieurs pages (`multi`) — et on choisit le bon une fois le découpage
 * connu.
 */
const SLOTS = {
  headerSingle: { kind: 'header', pageIndex: 0, pageCount: 1 },
  footerSingle: { kind: 'footer', pageIndex: 0, pageCount: 1 },
  headerFirst: { kind: 'header', pageIndex: 0, pageCount: 2 },
  headerRest: { kind: 'header', pageIndex: 1, pageCount: 2 },
  footerFirst: { kind: 'footer', pageIndex: 0, pageCount: 2 },
  footerLast: { kind: 'footer', pageIndex: 1, pageCount: 2 },
} as const

type SlotId = keyof typeof SLOTS

/**
 * Renders `blocks` across as many A4 pages as their measured height actually needs, repeating
 * `renderHeader`/`renderFooter` on every page. A block (a card, a table row, ...) is never split
 * across a page break. Uses a hidden offscreen pass to measure real DOM heights before committing
 * the final layout, so pagination adapts to any volume of data instead of a hardcoded split point.
 */
export default function PaginatedPrintDocument({
  blocks,
  renderHeader,
  renderFooter,
  pageStyle,
  paddingXPx,
  paddingYPx,
  gapPx,
}: PaginatedPrintDocumentProps) {
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const slotRefs = useRef<Partial<Record<SlotId, HTMLDivElement | null>>>({})
  const [pageGroups, setPageGroups] = useState<string[][] | null>(null)

  const blocksKey = blocks.map((b) => b.key).join('|')

  useLayoutEffect(() => {
    const measure = () => {
      const slotH = (id: SlotId) => slotRefs.current[id]?.getBoundingClientRect().height ?? 0
      // Trois espaces à réserver, pas deux : en-tête → premier bloc, dernier bloc → ressort (flex-1),
      // ressort → pied de page. Le ressort garde ses deux espaces même quand il mesure 0 px ; avec
      // seulement deux espaces réservés, une page remplie à fond débordait de `gapPx` sous le A4.
      const available = (headerH: number, footerH: number) => PAGE_HEIGHT_PX - paddingYPx * 2 - headerH - footerH - gapPx * 3
      const measured = blocks.map((b) => ({ key: b.key, height: blockRefs.current[b.key]?.getBoundingClientRect().height ?? 0, breakBefore: b.breakBefore }))

      // Document d'une seule page : header/footer rendus avec pageCount = 1.
      const singleBudget = available(slotH('headerSingle'), slotH('footerSingle'))
      const single = packBlocksIntoPages(measured, singleBudget, gapPx)
      if (single.length <= 1) {
        setPageGroups(single)
        return
      }
      // Plusieurs pages. Le header de la page 0 est souvent plus grand (titre, bandeau KPI...) que
      // celui répété sur les pages suivantes (mât seul) — mesurer les deux séparément évite
      // d'appliquer le budget restreint de la page 0 à toutes les pages, ce qui sous-remplirait
      // systématiquement les pages suivantes. Le pied de page prend la plus grande des hauteurs
      // possibles (page courante vs dernière page) : une page de trop peu remplie vaut mieux
      // qu'une page qui déborde du A4.
      const footerH = Math.max(slotH('footerFirst'), slotH('footerLast'))
      const budget0 = available(slotH('headerFirst'), footerH)
      const budgetRest = available(slotH('headerRest'), footerH)
      setPageGroups(packBlocksIntoPages(measured, (pageIndex) => (pageIndex === 0 ? budget0 : budgetRest), gapPx))
    }
    measure()
    // Les polices web (Archivo, Source Sans 3...) peuvent encore être en cours de chargement au tout
    // premier rendu — mesurer avant qu'elles soient prêtes sous-estime la hauteur réelle du texte
    // (repli sur une police de secours, souvent plus étroite/plus courte) et fausse la pagination.
    // On remesure une fois les polices chargées ; sans risque pour les appelants déjà corrects, au
    // pire un recalcul strictement identique.
    let cancelled = false
    document.fonts?.ready?.then(() => {
      if (!cancelled) measure()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksKey])

  const nodeByKey = new Map(blocks.map((b) => [b.key, b.node]))
  const groups = pageGroups ?? [blocks.map((b) => b.key)]

  return (
    <>
      {createPortal(
        // Un portail vers document.body, pas un enfant normal : si ce composant est lui-même
        // affiché sous un ancêtre avec un transform CSS (ex. un aperçu réduit via transform:scale,
        // comme dans l'éditeur de Notes de Service), cet ancêtre devient le "containing block" de
        // tout position:absolute imbriqué — la mesure hors-écran serait alors elle-même mise à
        // l'échelle, faussant le calcul de pagination face à PAGE_HEIGHT_PX (une constante non mise
        // à l'échelle). Le portail échappe complètement à cette chaîne d'ancêtres.
        // Ce conteneur reproduit la mise en page de la vraie page, sinon les hauteurs mesurées ne sont
        // pas celles du rendu final : `pageStyle` (police, taille... héritées — la police du <body>
        // n'a pas les mêmes chasses, donc pas les mêmes retours à la ligne) et une colonne flex dont
        // chaque mesure est un élément flex. Un élément flex ne laisse pas ses marges internes fuir à
        // travers lui (pas de collapse), comme dans la vraie page.
        <div
          aria-hidden
          style={{
            ...pageStyle,
            ...FLEX_COLUMN,
            position: 'absolute',
            top: 0,
            left: -9999,
            width: PAGE_WIDTH_PX - paddingXPx * 2,
            visibility: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {(Object.keys(SLOTS) as SlotId[]).map((id) => {
            const { kind, pageIndex, pageCount } = SLOTS[id]
            return (
              // `renderHeader`/`renderFooter` renvoient souvent un fragment : dans la vraie page chaque
              // enfant est un élément flex séparé des autres par `gapPx`, d'où le même gap ici.
              <div
                key={id}
                ref={(el) => {
                  slotRefs.current[id] = el
                }}
                style={{ ...FLEX_COLUMN, gap: gapPx }}
              >
                {kind === 'header' ? renderHeader(pageIndex, pageCount) : renderFooter(pageIndex, pageCount)}
              </div>
            )
          })}
          {blocks.map((b) => (
            <div
              key={b.key}
              ref={(el) => {
                blockRefs.current[b.key] = el
              }}
            >
              {b.node}
            </div>
          ))}
        </div>,
        document.body
      )}

      {groups.map((group, pageIndex) => (
        <div
          key={pageIndex}
          className="print-page flex flex-col"
          style={{ ...pageStyle, padding: `${paddingYPx}px ${paddingXPx}px`, gap: gapPx }}
        >
          {renderHeader(pageIndex, groups.length)}
          {group.map((key) => (
            <div key={key} className="print-avoid-break">
              {nodeByKey.get(key)}
            </div>
          ))}
          <div className="flex-1" />
          {renderFooter(pageIndex, groups.length)}
        </div>
      ))}
    </>
  )
}
