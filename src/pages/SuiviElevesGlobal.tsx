import { useMemo, useState, type ReactNode } from 'react'
import { Eye, GraduationCap, Clock, ShieldAlert, AlertTriangle, Sparkles, ChevronDown, ChevronUp, Search, ChevronRight } from 'lucide-react'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { useAlertRules } from '../services/alertRulesService'
import { cycleOfClasse, moyenneScaleForClasse, computeStudentMoyenne, niveauFromClasse } from '../utils/alertEngine'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { NIVEAUX } from '../data/referentiel'
import { cycleLabel, type CycleKey } from '../data/alertRules'
import { parseDuration, initials } from '../data/students'
import type { AlertRules } from '../data/alertRules'

const SEUIL_CONDUITE = 8
const RECENT_DAYS = 7

interface SuiviRow {
  id: string
  name: string
  classe: string
  cycle: CycleKey | undefined
  taux: number
  retardsMin: number
  conduite: number
  moyenne: number | null
  scale: number | null
  alertePresence: boolean
  alerteRetards: boolean
  alerteDiscipline: boolean
  alerteNotes: boolean
  flagCount: number
  reasons: string[]
  isNew: boolean
}

function formatRetards(min: number): string {
  if (min === 0) return '0 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m}min`
}

function recentCutoff(): string {
  const d = new Date()
  d.setDate(d.getDate() - RECENT_DAYS)
  return d.toISOString().slice(0, 10)
}

function buildRow(s: ReturnType<typeof getStudentsSnapshot>[number], rules: AlertRules, cutoff: string): SuiviRow {
  const cycle = cycleOfClasse(s.classe)
  const extra = getStudentExtraSnapshot(s.id)
  const conduite = extra.conduite
  const moyenne = computeStudentMoyenne(s.id)
  const scale = moyenneScaleForClasse(s.classe)
  const retardsMin = parseDuration(s.retardsMin)
  const seuils = cycle ? rules[cycle] : undefined
  const alertePresence = !!seuils && s.taux < seuils.seuilTauxPresence
  const alerteRetards = !!seuils && retardsMin > seuils.seuilRetardsCumulesMin
  const alerteDiscipline = conduite < SEUIL_CONDUITE
  const alerteNotes = !!seuils && scale !== null && moyenne !== null && moyenne < seuils.seuilMoyennePedagogique
  const flagCount = [alertePresence, alerteRetards, alerteDiscipline, alerteNotes].filter(Boolean).length

  const reasons: string[] = []
  if (alertePresence) reasons.push(`Présence ${s.taux}%`)
  if (alerteRetards) reasons.push(`Retards cumulés ${formatRetards(retardsMin)}`)
  if (alerteDiscipline) reasons.push(`Conduite ${conduite}/20`)
  if (alerteNotes && moyenne !== null && scale !== null) reasons.push(`Moyenne ${moyenne.toFixed(1)}/${scale}`)

  const recentDiscipline = extra.discipline.some((d) => d.points < 0 && d.date >= cutoff)
  const recentEvent = extra.events.some((e) => (e.type === 'ABSENCE' || e.type === 'RETARD') && e.date >= cutoff)
  const isNew = flagCount > 0 && (recentDiscipline || recentEvent)

  return {
    id: s.id,
    name: s.name,
    classe: s.classe,
    cycle,
    taux: s.taux,
    retardsMin,
    conduite,
    moyenne,
    scale,
    alertePresence,
    alerteRetards,
    alerteDiscipline,
    alerteNotes,
    flagCount,
    reasons,
    isNew,
  }
}

function sortClasses(classes: string[]): string[] {
  return [...classes].sort((a, b) => {
    const ra = NIVEAUX.indexOf(niveauFromClasse(a))
    const rb = NIVEAUX.indexOf(niveauFromClasse(b))
    if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb)
    return a.localeCompare(b)
  })
}

const SEVERITY_STYLE: Record<number, { badge: string; row: string }> = {
  1: { badge: 'bg-amber-50 text-amber-600', row: '' },
  2: { badge: 'bg-orange-100 text-orange-700', row: 'bg-orange-50/40' },
  3: { badge: 'bg-rose-100 text-rose-700', row: 'bg-rose-50/50' },
}

function severityStyle(flagCount: number) {
  return SEVERITY_STYLE[Math.min(flagCount, 3)] ?? SEVERITY_STYLE[3]
}

function Cell({ alert, children }: { alert: boolean; children: ReactNode }) {
  return <td className={`py-2.5 text-sm ${alert ? 'font-bold text-rose-600' : 'text-slate-700'}`}>{children}</td>
}

