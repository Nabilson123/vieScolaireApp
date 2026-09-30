import SchoolLogo from '../print/SchoolLogo'
import { SCHEDULE_DAYS, timeToMinutes, minutesToTime } from '../../data/classSchedules'
import { JOUR_LABELS } from './SuiviClasseTab'

export interface PrintSuiviClasseSlot {
  key: string
  label: string
  color: string
  jour: string
  start: string
  duree: number
  ppNames: string
}

interface PrintableSuiviClasseScheduleProps {
  slots: PrintSuiviClasseSlot[]
}

const MARGIN_MIN = 20

function formatDDMMYYYY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function PrintableSuiviClasseSchedule({ slots }: PrintableSuiviClasseScheduleProps) {
  const starts = slots.map((s) => timeToMinutes(s.start))
  const ends = slots.map((s) => timeToMinutes(s.start) + s.duree)
  const dayStart = slots.length ? Math.max(0, Math.floor(Math.min(...starts) - MARGIN_MIN)) : 8 * 60
  const dayEnd = slots.length ? Math.ceil(Math.max(...ends) + MARGIN_MIN) : 13 * 60
  const span = Math.max(60, dayEnd - dayStart)

  // Ne garde que les heures rondes réellement comprises dans [dayStart, dayEnd] — un simple
  // floor/ceil sur les bornes (non alignées sur l'heure) pouvait produire un repère hors grille
  // (top négatif au-dessus de l'en-tête, ou au-delà de 100% sous le tableau).
  const hourMarks: number[] = []
  for (let h = 0; h < 24; h++) {
    const t = h * 60
    if (t >= dayStart && t <= dayEnd) hourMarks.push(h)
  }

  const days = SCHEDULE_DAYS.map((day) => ({
    key: day,
    label: JOUR_LABELS[day] ?? day,
    slots: slots.filter((s) => s.jour === day),
  }))

  return (
    <div
      id="printable-suivi-classe-schedule"
      className="print-page-landscape flex flex-col gap-3 px-8 py-6"
      style={{ background: 'oklch(0.99 0.005 90)', color: 'oklch(0.24 0.01 260)', width: 1123, height: 794 }}
    >
      <div className="relative flex items-start justify-between border-b-2 pb-2.5" style={{ borderColor: 'oklch(0.24 0.01 260)' }}>
        <div className="flex flex-col gap-px text-left">
          <div className="text-[19px] font-extrabold">Suivi de Classe — Emploi du Temps</div>
          <div className="text-xs font-bold" style={{ color: 'oklch(0.55 0.01 260)' }}>
            Réunions hebdomadaires par niveau avec les Professeurs Principaux
          </div>
        </div>
        <div className="absolute left-1/2 top-[-8px] -translate-x-1/2">
          <SchoolLogo size={52} />
        </div>
        <div className="flex flex-col gap-px text-right">
          <div className="text-xs font-bold">Groupe Scolaire Mondrian</div>
          <div className="text-[10px]" style={{ color: 'oklch(0.55 0.01 260)' }}>
            Édité le {formatDDMMYYYY(new Date())}
          </div>
        </div>
      </div>

      <div className="flex h-[26px] gap-2">
        <div className="w-[56px] shrink-0" />
        {days.map((d) => (
          <div
            key={d.key}
            className="flex flex-1 items-center justify-center rounded-[10px] font-extrabold text-white"
            style={{ background: 'oklch(0.5 0.15 264)', fontSize: '13px' }}
          >
            {d.label}
          </div>
        ))}
      </div>

      <div className="relative flex" style={{ height: 480 }}>
        <div className="relative w-[56px] shrink-0">
          {hourMarks.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 -translate-y-1/2 pr-1.5 text-right font-bold"
              style={{ top: `${((h * 60 - dayStart) / span) * 100}%`, fontSize: '10px', color: 'oklch(0.55 0.01 260)' }}
            >
              {h}:00
            </div>
          ))}
        </div>

        <div className="relative flex flex-1 gap-2">
          <div className="absolute inset-0">
            {hourMarks.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-dashed"
                style={{ top: `${((h * 60 - dayStart) / span) * 100}%`, borderColor: 'oklch(0.88 0.005 90)' }}
              />
            ))}
          </div>

          {days.map((d) => {
            // Regroupe les créneaux qui se chevauchent réellement (même jour, intervalles
            // sécants) pour les positionner côte à côte plutôt que superposés et illisibles.
            const clusters: PrintSuiviClasseSlot[][] = []
            d.slots
              .slice()
              .sort((a, b) => a.start.localeCompare(b.start))
              .forEach((slot) => {
                const s = timeToMinutes(slot.start)
                const e = s + slot.duree
                const cluster = clusters.find((c) =>
                  c.some((o) => {
                    const oS = timeToMinutes(o.start)
                    const oE = oS + o.duree
                    return oS < e && oE > s
                  })
                )
                if (cluster) cluster.push(slot)
                else clusters.push([slot])
              })
            return (
              <div key={d.key} className="relative flex-1">
                {clusters.map((cluster) =>
                  cluster.map((slot, i) => {
                    const s = timeToMinutes(slot.start)
                    const e = s + slot.duree
                    return (
                      <div
                        key={slot.key}
                        className="absolute box-border flex flex-col items-start justify-center overflow-hidden rounded-[9px] px-2 py-1 text-left"
                        style={{
                          top: `${((s - dayStart) / span) * 100}%`,
                          height: `${Math.max(((e - s) / span) * 100, 8)}%`,
                          left: `calc(${(i * 100) / cluster.length}% + 2px)`,
                          width: `calc(${100 / cluster.length}% - 4px)`,
                          background: slot.color + '1f',
                          borderLeft: `3px solid ${slot.color}`,
                          boxShadow: '0 1px 3px oklch(0 0 0 / 0.06)',
                        }}
                      >
                        {/* Noms des PP volontairement absents du bloc (trop peu de place sur un
                        créneau de 30 min) — déjà lisibles dans la légende en bas de page. */}
                        <div className="truncate font-extrabold leading-[1.2]" style={{ fontSize: '11px', color: slot.color }}>
                          {slot.label}
                        </div>
                        <div className="truncate font-bold leading-[1.2]" style={{ fontSize: '9.5px', color: slot.color, opacity: 0.9 }}>
                          {slot.start}–{minutesToTime(e)}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[10px] px-2 py-1.5" style={{ background: 'oklch(0.97 0.005 90)' }}>
        {slots.map((s) => (
          <div key={s.key} className="flex shrink-0 items-center gap-1 whitespace-nowrap font-bold" style={{ fontSize: '9px' }}>
            <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-[3px]" style={{ background: s.color + '1f', border: `1px solid ${s.color}` }} />
            <span>{s.label}</span>
            <span className="font-semibold" style={{ color: 'oklch(0.55 0.01 260)' }}>
              — {s.ppNames}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-1 text-[8.5px]" style={{ color: 'oklch(0.65 0.01 260)', borderTop: '1px solid oklch(0.92 0.005 90)' }}>
        <div className="flex justify-between">
          <span>Créneau hebdomadaire habituel — susceptible d'ajustement ponctuel selon les disponibilités.</span>
          <span>Groupe Scolaire Mondrian — Édité le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
      </div>
    </div>
  )
}
