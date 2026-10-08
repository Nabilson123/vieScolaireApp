import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, DoorOpen, GraduationCap, ShieldAlert } from 'lucide-react'
import { JOUR_LABELS, statutSoutienLabel } from '../../data/soutien'
import { getStudentExtraSnapshot, updateStudentCantine, useStudentExtras } from '../../services/studentDetailsService'
import { useStudentIdentities } from '../../services/studentIdentityService'
import { useStudents } from '../../services/studentsService'
import { useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { incoherencesDeLEcole, rapportDeLEcole } from '../../utils/soutienContexte'

/** Date AAAA-MM-JJ du champ de saisie → JJ/MM/AAAA, format enregistré dans la fiche cantine. */
function enFrancais(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

function aujourdhuiISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** « Marquer signé » : la vie scolaire a reçu l'accord papier des parents ; on enregistre la signature et sa date dans la fiche cantine de l'élève. */
function MarquerSigne({ studentId, name, onDone }: { studentId: string; name: string; onDone: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [date, setDate] = useState(aujourdhuiISO)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
        Marquer signé
      </button>
    )
  }

  const valider = async () => {
    setEnCours(true)
    setErreur('')
    try {
      const cantine = getStudentExtraSnapshot(studentId).cantine
      await updateStudentCantine(studentId, { ...cantine, dechargeSignee: true, dechargeDate: enFrancais(date) })
      onDone()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
      setEnCours(false)
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2" role="group" aria-label={`Accord signé de ${name}`}>
      <label className="text-[11px] font-semibold text-emerald-800">Signé le</label>
      <input type="date" value={date} max={aujourdhuiISO()} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700" />
      <button type="button" onClick={valider} disabled={!date || enCours} className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
        Enregistrer
      </button>
      <button type="button" onClick={() => setOuvert(false)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
        Annuler
      </button>
      {erreur && <p className="w-full text-[11px] text-rose-600">{erreur}</p>}
    </div>
  )
}

/**
 * Élèves qui sortent seul(e), par classe, avec leur accord signé (ou non) et, pour ceux qui suivent aussi le soutien,
 * l'heure à laquelle ils sortent ces jours-là. Les données viennent de la fiche cantine (mode de sortie).
 */
export default function SortiesSeulPanel({ isEditable }: { isEditable: boolean }) {
  const queryClient = useQueryClient()
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
  const incoherences = useMemo(
    () => incoherencesDeLEcole(),
    [students, identities, extras],
  )

  const total = rapport.reduce((n, r) => n + r.sortieSeul.length, 0)
  const sansAccord = rapport.reduce((n, r) => n + r.sortieSeul.filter((s) => s.anomalie).length, 0)
  const visibles = rapport.filter((r) => !classe || r.classe === classe)
  const aVerifier = incoherences.filter((i) => !classe || i.classe === classe)

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
            {[...new Set([...rapport.map((r) => r.classe), ...incoherences.map((i) => i.classe)])].sort((a, b) => a.localeCompare(b, 'fr')).map((c) => (
              <option key={c} value={c}>
                {c}
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
        {incoherences.length > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
            {incoherences.length} fiche{incoherences.length > 1 ? 's' : ''} à vérifier
          </span>
        )}
      </div>

      {aVerifier.length > 0 && (
        <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4" aria-label="Fiches à vérifier">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            Fiches à vérifier
          </h3>
          <ul className="space-y-1.5">
            {aVerifier.map((i) => (
              <li key={i.studentId} className="rounded-lg bg-white px-3 py-2 text-xs">
                <p className="font-semibold text-slate-800">
                  {i.name} <span className="font-normal text-slate-400">{i.classe}</span>
                </p>
                {i.problemes.map((p) => (
                  <p key={p} className="text-amber-800">
                    {p}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-700">Corrigez la fiche cantine ou l'affectation transport de l'élève : ces cas ne sont pas modifiés ici.</p>
        </section>
      )}

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
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium text-slate-700">{s.name}</span>
                          {s.accordSigne ? (
                            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accord signé{s.dateAccord ? ` le ${s.dateAccord}` : ''}
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                NON SIGNÉ
                              </span>
                              {isEditable && (
                                <MarquerSigne
                                  studentId={s.studentId}
                                  name={s.name}
                                  onDone={() => queryClient.invalidateQueries({ queryKey: ['studentExtras'] })}
                                />
                              )}
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