function ClasseSection({ classe, rows, onNavigateToStudent }: { classe: string; rows: SuiviRow[]; onNavigateToStudent: (id: string) => void }) {
  const cycle = rows[0]?.cycle
  const flagged = rows.filter((r) => r.flagCount > 0)
  const [expanded, setExpanded] = useState(false)
  const visibleRows = expanded ? rows : flagged
  const sorted = [...visibleRows].sort((a, b) => b.flagCount - a.flagCount || a.name.localeCompare(b.name))

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">{classe}</h3>
          {cycle && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{cycleLabel(cycle)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              flagged.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {flagged.length > 0 ? `${flagged.length} à surveiller` : 'Aucun signal'}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Réduire aux élèves à surveiller
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Voir les {rows.length} élèves de la classe
              </>
            )}
          </button>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-xl bg-emerald-50/60 px-4 py-3 text-sm text-emerald-600">Aucun élève signalé dans cette classe pour l'instant.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Élève</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Présence</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Retards cumulés</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Conduite</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Moyenne</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Points d'attention</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const severity = severityStyle(r.flagCount)
                return (
                  <tr
                    key={r.id}
                    onClick={() => onNavigateToStudent(r.id)}
                    className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${severity.row}`}
                  >
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-[10px] font-bold text-white">
                          {initials(r.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                            {r.isNew && (
                              <span className="flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-700">
                                <Sparkles className="h-2.5 w-2.5" />
                                Nouveau
                              </span>
                            )}
                          </div>
                          {r.reasons.length > 0 && <p className="text-xs text-slate-400">{r.reasons.join(' · ')}</p>}
                        </div>
                      </div>
                    </td>
                    <Cell alert={r.alertePresence}>{r.taux}%</Cell>
                    <Cell alert={r.alerteRetards}>{formatRetards(r.retardsMin)}</Cell>
                    <Cell alert={r.alerteDiscipline}>{r.conduite}/20</Cell>
                    <Cell alert={r.alerteNotes}>{r.moyenne === null || r.scale === null ? '—' : `${r.moyenne.toFixed(1)}/${r.scale}`}</Cell>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        {r.flagCount > 0 ? (
                          <span className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${severity.badge}`}>
                            <AlertTriangle className="h-3 w-3" />
                            {r.flagCount}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KpiInline({ icon: Icon, iconColor, barColor, label, value }: { icon: typeof Eye; iconColor: string; barColor: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-6 w-1 rounded-full ${barColor}`} />
      <span className="text-sm text-slate-500">
        {label} <span className="font-bold text-slate-900">{value}</span>
      </span>
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </div>
  )
}

interface SuiviElevesGlobalProps {
  onNavigateToStudent: (id: string) => void
}

export default function SuiviElevesGlobal({ onNavigateToStudent }: SuiviElevesGlobalProps) {
  const { data: students } = useStudents()
  const { data: rules } = useAlertRules()
  const [classe, setClasse] = useState('Toutes les classes')
  const [search, setSearch] = useState('')

  const classOptions = useMemo(() => ['Toutes les classes', ...sortClasses(getActiveClassNamesSnapshot())], [students])

  const rows = useMemo(() => {
    if (!rules) return []
    const cutoff = recentCutoff()
    return getStudentsSnapshot().map((s) => buildRow(s, rules, cutoff))
  }, [students, rules])

  const searched = search.trim() ? rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase())) : rows
  const filteredClasses = classe === 'Toutes les classes' ? classOptions.slice(1) : [classe]
  const rowsByClasse = new Map<string, SuiviRow[]>()
  searched.forEach((r) => {
    if (!filteredClasses.includes(r.classe)) return
    const list = rowsByClasse.get(r.classe)
    if (list) list.push(r)
    else rowsByClasse.set(r.classe, [r])
  })

  // Les classes les plus concernées d'abord — pour un usage quotidien, on veut prioriser sans
  // avoir à ouvrir chaque classe pour savoir où sont les cas réels.
  const orderedClasses = [...filteredClasses].sort((a, b) => {
    const fa = (rowsByClasse.get(a) ?? []).filter((r) => r.flagCount > 0).length
    const fb = (rowsByClasse.get(b) ?? []).filter((r) => r.flagCount > 0).length
    if (fa !== fb) return fb - fa
    return sortClasses([a, b])[0] === a ? -1 : 1
  })

  const totalASurveiller = rows.filter((r) => r.flagCount > 0).length
  const totalPresence = rows.filter((r) => r.alertePresence).length
  const totalRetards = rows.filter((r) => r.alerteRetards).length
  const totalDiscipline = rows.filter((r) => r.alerteDiscipline).length
  const totalNotes = rows.filter((r) => r.alerteNotes).length

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Suivi des Élèves
            <Eye className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Vue par classe, toujours à jour, des élèves à surveiller de près sur l'assiduité, la discipline et les notes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un élève..."
              className="w-44 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <span className="text-sm text-slate-500">Classe :</span>
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-100 pb-4">
        <KpiInline icon={AlertTriangle} iconColor="text-rose-500" barColor="bg-rose-500" label="Élèves à surveiller" value={totalASurveiller} />
        <KpiInline icon={Eye} iconColor="text-sky-500" barColor="bg-sky-500" label="Présence" value={totalPresence} />
        <KpiInline icon={Clock} iconColor="text-amber-500" barColor="bg-amber-500" label="Retards" value={totalRetards} />
        <KpiInline icon={ShieldAlert} iconColor="text-rose-500" barColor="bg-rose-500" label="Discipline" value={totalDiscipline} />
        <KpiInline icon={GraduationCap} iconColor="text-indigo-500" barColor="bg-indigo-500" label="Notes" value={totalNotes} />
      </div>

      {!rules ? (
        <p className="py-8 text-center text-sm text-slate-400">Chargement...</p>
      ) : (
        <div className="space-y-4">
          {orderedClasses.map((c) => {
            const classRows = rowsByClasse.get(c)
            if (!classRows || classRows.length === 0) return null
            return <ClasseSection key={c} classe={c} rows={classRows} onNavigateToStudent={onNavigateToStudent} />
          })}
        </div>
      )}
    </div>
  )
}
