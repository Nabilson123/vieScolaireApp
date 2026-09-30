import { useState, type ReactNode } from 'react'
import { Coffee, AlertTriangle } from 'lucide-react'
import { formatHeures } from '../../utils/teacherAggregation'

export interface TimeGridSlot {
  id: string
  subject: string
  start: string
  end: string
  hours: number
  subtitle: string
}

const DEFAULT_DAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
const DEFAULT_DAY_LABELS: Record<string, string> = { LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi', JEUDI: 'Jeudi', VENDREDI: 'Vendredi' }

const PALETTE = [
  'border-indigo-300 bg-white text-indigo-700',
  'border-emerald-300 bg-white text-emerald-700',
  'border-amber-300 bg-white text-amber-700',
  'border-rose-300 bg-white text-rose-700',
  'border-sky-300 bg-white text-sky-700',
  'border-violet-300 bg-white text-violet-700',
  'border-teal-300 bg-white text-teal-700',
  'border-pink-300 bg-white text-pink-700',
]

export function colorForSubject(subject: string): string {
  let hash = 0
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hasPauseOverlap(slots: TimeGridSlot[]): boolean {
  return slots.some((s) => timeToMinutes(s.start) < timeToMinutes('13:00') && timeToMinutes('12:00') < timeToMinutes(s.end))
}

interface ScheduleTimeGridProps {
  schedule: Record<string, TimeGridSlot[]>
  days?: string[]
  dayLabels?: Record<string, string>
  startHour?: number
  endHour?: number
  dayHeaderExtra?: (day: string) => ReactNode
  renderActions?: (day: string, slot: TimeGridSlot) => ReactNode
  draggableSlots?: boolean
  onDragStartSlot?: (day: string, slotId: string) => void
  onDropDay?: (day: string, newStart: string) => void
  conflictSlotIds?: Set<string>
  minWidth?: number
  gridHeight?: number
  /** Halo "Pause" automatique sur les trous autour de midi — pertinent pour une grille par jour de
   * semaine (VENDREDI en est déjà exclu), pas pour une grille par personne où toute colonne serait
   * concernée. Désactiver pour ce second cas. */
  showLunchPause?: boolean
}

export default function ScheduleTimeGrid({
  schedule,
  days = DEFAULT_DAYS,
  dayLabels = DEFAULT_DAY_LABELS,
  startHour = 8,
  endHour = 17,
  dayHeaderExtra,
  renderActions,
  draggableSlots = false,
  onDragStartSlot,
  onDropDay,
  conflictSlotIds,
  minWidth = 640,
  gridHeight = 520,
  showLunchPause = true,
}: ScheduleTimeGridProps) {
  const [dragDurationMin, setDragDurationMin] = useState<number | null>(null)
  const hourLabels = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)
  const dayStartMin = startHour * 60
  const totalMin = (endHour - startHour) * 60
  const showPause = startHour <= 12 && endHour >= 13

  return (
    <div className="overflow-x-auto">
      <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, minWidth }}>
        <div />
        {days.map((day) => {
          const slots = schedule[day] ?? []
          const total = slots.reduce((sum, s) => sum + s.hours, 0)
          return (
            <div key={day} className="border-b border-slate-200 pb-1.5 text-center">
              <p className="text-xs font-bold uppercase text-slate-700">{dayLabels[day] ?? day}</p>
              {dayHeaderExtra?.(day)}
              <p className="text-[10px] text-slate-400">({formatHeures(total)})</p>
            </div>
          )
        })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, minWidth }}>
        <div className="relative" style={{ height: gridHeight }}>
          {hourLabels.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 -translate-y-1/2 text-[10px] text-slate-400"
              style={{ top: `${(i / (hourLabels.length - 1)) * 100}%` }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const slots = schedule[day] ?? []
          const showDayPause = showLunchPause && showPause && day !== 'VENDREDI' && !hasPauseOverlap(slots)
          return (
            <div
              key={day}
              className="relative border-l border-slate-100"
              style={{ height: gridHeight }}
              onDragOver={onDropDay ? (e) => e.preventDefault() : undefined}
              onDrop={
                onDropDay
                  ? (e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const fraction = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
                      let startMin = Math.round((dayStartMin + fraction * totalMin) / 15) * 15
                      const duration = dragDurationMin ?? 0
                      const maxStart = dayStartMin + totalMin - duration
                      startMin = Math.min(Math.max(startMin, dayStartMin), Math.max(dayStartMin, maxStart))
                      onDropDay(day, minutesToTime(startMin))
                    }
                  : undefined
              }
            >
              {hourLabels.map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-dashed border-slate-100"
                  style={{ top: `${(i / (hourLabels.length - 1)) * 100}%` }}
                />
              ))}

              {showDayPause &&
                (() => {
                  const top = ((timeToMinutes('12:00') - dayStartMin) / totalMin) * 100
                  const height = (60 / totalMin) * 100
                  return (
                    <div
                      className="absolute left-1 right-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 text-[10px] font-medium text-indigo-400"
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      <Coffee className="h-3 w-3" />
                      Pause
                    </div>
                  )
                })()}

              {slots.map((slot) => {
                const startMin = timeToMinutes(slot.start) - dayStartMin
                const endMin = timeToMinutes(slot.end) - dayStartMin
                const top = (startMin / totalMin) * 100
                const height = ((endMin - startMin) / totalMin) * 100
                const inConflict = conflictSlotIds?.has(slot.id) ?? false
                return (
                  <div
                    key={slot.id}
                    draggable={draggableSlots}
                    onDragStart={
                      draggableSlots
                        ? () => {
                            setDragDurationMin(timeToMinutes(slot.end) - timeToMinutes(slot.start))
                            onDragStartSlot?.(day, slot.id)
                          }
                        : undefined
                    }
                    className={`absolute left-1 right-1 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-[10px] ${
                      inConflict ? 'border-rose-500 bg-white text-rose-700 ring-1 ring-rose-400' : colorForSubject(slot.subject)
                    } ${draggableSlots ? 'cursor-move' : ''}`}
                    style={{ top: `${top}%`, height: `${height}%` }}
                  >
                    <div className="mb-0.5 flex items-start justify-between gap-1">
                      <p className="flex items-center gap-1 truncate font-bold">
                        {inConflict && <AlertTriangle className="h-3 w-3 shrink-0" />}
                        {slot.subject}
                      </p>
                      {renderActions && <div className="flex shrink-0 items-center gap-1">{renderActions(day, slot)}</div>}
                    </div>
                    <p className="truncate opacity-80">{slot.subtitle}</p>
                    <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-1.5">
                      <span className="opacity-70">
                        {slot.start} - {slot.end}
                      </span>
                      <span className="shrink-0 font-bold">{formatHeures(slot.hours)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
