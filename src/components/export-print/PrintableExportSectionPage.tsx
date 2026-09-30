import SchoolLogo from '../print/SchoolLogo'
import type { ExportSectionPage } from '../../utils/exportGeneraliseAggregation'

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const PAGE_BG = 'oklch(0.99 0.003 90)'
const BORDER = 'oklch(0.9 0.005 90)'

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

function alignClass(align: string) {
  return align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
}

interface PrintableExportSectionPageProps {
  page: ExportSectionPage
  pageNum: number
  totalPages: number
}

export default function PrintableExportSectionPage({ page, pageNum, totalPages }: PrintableExportSectionPageProps) {
  return (
    <div
      className="print-page flex flex-col gap-4 px-11 py-9 text-slate-800"
      style={{ background: PAGE_BG, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <header className="grid grid-cols-3 items-start border-b-2 pb-3" style={{ borderColor: INK }}>
        <div className="flex flex-col gap-0.5">
          <p className="text-[17px] font-bold tracking-tight" style={{ color: INK }}>
            Groupe Scolaire Mondrian
          </p>
          <p className="text-[9.5px] uppercase tracking-[0.08em]" style={{ color: MUTED }}>
            École de la Bienveillance
          </p>
        </div>
        <SchoolLogo size={60} />
        <div className="flex flex-col items-end gap-0.5 text-right">
          <p className="text-[12px] font-bold" style={{ color: INK }}>
            Export Généralisé
          </p>
          <p className="text-[9.5px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-[10px] px-4 py-2.5" style={{ background: page.soft }}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
          style={{ background: page.color }}
        >
          {page.sectionNum}
        </div>
        <p className="flex-1 text-[14px] font-extrabold" style={{ color: page.color }}>
          {page.sectionName} {page.suite}
        </p>
        {page.rangeLabel && (
          <div className="shrink-0 text-[9.5px] font-semibold" style={{ color: MUTED }}>
            {page.rangeLabel}
          </div>
        )}
      </div>

      {page.hasRows ? (
        <div className="flex-1 overflow-hidden rounded-[8px] border" style={{ borderColor: BORDER }}>
          <div className="grid" style={{ gridTemplateColumns: page.cols, background: INK }}>
            {page.headers.map((h, i) => (
              <div
                key={i}
                className={`px-2 py-[6px] text-[8px] font-bold uppercase tracking-[0.04em] text-white ${alignClass(h.align)}`}
              >
                {h.label}
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: page.cols }}>
            {page.cells.map((c, i) => {
              const isBanner = c.span === '1 / -1'
              return (
                <div
                  key={i}
                  className={`truncate ${alignClass(c.align)} ${isBanner ? 'px-2 py-[5px] uppercase tracking-[0.05em]' : 'px-1 py-[3.5px]'}`}
                  style={{
                    gridColumn: isBanner ? '1 / -1' : undefined,
                    background: c.bg,
                    color: c.color,
                    fontWeight: c.weight,
                    whiteSpace: c.wrap === 'normal' ? 'normal' : 'nowrap',
                  }}
                >
                  {c.v}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div
          className="border border-dashed px-4 py-6 text-center text-[10.5px]"
          style={{ background: '#F5F4FA', borderColor: '#D6D4E3', color: '#6E7075' }}
        >
          {page.emptyMsg}
        </div>
      )}

      <div className="mt-auto border-t pt-1.5 text-[8px]" style={{ borderColor: BORDER, color: 'oklch(0.65 0.01 260)' }}>
        <div className="flex justify-between">
          <span>Groupe Scolaire Mondrian — Export Généralisé</span>
          <span>
            Page {pageNum} / {totalPages}
          </span>
        </div>
        <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
      </div>
    </div>
  )
}
