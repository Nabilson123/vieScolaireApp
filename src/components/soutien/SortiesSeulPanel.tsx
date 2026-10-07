import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, DoorOpen, GraduationCap } from 'lucide-react'
import { JOUR_LABELS, statutSoutienLabel } from '../../data/soutien'
import { useStudentExtras } from '../../services/studentDetailsService'
import { useStudentIdentities } from '../../services/studentIdentityService'
import { useStudents } from '../../services/studentsService'
import { useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { rapportDeLEcole } from '../../utils/soutienContexte'

/**
 * Élèves qui sortent seul(e), par classe, avec leur accord signé (ou non) et, pour ceux qui suivent aussi le soutien,
 * l'heure à laquelle ils sortent ces jours-là. Les données viennent de la fiche cantine (mode de sortie).
 */
export default function SortiesSeulPanel() {
  // Abonnements : le rapport lit les instantanés de ces données, qui doivent être chargées et rester à jour.
  const { data: students = [] } = useStudents()
  const { data: identities } = useStudentIdentities()
  const { data: extras } = useStudentExtras()
  const { data: seances = [] } = useSoutienSeances()
  const { data: inscriptions = [] } = useSoutienInscriptions()

  const [classe, setClasse] = useState('')
  const [anomaliesSeules, setAnomaliesSeules] = useState(false)

  const rapport = useMemo(
    () => rapportDeLEcole().filter((r) => r.sortieSeul.length > 0),
    [students, identities, extras, seances, inscriptions],
  )

  const total = rapport.reduce((n, r) => n + r.sortieSeul.length, 0)
  const sansAccord = rapport.reduce((n, r) => n + r.sortieSeul.filter((s) => s.anomalie).length, 0)
  const visibles = rapport.filter((r) => !classe || r.classe === classe)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <DoorOpen className="h-5 w-5 text-emerald-500" />
            Élèves qui sortent seul(e)
          </h2>
          <p className="text-xs text-slate-500">Mode de sortie « Sortie seul(e) (Accord signé) » de la fiche cantine ; l'interdiction de sortie l'emporte.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none">
            <option value="">Toutes les classes</option>
            {rapport.map((r) => (
              <option key={r.classe} value={r.classe}>
                {r.classe}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <input type="checkbox" checked={anomaliesSeules} onChange={(e) => setAnomaliesSeules(e.target.checked)} className="accent-rose-600" />
            Accord non signé
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
          {total} élève{total > 1 ? 's' : ''} sortent seul(e)
        </span>
        <span className={`rounded-full px-2.5 py-1 ${sansAccord > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
          {sansAccord} accord{sansAccord > 1 ? 's' : ''} non signé{sansAccord > 1 ? 's' : ''}
        </span>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Aucun élève ne sort seul(e) pour le moment.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((r) => {
            const lignes = r.sortieSeul.filter((s) => !anomaliesSeules || s.anomalie)
            if (lignes.length === 0) return null
            return (
              <section key={r.classe} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <h3 className="mb-2 flex items-center justify-between text-sm font-bold text-slate-900">
                  {r.classe}
                  <span className="text-xs font-medium text-slate-400">
                    {lignes.length} élève{lignes.length > 1 ? 's' : ''}
                  </span>
                </h3>
                <ul className="space-y-1.5">
                  {lignes.map((s) => {
                    const soutien = r.soutien.filter((x) => x.studentId === s.studentId)
                    return (
                      <li key={s.studentId} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium text-slate-700">{s.name}</span>
                          {s.accordSigne ? (
                            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accord signé{s.dateAccord ? ` le ${s.dateAccord}` : ''}
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              NON SIGNÉ
                            </span>
                          )}
                        </div>
                        {soutien.map((x) => (
                          <p key={x.seanceId} className="mt-1 flex items-center gap-1.5 text-[11px] text-violet-700">
                            <GraduationCap className="h-3.5 w-3.5" />
                            Soutien {x.matiere} le {JOUR_LABELS[x.jour].toLowerCase()} jusqu'à {x.heureFin} · {statutSoutienLabel(x.statut, x.aTransportSoir)}
                          </p>
                        ))}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
