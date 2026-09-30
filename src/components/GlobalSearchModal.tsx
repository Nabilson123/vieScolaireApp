import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, ArrowRight, type LucideIcon } from 'lucide-react'
import { topLevelNav, navGroups, IMPLEMENTED_MODULE_KEYS } from '../data/navigation'
import { useSchoolIdentity } from '../services/schoolIdentityService'
import { initials as studentInitials } from '../data/students'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { computeStudentMoyenne, moyenneScaleForClasse } from '../utils/alertEngine'
import { teacherName, initials as teacherInitials } from '../data/teachers'
import { getTeachersSnapshot, useTeachers } from '../services/teachersService'

interface GlobalSearchModalProps {
  onClose: () => void
  onSelectModule: (key: string) => void
  onSelectStudent: (id: string) => void
  onSelectTeacher: (id: string) => void
}

interface FlatModule {
  key: string
  label: string
  icon: LucideIcon
  builtIn: boolean
}

const STATUT_BADGE: Record<string, string> = {
  Permanent: 'bg-emerald-50 text-emerald-600',
  Vacataire: 'bg-amber-50 text-amber-600',
  Contractuel: 'bg-slate-100 text-slate-600',
}

function roundMoyenne(value: number): number {
  return Math.round(value * 100) / 100
}

export default function GlobalSearchModal({ onClose, onSelectModule, onSelectStudent, onSelectTeacher }: GlobalSearchModalProps) {
  const { data: identity } = useSchoolIdentity()
  const { data: students } = useStudents()
  const { data: teachers } = useTeachers()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const allModules = useMemo<FlatModule[]>(() => {
    const flat: FlatModule[] = topLevelNav.map((m) => ({
      key: m.key,
      label: m.label,
      icon: m.icon,
      builtIn: IMPLEMENTED_MODULE_KEYS.includes(m.key),
    }))
    navGroups.forEach((g) => {
      g.items.forEach((m) =>
        flat.push({ key: m.key, label: m.label, icon: m.icon, builtIn: IMPLEMENTED_MODULE_KEYS.includes(m.key) })
      )
    })
    return flat
  }, [])

  const q = query.trim().toLowerCase()

  const modulesFiltered = useMemo(
    () => (q === '' ? allModules : allModules.filter((m) => m.label.toLowerCase().includes(q))),
    [allModules, q]
  )

  const studentsFiltered = useMemo(() => {
    if (q === '') return []
    return getStudentsSnapshot()
      .filter((s) => {
        const idn = getStudentIdentitySnapshot(s.id)
        return (
          s.name.toLowerCase().includes(q) ||
          s.classe.toLowerCase().includes(q) ||
          idn.codeMassar.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [q, students])

  const teachersFiltered = useMemo(() => {
    if (q === '') return []
    return getTeachersSnapshot()
      .filter((t) => {
        const name = teacherName(t).toLowerCase()
        return name.includes(q) || t.matieres.some((m) => m.toLowerCase().includes(q))
      })
      .slice(0, 8)
  }, [q, teachers])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (q === '' && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1
        const target = modulesFiltered[idx]
        if (target && target.builtIn) {
          e.preventDefault()
          onSelectModule(target.key)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [q, modulesFiltered, onClose, onSelectModule])

  const handleModuleClick = (m: FlatModule) => {
    if (!m.builtIn) return
    onSelectModule(m.key)
    onClose()
  }

  const handleStudentClick = (id: string) => {
    onSelectStudent(id)
    onClose()
  }

  const handleTeacherClick = (id: string) => {
    onSelectTeacher(id)
    onClose()
  }

  const noResults = q !== '' && modulesFiltered.length === 0 && studentsFiltered.length === 0 && teachersFiltered.length === 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-[8vh]" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un élève, un prof, un module (ex: Massar, Bon de commande, Tazi...)"
            className="w-full text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <span className="shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            ESC
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {modulesFiltered.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Onglets & Modules ({modulesFiltered.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {modulesFiltered.map((m, idx) => {
                  const Icon = m.icon
                  const showNumber = q === '' && idx < 9
                  return (
                    <button
                      key={m.key}
                      type="button"
                      disabled={!m.builtIn}
                      onClick={() => handleModuleClick(m)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                        m.builtIn
                          ? 'border-slate-100 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
                          : 'cursor-not-allowed border-slate-100 bg-slate-50/60 text-slate-400'
                      }`}
                    >
                      {showNumber ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-600">
                          {idx + 1}
                        </span>
                      ) : (
                        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span className="flex-1 truncate font-medium">{m.label}</span>
                      {!m.builtIn ? (
                        <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                          À venir
                        </span>
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {studentsFiltered.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Élèves trouvés ({studentsFiltered.length})
              </p>
              <div className="space-y-1.5">
                {studentsFiltered.map((s) => {
                  const moyenne = computeStudentMoyenne(s.id)
                  const massar = getStudentIdentitySnapshot(s.id).codeMassar
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleStudentClick(s.id)}
                      className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-[10px] font-bold text-white">
                        {studentInitials(s.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          Classe : <span className="text-indigo-600">{s.classe}</span>
                          {massar && <> · Massar: {massar}</>}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                        {moyenne !== null ? `Moy: ${roundMoyenne(moyenne)}/${moyenneScaleForClasse(s.classe) ?? 20}` : 'Moy: —'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {teachersFiltered.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Corps enseignant ({teachersFiltered.length})
              </p>
              <div className="space-y-1.5">
                {teachersFiltered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTeacherClick(t.id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-bold text-white">
                      {teacherInitials(teacherName(t))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">Prof. {teacherName(t)}</p>
                      <p className="truncate text-xs text-slate-400">{t.matieres.join(', ') || '—'}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                        STATUT_BADGE[t.statut] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.statut}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {noResults && <p className="py-10 text-center text-sm text-slate-400">Aucun résultat pour « {query} ».</p>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span>Recherche globale {identity?.nom ?? ''} ERP</span>
          <span className="flex items-center gap-1">
            Raccourcis :
            <span className="rounded border border-slate-200 px-1 py-0.5 font-medium text-slate-500">Ctrl + K</span>
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}
