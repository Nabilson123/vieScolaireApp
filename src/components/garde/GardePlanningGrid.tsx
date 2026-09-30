import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { PersonnelType, GardeAffectation } from '../../services/gardeAffectationsService'
import type { GardeCreneau } from '../../services/gardeCreneauxService'
import type { GardeEvenement } from '../../services/gardeEvenementsService'
import type { GardeFamille } from '../../services/gardeFamillesService'

export interface GridAgent {
  personnelType: PersonnelType
  personnelId: string
  label: string
}

interface GardePlanningGridProps {
  agents: GridAgent[]
  creneaux: GardeCreneau[]
  affectations: GardeAffectation[]
  evenements: GardeEvenement[]
  familles: GardeFamille[]
  editSlots: boolean
  onUpdateCreneauTime: (id: string, debut: string, fin: string) => void
  onRemoveCreneau: (index: number) => void
  onAddCreneau: () => void
  onCreateBlock: (personnelType: PersonnelType, personnelId: string, slotIndex: number) => void
  onChangeEvenement: (blockId: string, evenementId: string) => void
  onChangeRange: (blockId: string, fromIndex: number, toIndex: number) => void
  onDeleteBlock: (blockId: string) => void
  onRecolorFamille: (key: string, color: string, soft: string, fg: string) => void
}

/** Palette proposée dans le sélecteur de couleurs de la légende (.dc.html lignes 222-240). */
const PALETTE: { name: string; color: string; fg: string }[] = [
  { name: 'Rouge', color: '#FF441F', fg: '#FFFFFF' },
  { name: 'Menthe', color: '#1FFFB4', fg: '#003824' },
  { name: 'Bleu', color: '#1F6AFF', fg: '#FFFFFF' },
  { name: 'Rose', color: '#FF1F6A', fg: '#FFFFFF' },
  { name: 'Ambre', color: '#FFB41F', fg: '#3D2600' },
  { name: 'Cyan', color: '#1FFFF8', fg: '#00393A' },
  { name: 'Magenta', color: '#FF1F96', fg: '#FFFFFF' },
  { name: 'Orange', color: '#FF881F', fg: '#3D1C00' },
  { name: 'Vert', color: '#1FFF88', fg: '#00381D' },
  { name: 'Bleu vif', color: '#1F96FF', fg: '#FFFFFF' },
  { name: 'Fuchsia', color: '#FF1FCE', fg: '#FFFFFF' },
  { name: 'Framboise', color: '#FF1F5E', fg: '#FFFFFF' },
  { name: 'Vermillon', color: '#FF501F', fg: '#FFFFFF' },
  { name: 'Vert vif', color: '#1FFF50', fg: '#00330F' },
  { name: 'Azur', color: '#1FCEFF', fg: '#00303D' },
  { name: 'Gris', color: 'oklch(0.9 0.004 264)', fg: 'oklch(0.35 0.01 260)' },
  { name: 'Neutre', color: 'oklch(0.99 0.003 90)', fg: 'oklch(0.3 0.01 260)' },
]

/** Police bornée à la fois par le nombre de créneaux couverts et par le mot le plus long du
 * libellé (.dc.html lignes 336-341) — sans la borne par mot, "ACCOMPAGNEMENT"/"REMPLACEMENT" sont
 * coupés en plein milieu dans une colonne étroite. */
function labelFs(label: string, span: number): string {
  const base = span >= 4 ? 9.5 : span === 3 ? 9 : span === 2 ? 8.5 : 7.5
  const longest = label.split(/[\s/+]+/).reduce((m, w) => Math.max(m, w.length), 0)
  const byWord = longest >= 15 ? 7 : longest >= 12 ? 7.5 : longest >= 10 ? 8.5 : base
  return `${Math.min(base, byWord)}px`
}

function agentKey(a: { personnelType: PersonnelType; personnelId: string }): string {
  return `${a.personnelType}:${a.personnelId}`
}

const ROW_H = 22

