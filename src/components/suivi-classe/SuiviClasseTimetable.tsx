type SingleCard = {
  kind: 'single'
  key: string
  label: string
  color: string
  time: string
  ppNames: string
  statut: 'Planifié' | 'Réalisé' | 'Annulé'
  hasConflict: boolean
  top: number
  height: number
  left: string
  width: string
  selected: boolean
  onOpen: () => void
}

type GroupCard = {
  kind: 'group'
  top: number
  height: number
  chips: { key: string; label: string; color: string; onOpen: () => void }[]
}

export interface DayColumn {
  key: string
  label: string
  dateLabel: string
  count: number
  cards: (SingleCard | GroupCard)[]
}

interface SuiviClasseTimetableProps {
  days: DayColumn[]
  hourMarks: { label: string; top: number }[]
  gridHeight: number
}

const STATUT_MARK: Record<SingleCard['statut'], string> = { Planifié: '', Réalisé: '✓', Annulé: '✕' }

export default function SuiviClasseTimetable({ days, hourMarks, gridHeight }: SuiviClasseTimetableProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="grid" style={{ gridTemplateColumns: '52px repeat(5,minmax(0,1fr))' }}>
        <span />
        {days.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-0.5 pb-2.5 pt-0.5">
            <span className="text-xs font-bold tracking-wide text-slate-700">{d.label}</span>
            <span className="text-xs text-indigo-500">{d.dateLabel}</span>
            <span className="text-[11px] text-slate-400">{d.count ? `${d.count} suivi${d.count > 1 ? 's' : ''}` : '(—)'}</span>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '52px repeat(5,minmax(0,1fr))' }}>
        <div className="relative" style={{ height: gridHeight }}>
          {hourMarks.map((h) => (
            <span key={h.label} className="absolute left-0 -translate-y-1/2 text-[11px] text-slate-500" style={{ top: h.top }}>
              {h.label}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d.key} className="relative border-l border-slate-100" style={{ height: gridHeight }}>
            {hourMarks.map((h) => (
              <div key={h.label} className="absolute left-0 right-0 border-t border-dashed border-slate-100" style={{ top: h.top }} />
            ))}
            {d.cards.map((c, i) =>
              c.kind === 'single' ? (
                <button
                  key={c.key + i}
                  type="button"
                  onClick={c.onOpen}
                  title={`${c.label} · ${c.statut}`}
                  className="absolute box-border flex flex-col justify-center gap-0.5 overflow-hidden rounded-md px-1.5 py-1 text-left"
                  style={{
                    top: c.top + 1,
                    height: c.height - 2,
                    left: c.left,
                    width: c.width,
                    background: c.color + (c.statut === 'Annulé' ? '0d' : '1f'),
                    borderLeft: `3px solid ${c.color}`,
                    outline: c.selected ? `2px solid ${c.color}` : c.hasConflict ? '1.5px solid #fb923c' : 'none',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="shrink-0 text-[12px] font-bold" style={{ color: c.color }}>
                      {c.label}
                    </span>
                    <span className="flex-1" />
                    {(c.hasConflict || STATUT_MARK[c.statut]) && (
                      <span className="text-[11px] font-bold" style={{ color: c.hasConflict ? '#ea580c' : c.color }}>
                        {c.hasConflict ? '⚠' : STATUT_MARK[c.statut]}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-[10px]" style={{ color: c.color }}>
                    {c.time}
                  </span>
                  <span className="truncate text-[10px]" style={{ color: c.color }}>
                    {c.ppNames}
                  </span>
                </button>
              ) : (
                <div
                  key={'group' + i}
                  className="absolute box-border flex flex-col gap-1 rounded-md p-1.5"
                  style={{ top: c.top + 1, minHeight: c.height - 2, left: 3, width: 'calc(100% - 6px)', background: '#fffaf5', outline: '1.5px solid #fb923c', zIndex: 2 }}
                >
                  <span className="text-[11px] font-bold text-orange-700">⚠ {c.chips.length} suivis</span>
                  <div className="flex flex-wrap gap-1">
                    {c.chips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.onOpen}
                        className="flex items-center gap-1 rounded border border-white bg-white px-1 py-0.5 text-[10px] font-bold"
                        style={{ color: chip.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: chip.color }} />
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
