import SchoolLogo from '../print/SchoolLogo'
import type { GardePeriode } from '../../services/gardePeriodesService'
import type { GardeAffectation, PersonnelType } from '../../services/gardeAffectationsService'
import type { GardeCreneau } from '../../services/gardeCreneauxService'
import type { GardeEvenement } from '../../services/gardeEvenementsService'
import type { GardeFamille } from '../../services/gardeFamillesService'
import type { GardeVendredi } from '../../services/gardeVendrediService'
import type { GardePeriodeAgent } from '../../services/gardePeriodeAgentsService'
import type { GardeVendrediPresence } from '../../services/gardeVendrediPresenceService'

export interface GardePrintAgent {
  personnelType: PersonnelType
  personnelId: string
  label: string
}

interface PrintableGardePlanningProps {
  periode: GardePeriode
  agents: GardePrintAgent[]
  creneaux: GardeCreneau[]
  affectations: GardeAffectation[]
  evenements: GardeEvenement[]
  familles: GardeFamille[]
  vendredi: GardeVendredi[]
  periodeAgents: GardePeriodeAgent[]
  presence: GardeVendrediPresence[]
}

function formatDDMMYYYY(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text)
}

function agentKey(a: { personnelType: PersonnelType; personnelId: string }): string {
  return `${a.personnelType}:${a.personnelId}`
}

/** Même règle que la grille interactive (.dc.html lignes 336-341) : police bornée par le nombre
 * de créneaux couverts ET par le mot le plus long du libellé. */
function labelFs(label: string, span: number): number {
  const base = span >= 4 ? 9.5 : span === 3 ? 9 : span === 2 ? 8.5 : 7.5
  const longest = label.split(/[\s/+]+/).reduce((m, w) => Math.max(m, w.length), 0)
  const byWord = longest >= 15 ? 7 : longest >= 12 ? 7.5 : longest >= 10 ? 8.5 : base
  return Math.min(base, byWord)
}

const ROW_H = 15.5

