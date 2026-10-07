import SchoolLogo from '../print/SchoolLogo'
import { SCHEDULE_DAYS } from '../../data/classSchedules'
import { formatHeures } from '../../utils/teacherAggregation'

export type ScheduleOrientation = 'portrait' | 'paysage'

export interface PrintScheduleSlot {
  id: string
  subject: string
  start: string
  end: string
  hours: number
  /** Ligne secondaire du bloc : "Prof. X" (vue classe) ou "Cl X" (vue prof). */
  secondaryLabel: string
  /** Séance de soutien : bloc hachuré, hors total d'heures et hors légende des matières. */
  hatched?: boolean
}

interface PrintableScheduleLudiqueProps {
  metaLabel: string
  weekStart: Date
  weekEnd: Date
  schedule: Record<string, PrintScheduleSlot[]>
  orientation: ScheduleOrientation
  footerMessage?: string
}

const DAY_LABELS: Record<string, string> = { LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi', JEUDI: 'Jeudi', VENDREDI: 'Vendredi' }

const START_MIN = 8 * 60
/** La grille s'arrête à 17 h, sauf si un bloc (un soutien du soir, par exemple) se termine plus tard. */
const MIN_END_HOUR = 17

const SOUTIEN_STYLE = { bg: 'oklch(0.95 0.03 295)', border: 'oklch(0.7 0.14 295)', text: 'oklch(0.38 0.18 295)', icon: '🎓' }
const SOUTIEN_HATCH = 'repeating-linear-gradient(135deg, oklch(0.9 0.06 295) 0px, oklch(0.9 0.06 295) 4px, oklch(0.99 0.01 295) 4px, oklch(0.99 0.01 295) 8px)'

const DEFAULT_FOOTER_MESSAGE = '💡 Garde toujours ton emploi du temps à portée de main !'

interface SubjectStyle {
  icon: string
  bg: string
  border: string
  text: string
}

const SUBJECT_STYLES: Record<string, SubjectStyle> = {
  Français: { icon: '📕', bg: 'oklch(0.94 0.06 25)', border: 'oklch(0.8 0.1 25)', text: 'oklch(0.4 0.15 25)' },
  Mathématiques: { icon: '🔢', bg: 'oklch(0.93 0.05 264)', border: 'oklch(0.78 0.1 264)', text: 'oklch(0.38 0.15 264)' },
  'Langue Arabe': { icon: '📗', bg: 'oklch(0.94 0.06 145)', border: 'oklch(0.8 0.1 145)', text: 'oklch(0.4 0.13 145)' },
  'Histoire-Géographie': { icon: '🌍', bg: 'oklch(0.94 0.06 80)', border: 'oklch(0.8 0.11 80)', text: 'oklch(0.42 0.13 70)' },
  'Éducation Islamique': { icon: '🕌', bg: 'oklch(0.93 0.05 310)', border: 'oklch(0.78 0.1 310)', text: 'oklch(0.4 0.14 310)' },
  'Arts Plastiques': { icon: '🎨', bg: 'oklch(0.94 0.06 350)', border: 'oklch(0.8 0.1 350)', text: 'oklch(0.42 0.14 350)' },
  Sport: { icon: '⚽', bg: 'oklch(0.94 0.06 150)', border: 'oklch(0.8 0.1 150)', text: 'oklch(0.4 0.14 150)' },
  'Physique-Chimie': { icon: '⚗️', bg: 'oklch(0.93 0.05 230)', border: 'oklch(0.78 0.1 230)', text: 'oklch(0.4 0.14 230)' },
  SVT: { icon: '🌱', bg: 'oklch(0.94 0.06 165)', border: 'oklch(0.8 0.1 165)', text: 'oklch(0.4 0.13 165)' },
  Anglais: { icon: '🇬🇧', bg: 'oklch(0.94 0.06 45)', border: 'oklch(0.8 0.1 45)', text: 'oklch(0.42 0.14 45)' },
}

const FALLBACK_STYLE: SubjectStyle = { icon: '📘', bg: 'oklch(0.94 0.01 90)', border: 'oklch(0.8 0.01 90)', text: 'oklch(0.35 0.01 90)' }

function styleForSubject(subject: string): SubjectStyle {
  return SUBJECT_STYLES[subject] ?? FALLBACK_STYLE
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function topPercent(start: string, spanMin: number): string {
  return `${((timeToMinutes(start) - START_MIN) / spanMin) * 100}%`
}

function heightPercent(start: string, end: string, spanMin: number): string {
  return `${((timeToMinutes(end) - timeToMinutes(start)) / spanMin) * 100}%`
}

/** Format compact (sans espace ni "min") pour que la légende des matières tienne sur une seule ligne. */
function formatCompact(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${m}`
}

function formatDDMMYYYY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function PrintableScheduleLudique({
  metaLabel,
  weekStart,
  weekEnd,
  schedule,
  orientation,
  footerMessage = DEFAULT_FOOTER_MESSAGE,
}: PrintableScheduleLudiqueProps) {
  const isPaysage = orientation === 'paysage'
  const days = SCHEDULE_DAYS.map((day) => ({
    key: day,
    label: DAY_LABELS[day] ?? day,
    slots: schedule[day] ?? [],
    total: formatHeures((schedule[day] ?? []).filter((s) => !s.hatched).reduce((sum, s) => sum + s.hours, 0)),
  }))

  const lastEndMin = Math.max(0, ...days.flatMap((d) => d.slots.map((s) => timeToMinutes(s.end))))
  const endHour = Math.max(MIN_END_HOUR, Math.ceil(lastEndMin / 60))
  const spanMin = endHour * 60 - START_MIN
  const hourMarks = Array.from({ length: endHour - 8 + 1 }, (_, i) => 8 + i)
  const hasSoutien = days.some((d) => d.slots.some((s) => s.hatched))

  const minutesByMatiere = new Map<string, number>()
  days.forEach((d) =>
    d.slots.forEach((s) => {
      if (s.hatched) return
      minutesByMatiere.set(s.subject, (minutesByMatiere.get(s.subject) ?? 0) + Math.max(0, timeToMinutes(s.end) - timeToMinutes(s.start)))
    })
  )
  const legend = Array.from(minutesByMatiere.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([matiere, minutes]) => ({ matiere, minutes, style: styleForSubject(matiere) }))

  return (
    <div
      id="printable-schedule-ludique"
      className={`flex flex-col gap-2.5 px-7 py-5 ${isPaysage ? 'print-page-landscape' : 'print-page'}`}
      style={{ background: 'oklch(0.99 0.005 90)', color: 'oklch(0.24 0.01 260)', width: isPaysage ? 1123 : 794, height: isPaysage ? 794 : 1123 }}
    >
      <div className="relative flex items-start justify-between border-b-2 pb-2" style={{ borderColor: 'oklch(0.24 0.01 260)' }}>
        <div className="flex flex-col gap-px text-left">
          <div className="text-[19px] font-extrabold">🗓️ Emploi du Temps Hebdomadaire</div>
          <div className="text-xs font-bold" style={{ color: 'oklch(0.55 0.01 260)' }}>
            {metaLabel}
          </div>
        </div>
        <div className="absolute left-1/2 top-[-8px] -translate-x-1/2">
          <SchoolLogo size={52} />
        </div>
        <div className="flex flex-col gap-px text-right">
          <div className="text-xs font-bold">Groupe Scolaire Mondrian</div>
          <div className="text-[10px]" style={{ color: 'oklch(0.55 0.01 260)' }}>
            Du {formatDDMMYYYY(weekStart)} au {formatDDMMYYYY(weekEnd)}
          </div>
        </div>
      </div>

      <div className="flex h-[26px] gap-2">
        <div className="w-[52px] shrink-0" />
        {days.map((d) => (
          <div
            key={d.key}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] font-extrabold text-white"
            style={{ background: 'oklch(0.5 0.15 264)', fontSize: '12.5px' }}
          >
            <span>{d.label}</span>
            <span className="font-semibold" style={{ fontSize: '9.5px', opacity: 0.85 }}>
              ({d.total})
            </span>
          </div>
        ))}
      </div>

      <div className="relative flex flex-1 gap-2">
        <div className="relative w-[52px] shrink-0">
          {hourMarks.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 -translate-y-1/2 pr-1 text-right font-bold"
              style={{ top: `${((h * 60 - START_MIN) / spanMin) * 100}%`, fontSize: '9.5px', color: 'oklch(0.55 0.01 260)' }}
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
                style={{ top: `${((h * 60 - START_MIN) / spanMin) * 100}%`, borderColor: 'oklch(0.88 0.005 90)' }}
              />
            ))}
          </div>

          {days.map((d) => (
            <div key={d.key} className="relative flex-1">
              {d.slots.map((slot) => {
                const style = slot.hatched ? SOUTIEN_STYLE : styleForSubject(slot.subject)
                // Un soutien posé sur un cours : les deux se partagent la largeur au lieu de se recouvrir.
                const partage = d.slots.some((o) => o !== slot && !!o.hatched !== !!slot.hatched && timeToMinutes(slot.start) < timeToMinutes(o.end) && timeToMinutes(o.start) < timeToMinutes(slot.end))
                const horizontal = partage ? (slot.hatched ? { left: '50%' } : { right: '50%' }) : {}
                return (
                  <div
                    key={slot.id}
                    className="absolute left-0 right-0 flex flex-col items-start justify-evenly overflow-hidden rounded-[9px] px-1.5 py-1 text-left"
                    style={{
                      ...horizontal,
                      top: topPercent(slot.start, spanMin),
                      height: heightPercent(slot.start, slot.end, spanMin),
                      background: style.bg,
                      backgroundImage: slot.hatched ? SOUTIEN_HATCH : undefined,
                      border: `1px solid ${style.border}`,
                      boxShadow: '0 1px 3px oklch(0 0 0 / 0.06)',
                    }}
                  >
                    <div className="font-extrabold leading-[1.15]" style={{ fontSize: '10.5px', color: style.text }}>
                      {style.icon} {slot.subject}
                    </div>
                    <div className="font-semibold" style={{ fontSize: '8.5px', color: style.text, opacity: 0.85 }}>
                      {slot.secondaryLabel}
                    </div>
                    <div className="flex w-full items-baseline justify-between gap-1" style={{ fontSize: '9.5px', color: style.text }}>
                      <span className="font-bold opacity-90">
                        {slot.start} - {slot.end}
                      </span>
                      {!slot.hatched && <span className="shrink-0 font-extrabold">{formatHeures(slot.hours)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        className={`flex justify-center gap-1.5 overflow-hidden rounded-[10px] px-2 py-1.5 ${isPaysage && !hasSoutien ? 'flex-nowrap' : 'flex-wrap'}`}
        style={{ background: 'oklch(0.97 0.005 90)' }}
      >
        {legend.map((l) => (
          <div key={l.matiere} className="flex shrink-0 items-center gap-1 whitespace-nowrap font-bold" style={{ fontSize: '7.8px' }}>
            <span
              className="inline-block h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ background: l.style.bg, border: `1px solid ${l.style.border}` }}
            />
            <span>
              {l.style.icon} {l.matiere}
            </span>
            <span className="font-semibold" style={{ color: 'oklch(0.55 0.01 260)' }}>
              ({formatCompact(l.minutes)})
            </span>
          </div>
        ))}
        {hasSoutien && (
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap font-bold" style={{ fontSize: '7.8px' }}>
            <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-[3px]" style={{ backgroundImage: SOUTIEN_HATCH, border: `1px solid ${SOUTIEN_STYLE.border}` }} />
            <span>{SOUTIEN_STYLE.icon} Soutien scolaire</span>
          </div>
        )}
      </div>

      <div className="pt-1 text-[8.5px]" style={{ color: 'oklch(0.65 0.01 260)', borderTop: '1px solid oklch(0.92 0.005 90)' }}>
        <div className="flex justify-between">
          <span>{footerMessage}</span>
          <span>
            Groupe Scolaire Mondrian — Édité le{' '}
            {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
      </div>
    </div>
  )
}
