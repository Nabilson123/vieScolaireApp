import { useMemo } from 'react'
import { Vote, UserX } from 'lucide-react'
import { useClasses, useUpdateClassDelegues } from '../services/classesService'
import { useStudents } from '../services/studentsService'
import type { Student } from '../data/students'
import type { SchoolClass } from '../data/schoolStructure'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

type DelegueField = 'delegueTitulaireId' | 'delegueSuppleantId' | 'delegueElectionDate'

export default function DeleguesGlobal() {
  // studentsByClasse est dérivé de `students` (retour de useStudents()), pas de viewedYearId seul —
  // voir le commentaire détaillé dans studentsService.ts / useStudents().
  const { data: classes = [] } = useClasses()
  const { data: students } = useStudents()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'delegues').canEdit
  const isEditable = canEditYear && canEditModule
  const updateDelegues = useUpdateClassDelegues()

  const activeClasses = useMemo(
    () => classes.filter((c) => c.statut === 'Active').slice().sort((a, b) => a.nom.localeCompare(b.nom)),
    [classes],
  )

  const studentsByClasse = useMemo(() => {
    const map: Record<string, Student[]> = {}
    ;(students ?? []).forEach((s) => {
      if (!map[s.classe]) map[s.classe] = []
      map[s.classe].push(s)
    })
    return map
  }, [students])

  const updateField = (c: SchoolClass, field: DelegueField, value: string) => {
    updateDelegues.mutate({
      id: c.id,
      delegueTitulaireId: field === 'delegueTitulaireId' ? value || undefined : c.delegueTitulaireId,
      delegueSuppleantId: field === 'delegueSuppleantId' ? value || undefined : c.delegueSuppleantId,
      delegueElectionDate: field === 'delegueElectionDate' ? value || undefined : c.delegueElectionDate,
    })
  }

  const destituer = (c: SchoolClass) => {
    updateDelegues.mutate({
      id: c.id,
      delegueTitulaireId: undefined,
      delegueSuppleantId: undefined,
      delegueElectionDate: undefined,
    })
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Délégués de Classe
          <Vote className="h-6 w-6 text-slate-800" />
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Titulaire et suppléant par classe — FICHE PG-11 du Cahier de Procédures. Élection en début d'année,
          rôle de médiateur avec la vie scolaire, préparation du conseil de classe. Un délégué peut être destitué
          en cas de manquement grave (sanction de Niveau 3), le suppléant prend alors la fonction.
        </p>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Classe</th>
              <th className="px-4 py-3">Titulaire</th>
              <th className="px-4 py-3">Suppléant</th>
              <th className="px-4 py-3">Date d'élection</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {activeClasses.map((c) => {
              const eleves = studentsByClasse[c.nom] ?? []
              const hasDelegue = !!c.delegueTitulaireId || !!c.delegueSuppleantId
              return (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{c.nom}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={c.delegueTitulaireId ?? ''}
                      onChange={(e) => updateField(c, 'delegueTitulaireId', e.target.value)}
                      disabled={!isEditable}
                      className="w-full min-w-[180px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">— Non désigné —</option>
                      {eleves
                        .filter((s) => s.id !== c.delegueSuppleantId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={c.delegueSuppleantId ?? ''}
                      onChange={(e) => updateField(c, 'delegueSuppleantId', e.target.value)}
                      disabled={!isEditable}
                      className="w-full min-w-[180px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">— Non désigné —</option>
                      {eleves
                        .filter((s) => s.id !== c.delegueTitulaireId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="date"
                      value={c.delegueElectionDate ?? ''}
                      onChange={(e) => updateField(c, 'delegueElectionDate', e.target.value)}
                      disabled={!isEditable}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {hasDelegue && (
                      <button
                        type="button"
                        onClick={() => destituer(c)}
                        disabled={!isEditable}
                        className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Destituer les délégués de cette classe"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Destituer
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {activeClasses.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Aucune classe active pour cette année.</p>
        )}
      </div>
    </div>
  )
}