export default function GardePlanningGrid({
  agents,
  creneaux,
  affectations,
  evenements,
  familles,
  editSlots,
  onUpdateCreneauTime,
  onRemoveCreneau,
  onAddCreneau,
  onCreateBlock,
  onChangeEvenement,
  onChangeRange,
  onDeleteBlock,
  onRecolorFamille,
}: GardePlanningGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [colorEditing, setColorEditing] = useState<string | null>(null)

  const evenementOf = (id: string) => evenements.find((e) => e.id === id) ?? evenements[0]
  const familleOf = (key: string) => familles.find((f) => f.key === key)
  const selected = affectations.find((b) => b.id === selectedId) ?? null
  const nbSlots = creneaux.length

  const covered = new Set<string>()
  affectations.forEach((b) => {
    for (let s = b.fromIndex; s <= b.toIndex; s++) covered.add(`${agentKey(b)}:${s}`)
  })

  const emptyCells: { agentIdx: number; slotIndex: number }[] = []
  agents.forEach((a, ai) => {
    for (let s = 0; s < nbSlots; s++) {
      if (!covered.has(`${agentKey(a)}:${s}`)) emptyCells.push({ agentIdx: ai, slotIndex: s })
    }
  })

  const gridCols = `92px repeat(${agents.length}, minmax(0, 1fr))`

  const famDefs = familles.map((f) => ({
    ...f,
    count: affectations.filter((b) => evenementOf(b.evenementId).familleKey === f.key).length,
  }))

  const charges = agents.map((a) => {
    const busy = affectations
      .filter((b) => agentKey(b) === agentKey(a) && evenementOf(b.evenementId).familleKey !== 'pause')
      .reduce((n, b) => n + (b.toIndex - b.fromIndex + 1), 0)
    const pct = nbSlots ? Math.round((busy / nbSlots) * 100) : 0
    return { label: a.label, pct }
  })

  const handleFromChange = (value: number) => {
    if (!selected) return
    const to = Math.max(value, selected.toIndex)
    onChangeRange(selected.id, value, to)
  }
  const handleToChange = (value: number) => {
    if (!selected) return
    const from = Math.min(value, selected.fromIndex)
    onChangeRange(selected.id, from, value)
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_268px]">
      <div className="overflow-hidden overflow-x-auto rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: gridCols, minWidth: 92 + agents.length * 90 }}>
          <div
            className="flex items-center rounded-md px-2 py-1.5 text-[9.5px] font-bold uppercase tracking-wide text-white"
            style={{ gridColumn: 1, gridRow: 1, background: 'oklch(0.24 0.01 260)' }}
          >
            Créneau
          </div>
          {agents.map((a, ai) => (
            <div
              key={agentKey(a)}
              className="flex items-center justify-center rounded-md px-1.5 py-1 text-center text-[11px] font-bold text-white"
              style={{ gridColumn: ai + 2, gridRow: 1, background: 'oklch(0.24 0.01 260)' }}
            >
              <span className="truncate">{a.label}</span>
            </div>
          ))}

          {creneaux.map((c, ci) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-1 rounded px-1.5 text-[9.5px] font-bold text-slate-500"
              style={{
                gridColumn: 1,
                gridRow: ci + 2,
                background: ci % 2 ? 'oklch(0.97 0.005 264)' : 'oklch(0.99 0.003 90)',
                minHeight: ROW_H,
              }}
            >
              {!editSlots && <span>{c.debut} — {c.fin}</span>}
              {editSlots && (
                <>
                  <input
                    type="time"
                    value={c.debut}
                    onChange={(e) => onUpdateCreneauTime(c.id, e.target.value, c.fin)}
                    className="w-[54px] rounded border border-slate-300 px-0.5 text-[9px]"
                  />
                  <input
                    type="time"
                    value={c.fin}
                    onChange={(e) => onUpdateCreneauTime(c.id, c.debut, e.target.value)}
                    className="w-[54px] rounded border border-slate-300 px-0.5 text-[9px]"
                  />
                  <button
                    type="button"
                    title="Supprimer ce créneau"
                    onClick={() => onRemoveCreneau(c.index)}
                    className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded bg-rose-50 text-rose-500"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}

          {emptyCells.map((e) => {
            const a = agents[e.agentIdx]
            return (
              <div
                key={`${agentKey(a)}:${e.slotIndex}`}
                onClick={() => onCreateBlock(a.personnelType, a.personnelId, e.slotIndex)}
                className="cursor-pointer rounded border border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40"
                style={{ gridColumn: e.agentIdx + 2, gridRow: e.slotIndex + 2, minHeight: ROW_H }}
              />
            )
          })}

          {affectations.map((b) => {
            const ai = agents.findIndex((a) => agentKey(a) === agentKey(b))
            if (ai === -1) return null
            const ev = evenementOf(b.evenementId)
            const fam = familleOf(ev.familleKey)
            const span = b.toIndex - b.fromIndex + 1
            const isSel = b.id === selectedId
            return (
              <div
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className="box-border flex cursor-pointer items-center justify-center overflow-hidden rounded px-[3px] py-[2px] text-center"
                style={{
                  gridColumn: ai + 2,
                  gridRow: `${b.fromIndex + 2} / span ${span}`,
                  minWidth: 0,
                  background: fam?.soft ?? '#fff',
                  borderTop: isSel ? '2px solid oklch(0.45 0.19 264)' : '1px solid oklch(0.92 0.01 264)',
                  borderRight: isSel ? '2px solid oklch(0.45 0.19 264)' : '1px solid oklch(0.92 0.01 264)',
                  borderBottom: isSel ? '2px solid oklch(0.45 0.19 264)' : '1px solid oklch(0.92 0.01 264)',
                  borderLeft: `3px solid ${fam?.color ?? '#ccc'}`,
                  boxShadow: isSel ? '0 0 0 3px oklch(0.88 0.06 264)' : 'none',
                }}
              >
                <span
                  className="font-bold leading-[1.12]"
                  style={{ fontSize: labelFs(ev.label, span), color: fam?.fg ?? '#333', overflowWrap: 'anywhere', wordBreak: 'break-word', hyphens: 'auto', maxWidth: '100%' }}
                >
                  {ev.label}
                </span>
              </div>
            )
          })}
        </div>
        {editSlots && (
          <button
            type="button"
            onClick={onAddCreneau}
            className="mt-2 flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/50"
          >
            <Plus className="h-3 w-3" />
            Créneau
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {selected ? 'Affectation sélectionnée' : 'Éditer le planning'}
          </p>
          {selected ? (
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="mb-1 block text-[9.5px] uppercase tracking-wide text-slate-500">Événement</label>
                <select
                  value={selected.evenementId}
                  onChange={(e) => onChangeEvenement(selected.id, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11.5px]"
                >
                  {evenements.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9.5px] uppercase tracking-wide text-slate-500">Début</label>
                  <select
                    value={selected.fromIndex}
                    onChange={(e) => handleFromChange(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11px]"
                  >
                    {creneaux.map((c) => (
                      <option key={c.id} value={c.index}>
                        {c.debut}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] uppercase tracking-wide text-slate-500">Fin</label>
                  <select
                    value={selected.toIndex}
                    onChange={(e) => handleToChange(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11px]"
                  >
                    {creneaux.map((c) => (
                      <option key={c.id} value={c.index}>
                        {c.fin}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10.5px] text-slate-500">
                {agents.find((a) => agentKey(a) === agentKey(selected))?.label} ·{' '}
                {creneaux.find((c) => c.index === selected.fromIndex)?.debut} →{' '}
                {creneaux.find((c) => c.index === selected.toIndex)?.fin} · {selected.toIndex - selected.fromIndex + 1} créneau
                {selected.toIndex - selected.fromIndex + 1 > 1 ? 'x' : ''}
              </div>
              <button
                type="button"
                onClick={() => {
                  onDeleteBlock(selected.id)
                  setSelectedId(null)
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Libérer ce créneau
              </button>
            </div>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              Cliquez une case vide pour créer une affectation, ou un bloc existant pour changer son événement et ses horaires.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Familles d'événements</p>
          <div className="flex flex-col gap-1.5">
            {famDefs.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Changer la couleur"
                    onClick={() => setColorEditing((k) => (k === f.key ? null : f.key))}
                    className="h-3.5 w-3.5 shrink-0 rounded"
                    style={{ background: f.color, border: '1px solid oklch(0.85 0.01 264)' }}
                  />
                  <span className="flex-1 text-[10.5px] text-slate-700">{f.label}</span>
                  <span className="text-[10px] font-bold text-slate-500">{f.count}</span>
                </div>
                {colorEditing === f.key && (
                  <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-50 p-1.5">
                    {PALETTE.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        title={p.name}
                        onClick={() => {
                          onRecolorFamille(f.key, p.color, p.color, p.fg)
                          setColorEditing(null)
                        }}
                        className="h-5 w-5 rounded"
                        style={{ background: p.color, border: `2px solid ${f.color === p.color ? 'oklch(0.35 0.01 260)' : 'oklch(0.9 0.005 264)'}` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Charge par agent</p>
          <div className="flex flex-col gap-1.5">
            {charges.map((c) => (
              <div key={c.label} className="grid grid-cols-[64px_1fr_36px] items-center gap-1.5">
                <span className="truncate text-[10px] font-semibold text-slate-700">{c.label}</span>
                <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${c.pct}%` }} />
                </span>
                <span className="text-right text-[10px] font-bold text-slate-500">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
