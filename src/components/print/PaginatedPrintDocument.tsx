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
  const headerRef = useRef<HTMLDivElement | null>(null)
  const headerRestRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)
  const [pageGroups, setPageGroups] = useState<string[][] | null>(null)

  const blocksKey = blocks.map((b) => b.key).join('|')

  useLayoutEffect(() => {
    const measure = () => {
      // Le header de la page 0 est souvent plus grand (titre, bandeau KPI...) que celui répété sur
      // les pages suivantes (mât seul) — mesurer les deux séparément évite d'appliquer le budget
      // restreint de la page 0 à toutes les pages, ce qui sous-remplirait systématiquement les
      // pages suivantes alors qu'elles ont en réalité beaucoup plus de place.
      const headerH0 = headerRef.current?.getBoundingClientRect().height ?? 0
      const headerHRest = headerRestRef.current?.getBoundingClientRect().height ?? headerH0
      const footerH = footerRef.current?.getBoundingClientRect().height ?? 0
      // Trois espaces à réserver, pas deux : en-tête → premier bloc, dernier bloc → ressort (flex-1),
      // ressort → pied de page. Le ressort garde ses deux espaces même quand il mesure 0 px ; avec
      // seulement deux espaces réservés, une page remplie à fond débordait de `gapPx` sous le A4.
      const available0 = PAGE_HEIGHT_PX - paddingYPx * 2 - headerH0 - footerH - gapPx * 3
      const availableRest = PAGE_HEIGHT_PX - paddingYPx * 2 - headerHRest - footerH - gapPx * 3
      const measured = blocks.map((b) => ({ key: b.key, height: blockRefs.current[b.key]?.getBoundingClientRect().height ?? 0, breakBefore: b.breakBefore }))
      setPageGroups(packBlocksIntoPages(measured, (pageIndex) => (pageIndex === 0 ? available0 : availableRest), gapPx))
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
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: -9999,
            width: PAGE_WIDTH_PX - paddingXPx * 2,
            visibility: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <div ref={headerRef}>{renderHeader(0, 1)}</div>
          <div ref={headerRestRef}>{renderHeader(1, 2)}</div>
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
          <div ref={footerRef}>{renderFooter(0, 1)}</div>
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
