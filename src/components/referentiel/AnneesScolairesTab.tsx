import { useState } from 'react'
import { CheckCircle2, PlusCircle, X, TriangleAlert } from 'lucide-react'
import {
  useAnneesScolaires,
  useUpdateAnneeScolaire,
  useSetActiveYear,
  useCreateNextYear,
  getAnneesScolairesSnapshot,
  getActiveYearIdSnapshot,
} from '../../services/anneesScolairesService'
import type { AnneeScolaire } from '../../data/anneesScolaires'

interface AnneesScolairesTabProps {
  onSaved: () => void
}

export default function AnneesScolairesTab({ onSaved }: AnneesScolairesTabProps) {
  const { data: annees = getAnneesScolairesSnapshot() } = useAnneesScolaires()
  const updateAnnee = useUpdateAnneeScolaire()
  const setActiveYear = useSetActiveYear()
  const createNextYear = useCreateNextYear()
  const [showConfirm, setShowConfirm] = useState(false)

  const patch = (a: AnneeScolaire, next: Partial<Pick<AnneeScolaire, 'dateDebut' | 'dateFin'>>) => {
    updateAnnee.mutate({ id: a.id, dateDebut: a.dateDebut, dateFin: a.dateFin, ...next })
    onSaved()
  }

  const activeYear = annees.find((a) => a.id === getActiveYearIdSnapshot())
  const nextLibelle = activeYear ? `${activeYear.anneeDebut + 1}/${activeYear.anneeDebut + 2}` : null
  const sorted = [...annees].sort((a, b) => b.anneeDebut - a.anneeDebut)

  const handleConfirmCreate = () => {
    createNextYear.mutate(undefined, {
      onSuccess: () => {
        setShowConfirm(false)
        onSaved()
      },
    })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Une seule année peut être active (modifiable) à la fois. Les autres restent consultables en lecture seule.
        </p>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!activeYear}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Créer l'année suivante
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Année</th>
              <th className="px-4 py-3">Début</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 font-semibold text-slate-800">{a.libelle}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="date"
                    value={a.dateDebut}
                    onChange={(e) => patch(a, { dateDebut: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="date"
                    value={a.dateFin}
                    onChange={(e) => patch(a, { dateFin: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  {a.active ? (
                    <span className="flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Lecture seule</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    disabled={a.active}
                    onClick={() => {
                      setActiveYear.mutate(a.id)
                      onSaved()
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Définir comme active
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <PlusCircle className="h-5 w-5 text-indigo-500" />
                Créer l'année {nextLibelle}
              </h2>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-slate-600">
                Les classes actives et les enseignants de l'année {activeYear?.libelle} seront dupliqués vers {nextLibelle}. Les élèves,
                emplois du temps et autres données ne sont pas repris — la nouvelle année démarre vide. Elle sera créée en lecture seule ;
                définissez-la comme active depuis cet écran quand vous serez prêt à l'ouvrir.
              </p>
              {createNextYear.isError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  {createNextYear.error instanceof Error ? createNextYear.error.message : 'Une erreur est survenue.'}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={createNextYear.isPending}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                disabled={createNextYear.isPending}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createNextYear.isPending ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