export default function PrintableGardePlanning({
  periode,
  agents,
  creneaux,
  affectations,
  evenements,
  familles,
  vendredi,
  periodeAgents,
  presence,
}: PrintableGardePlanningProps) {
  const evenementOf = (id: string) => evenements.find((e) => e.id === id) ?? evenements[0]
  const familleOf = (key: string) => familles.find((f) => f.key === key)

  return (
    <div
      id="printable-garde-planning"
      className="print-page-landscape flex flex-col gap-2 px-7 py-5"
      style={{ background: 'oklch(0.99 0.005 90)', color: 'oklch(0.24 0.01 260)', width: 1123, height: 794 }}
    >
      <div className="relative flex items-start justify-between border-b-2 pb-2" style={{ borderColor: 'oklch(0.24 0.01 260)' }}>
        <div className="flex flex-col gap-px text-left">
          <div className="text-[19px] font-extrabold">Planning du Service Garde</div>
          <div className="text-xs font-bold" style={{ color: 'oklch(0.55 0.01 260)' }}>
            {periode.nom}
          </div>
        </div>
        <div className="absolute left-1/2 top-[-8px] -translate-x-1/2">
          <SchoolLogo size={52} />
        </div>
        <div className="flex flex-col gap-px text-right">
          <div className="text-xs font-bold">Groupe Scolaire Mondrian</div>
          <div className="text-[10px]" style={{ color: 'oklch(0.55 0.01 260)' }}>
            Du {formatDDMMYYYY(periode.dateDebut)} au {formatDDMMYYYY(periode.dateFin)}
          </div>
        </div>
      </div>

      <div className="grid gap-0.5" style={{ gridTemplateColumns: `70px repeat(${agents.length}, minmax(0,1fr))` }}>
        <div />
        {agents.map((a) => (
          <div
            key={agentKey(a)}
            className="rounded px-1 py-1 text-center font-extrabold text-white"
            style={{ background: 'oklch(0.5 0.15 264)', fontSize: '10.5px' }}
          >
            {a.label}
          </div>
        ))}
      </div>

      <div className="relative grid flex-1 gap-0.5" style={{ gridTemplateColumns: `70px repeat(${agents.length}, minmax(0,1fr))` }}>
        {creneaux.map((c, ci) => (
          <div
            key={c.id}
            className="flex items-center justify-end pr-1 text-right font-bold"
            style={{ gridColumn: 1, gridRow: ci + 1, fontSize: '7.5px', color: 'oklch(0.5 0.01 260)', minHeight: ROW_H }}
          >
            {c.debut}
          </div>
        ))}

        {agents.map((a, ai) => {
          const covered = new Set<number>()
          affectations
            .filter((b) => agentKey(b) === agentKey(a))
            .forEach((b) => {
              for (let s = b.fromIndex; s <= b.toIndex; s++) covered.add(s)
            })
          return creneaux
            .filter((_, ci) => !covered.has(ci))
            .map((c) => (
              <div
                key={`${agentKey(a)}:${c.index}`}
                className="rounded border border-dashed"
                style={{ gridColumn: ai + 2, gridRow: c.index + 1, borderColor: 'oklch(0.9 0.008 264)', minHeight: ROW_H }}
              />
            ))
        })}

        {affectations.map((b) => {
          const ai = agents.findIndex((a) => agentKey(a) === agentKey(b))
          if (ai === -1) return null
          const ev = evenementOf(b.evenementId)
          const fam = familleOf(ev.familleKey)
          const span = b.toIndex - b.fromIndex + 1
          return (
            <div
              key={b.id}
              className="flex items-center justify-center overflow-hidden rounded px-[3px] text-center"
              style={{
                gridColumn: ai + 2,
                gridRow: `${b.fromIndex + 1} / span ${span}`,
                background: fam?.soft ?? '#fff',
                borderTop: '0.5px solid oklch(0.92 0.01 264)',
                borderRight: '0.5px solid oklch(0.92 0.01 264)',
                borderBottom: '0.5px solid oklch(0.92 0.01 264)',
                borderLeft: `2px solid ${fam?.color ?? '#ccc'}`,
              }}
            >
              <span
                className="font-bold leading-[1.1]"
                style={{
                  fontSize: `${labelFs(ev.label, span)}px`,
                  color: fam?.fg ?? '#333',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  hyphens: 'auto',
                  maxWidth: '100%',
                }}
              >
                {ev.label}
              </span>
            </div>
          )
        })}
      </div>

      {vendredi.length > 0 && (
        <div>
          <p className="mb-1 font-bold" style={{ fontSize: '10px' }}>
            Permanences du Vendredi
          </p>
          <div className="flex flex-wrap gap-2">
            {vendredi.map((v) => {
              let label: string
              if (v.mode === 'note') {
                label = v.note
              } else {
                const present = periodeAgents.filter((pa) => presence.find((p) => p.vendrediId === v.id && p.periodeAgentId === pa.id)?.present)
                label = present.length === periodeAgents.length && periodeAgents.length > 0 ? 'Tous présents' : `${present.length}/${periodeAgents.length} présents`
              }
              return (
                <div
                  key={v.id}
                  className="rounded px-2 py-1"
                  style={{ background: 'oklch(0.97 0.005 90)', fontSize: '8.5px', direction: isArabic(label) ? 'rtl' : 'ltr' }}
                >
                  <span className="font-bold">{v.dateLabel}</span> — {label}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-auto pt-1 text-[8.5px]" style={{ color: 'oklch(0.65 0.01 260)', borderTop: '1px solid oklch(0.92 0.005 90)' }}>
        <div className="flex justify-between">
          <span>Groupe Scolaire Mondrian — Planning du Service Garde</span>
          <span>Édité le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
      </div>
    </div>
  )
}
