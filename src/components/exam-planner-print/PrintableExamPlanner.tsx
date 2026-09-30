import SchoolLogo from '../print/SchoolLogo'
import type { ExamSession } from '../../data/examPlanner'
import { getTeachersSnapshot } from '../../services/teachersService'
import { groupSessionsByCycle } from '../../utils/examPlannerAggregation'

interface PrintableExamPlannerProps {
  sessions: ExamSession[]
}

const CYCLE_LABEL_AR: Record<string, string> = {
  maternelle: 'التعليم الأولي',
  primaire: 'السلك الابتدائي',
  college: 'السلك الإعدادي',
  lycee: 'السلك الثانوي',
  autre: 'أخرى',
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

function jourAr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ar', { weekday: 'long' })
}

function dateNumerique(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatDureeAr(heures: number): string {
  const totalMinutes = Math.round(heures * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h} س` : `${h} س ${m}`
}

const INDIGO = 'oklch(0.5 0.15 264)'
const INDIGO_DARK = 'oklch(0.4 0.13 264)'
const INDIGO_SOFT_BG = 'oklch(0.985 0.005 264)'
const TEAL = 'oklch(0.65 0.12 180)'
const AMBER_BG = 'oklch(0.96 0.03 60)'
const AMBER_TEXT = 'oklch(0.45 0.08 60)'
const GRID_LINE = 'oklch(0.8 0.005 90)'
const TEXT_MUTED = 'oklch(0.55 0.01 260)'

export default function PrintableExamPlanner({ sessions }: PrintableExamPlannerProps) {
  const cycles = groupSessionsByCycle(sessions, getTeachersSnapshot())

  if (cycles.length === 0) {
    return (
      <div id="printable-exam-planner" dir="rtl" className="print-page bg-white px-10 py-8 text-center text-sm italic text-slate-400">
        لا توجد امتحانات مبرمجة.
      </div>
    )
  }

  return (
    <>
      {cycles.map((cycle, cycleIdx) => {
        const totalRows = cycle.days.reduce((sum, d) => sum + d.periods.reduce((s, p) => s + p.rows.length, 0), 0)
        let dayIndex = -1

        return (
          <div
            key={cycle.cycleKey}
            id={cycleIdx === 0 ? 'printable-exam-planner' : undefined}
            dir="rtl"
            className="print-page flex flex-col gap-3.5 px-10 py-8"
            style={{ background: 'oklch(0.99 0.005 90)', color: 'oklch(0.24 0.01 260)' }}
          >
            <div className="relative flex items-start justify-between border-b-2 pb-3" style={{ borderColor: 'oklch(0.24 0.01 260)' }}>
              <div className="flex flex-col gap-0.5 text-right">
                <div className="text-[17px] font-bold">📋 الجدولة الزمنية للحراسة</div>
                <div className="text-center text-sm font-extrabold" style={{ color: TEXT_MUTED }}>
                  {CYCLE_LABEL_AR[cycle.cycleKey] ?? cycle.cycleLabelFr}
                </div>
              </div>
              <div className="absolute left-1/2 top-0 -translate-x-1/2">
                <SchoolLogo size={60} />
              </div>
              <div className="flex flex-col gap-0.5 text-left">
                <div className="text-xs font-bold">Groupe Scolaire Mondrian</div>
                <div className="text-[10px]" style={{ color: TEXT_MUTED }}>
                  {todayFR()}
                </div>
              </div>
            </div>

            <div
              className="rounded-xl px-4 py-2.5 text-center text-[14.5px] font-bold"
              style={{ background: `linear-gradient(135deg, oklch(0.94 0.05 264), oklch(0.95 0.05 180))` }}
            >
              القاعة : {cycle.salleLabel}
            </div>

            <table
              className="w-full border-collapse overflow-hidden rounded-xl text-[10.5px]"
              style={{ border: `1px solid ${GRID_LINE}`, boxShadow: '0 1px 5px oklch(0 0 0 / 0.06)' }}
            >
              <thead>
                <tr style={{ background: INDIGO, color: 'white' }}>
                  <th className="p-2.5 text-center text-[9.5px] font-bold" style={{ border: `1px solid ${INDIGO_DARK}` }}>
                    📅 التاريخ
                  </th>
                  <th className="p-2.5 text-center text-[9.5px] font-bold" style={{ border: `1px solid ${INDIGO_DARK}` }}>
                    🕓 الفترة
                  </th>
                  <th className="p-2.5 text-center text-[9.5px] font-bold" style={{ border: `1px solid ${INDIGO_DARK}` }}>
                    📖 المواد
                  </th>
                  <th className="p-2.5 text-center text-[9.5px] font-bold" style={{ border: `1px solid ${INDIGO_DARK}` }}>
                    👩‍🏫 أساتذة الحراسة
                  </th>
                  <th className="p-2.5 text-center text-[9.5px] font-bold" style={{ border: `1px solid ${INDIGO_DARK}` }} colSpan={2}>
                    🕘 التوقيت
                  </th>
                  <th className="p-2.5 text-center text-[9.5px] font-bold" style={{ border: `1px solid ${INDIGO_DARK}` }}>
                    ⏱️ المدة
                  </th>
                </tr>
              </thead>
              <tbody>
                {cycle.days.map((day) => {
                  dayIndex += 1
                  const rowBg = dayIndex % 2 === 0 ? 'white' : INDIGO_SOFT_BG
                  const dayRowSpan = day.periods.reduce((sum, p) => sum + p.rows.length, 0)
                  let rowInDay = -1

                  return day.periods.map((period) =>
                    period.rows.map((row, rowIdxInPeriod) => {
                      rowInDay += 1
                      const isFirstRowOfDay = rowInDay === 0
                      const isFirstRowOfPeriod = rowIdxInPeriod === 0
                      return (
                        <tr key={`${day.date}-${period.period}-${row.start}-${row.matiere}`} style={{ background: rowBg }}>
                          {isFirstRowOfDay && (
                            <td
                              rowSpan={dayRowSpan}
                              className="p-2 text-center align-middle font-bold"
                              style={{ border: `1px solid ${GRID_LINE}`, background: 'oklch(0.97 0.01 264)' }}
                            >
                              <div className="text-[11px] font-bold">{jourAr(day.date)}</div>
                              <div className="text-[9px]" style={{ color: TEXT_MUTED }}>
                                {dateNumerique(day.date)}
                              </div>
                            </td>
                          )}
                          {isFirstRowOfPeriod && (
                            <td rowSpan={period.rows.length} className="p-2 text-center align-middle" style={{ border: `1px solid ${GRID_LINE}` }}>
                              <span
                                className="inline-block rounded-lg px-2.5 py-0.5 text-[10.5px] text-white"
                                style={{ background: period.period === 'Matin' ? INDIGO : TEAL }}
                              >
                                {period.period === 'Matin' ? 'صباحا' : 'زوالا'}
                              </span>
                            </td>
                          )}
                          <td className="px-2 py-2.5 text-center font-bold" style={{ border: `1px solid ${GRID_LINE}` }}>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: TEAL }} />
                              {row.matiere}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5" style={{ border: `1px solid ${GRID_LINE}` }}>
                            <div className="flex flex-col gap-1.5">
                              {row.surveillants.map((sv) => (
                                <div
                                  key={sv.name}
                                  className="flex items-center gap-1.5 rounded-full bg-white py-0.5 pl-2.5 pr-0.5"
                                  style={{ border: '1px solid oklch(0.9 0.01 180)' }}
                                >
                                  <span
                                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white"
                                    style={{ background: TEAL }}
                                  >
                                    {sv.initials}
                                  </span>
                                  <span className="text-[9px] font-semibold">{sv.name}</span>
                                  {sv.timeLabel && <span className="text-[7px] font-normal" style={{ color: TEXT_MUTED }}>({sv.timeLabel})</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td
                            className="px-2 py-2.5 text-center font-bold"
                            style={{ borderTop: `1px solid ${GRID_LINE}`, borderBottom: `1px solid ${GRID_LINE}`, borderRight: `1px solid ${GRID_LINE}` }}
                          >
                            {row.end}
                          </td>
                          <td
                            className="px-2 py-2.5 text-center font-bold"
                            style={{ borderTop: `1px solid ${GRID_LINE}`, borderBottom: `1px solid ${GRID_LINE}`, borderLeft: `1px solid ${GRID_LINE}` }}
                          >
                            {row.start}
                          </td>
                          <td className="px-2 py-2.5 text-center" style={{ border: `1px solid ${GRID_LINE}` }}>
                            <span
                              className="rounded-[10px] px-2.5 py-0.5 text-[9.5px] font-bold"
                              style={{ background: 'oklch(0.94 0.03 264)', color: 'oklch(0.45 0.13 264)' }}
                            >
                              {formatDureeAr(row.dureeHeures)}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )
                })}
                {totalRows === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs italic" style={{ color: TEXT_MUTED }}>
                      لا توجد امتحانات مبرمجة لهذا السلك.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex-1" />

            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: AMBER_BG }}>
              <span className="text-base">⚠️</span>
              <div className="text-right text-[9.5px] leading-[1.7]" style={{ color: AMBER_TEXT }}>
                <strong>يرجى الانتباه :</strong>
                <br />- على الأساتذة الحضور إلى قاعة الامتحان 30 دقيقة قبل انطلاقه.
                <br />- يرجى التنقل باستمرار أثناء المراقبة والتدخل بهدوء عند ملاحظة أي سلوك مريب.
              </div>
            </div>

            <div className="border-t pt-1.5 text-[8.5px]" style={{ borderColor: 'oklch(0.92 0.005 90)', color: 'oklch(0.65 0.01 260)' }}>
              <div className="flex justify-between">
                <span>
                  Page {cycleIdx + 1} / {cycles.length}
                </span>
                <span>Groupe Scolaire Mondrian — Vie Scolaire</span>
              </div>
              <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
            </div>
          </div>
        )
      })}
    </>
  )
}
