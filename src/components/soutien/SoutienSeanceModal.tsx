import { useMemo, useState } from 'react'
import { Bus, GraduationCap, Plus, TriangleAlert, X } from 'lucide-react'
import { JOURS_SOUTIEN, JOUR_LABELS, type JourSoutien, type SoutienSeance } from '../../data/soutien'
import { fullLabel } from '../../data/salles'
import { getActiveClassNamesSnapshot } from '../../services/classesService'
import { getStudentExtraSnapshot } from '../../services/studentDetailsService'
import { getStudentsSnapshot } from '../../services/studentsService'
import { useAlertRules } from '../../services/alertRulesService'
import { useMatieresConfig } from '../../services/matieresConfigService'
import { useSalles } from '../../services/sallesService'
import { useTeachers } from '../../services/teachersService'
import { getSoutienInscriptionsSnapshot, useAddSoutienSeance, useUpdateSoutienSeance, type SeanceInput } from '../../services/soutienService'
import { alerteCar, conflitsSeance, suggestionsPourMatiere } from '../../utils/soutien'
import { buildConflitsContext, transportInfoOf } from '../../utils/soutienContexte'
import { aujourdhuiLocalISO, creneauModifie, inscritsDeLaSeance, occurrencesSeance } from '../../utils/soutienSeances'
import StudentSearchSelect from '../StudentSearchSelect'
import TeacherSearchSelect from '../TeacherSearchSelect'

interface Props {
  /** Séance à modifier ; absente pour une création. */
  seance?: SoutienSeance
  onClose: () => void
  /** Message à afficher dans la page après l'enregistrement (ex. familles remises « à confirmer »). */
  onSaved?: (message: string) => void
}

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none'

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function moyenneFR(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

/** Création et modification d'une séance de soutien : matière, enseignant, salle, créneau, période, classes et élèves inscrits. */
export default function SoutienSeanceModal({ seance, onClose, onSaved }: Props) {
  const { data: matieresConfig = [] } = useMatieresConfig()
  const { data: teachers = [] } = useTeachers()
  const { data: salles = [] } = useSalles()
  const { data: rules } = useAlertRules()
  const add = useAddSoutienSeance()
  const update = useUpdateSoutienSeance()

  const inscritsInitiaux = useMemo(() => (seance ? inscritsDeLaSeance(getSoutienInscriptionsSnapshot(), seance.id) : []), [seance])
  const students = getStudentsSnapshot()
  const matieres = useMemo(() => [...new Set(matieresConfig.map((m) => m.nom))].sort((a, b) => a.localeCompare(b, 'fr')), [matieresConfig])

  const [matiere, setMatiere] = useState(seance?.matiere ?? '')
  const [teacherId, setTeacherId] = useState(seance?.teacherId ?? '')
  const [tousProfs, setTousProfs] = useState(false)
  const [salleId, setSalleId] = useState(seance?.salleId ?? '')
  const [jour, setJour] = useState<JourSoutien>(seance?.jour ?? 'LUNDI')
  const [heureDebut, setHeureDebut] = useState(seance?.heureDebut ?? '16:30')
  const [heureFin, setHeureFin] = useState(seance?.heureFin ?? '17:30')
  const [dateDebut, setDateDebut] = useState(seance?.dateDebut ?? aujourdhuiLocalISO())
  const [dateFin, setDateFin] = useState(seance?.dateFin ?? '')
  const [classes, setClasses] = useState<string[]>(seance?.classes ?? [])
  const [studentIds, setStudentIds] = useState<string[]>(inscritsInitiaux.map((i) => i.studentId))
  const [note, setNote] = useState(seance?.note ?? '')
  const [erreur, setErreur] = useState('')
  const [aConfirmer, setAConfirmer] = useState<number | null>(null)

  const allClasses = getActiveClassNamesSnapshot()
  const profsDeLaMatiere = teachers.filter((t) => t.matieres.includes(matiere))
  const profsProposes = tousProfs || profsDeLaMatiere.length === 0 ? teachers : profsDeLaMatiere

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const suggestions = useMemo(() => {
    if (!matiere || classes.length === 0 || !rules) return []
    const eleves = students.filter((s) => classes.includes(s.classe)).map((s) => ({ student: s, notes: getStudentExtraSnapshot(s.id).notes }))
    return suggestionsPourMatiere(matiere, classes, eleves, rules).filter((s) => !studentIds.includes(s.studentId))
  }, [matiere, classes, rules, students, studentIds])

  const heuresValides = !!heureDebut && !!heureFin && heureFin > heureDebut
  const periodeValide = !!dateDebut && (!dateFin || dateFin >= dateDebut)
  const canSubmit = !!matiere && heuresValides && periodeValide && !add.isPending && !update.isPending

  const conflits = useMemo(
    () =>
      conflitsSeance(
        { id: seance?.id, matiere, jour, heureDebut, heureFin, teacherId: teacherId || null, salleId: salleId || null, dateDebut, dateFin: dateFin || null, datesAnnulees: seance?.datesAnnulees ?? [], studentIds },
        buildConflitsContext(),
      ),
    [seance, matiere, jour, heureDebut, heureFin, teacherId, salleId, dateDebut, dateFin, studentIds],
  )

  const nbSeances = useMemo(() => {
    if (!dateFin || !periodeValide) return null
    const periode: SoutienSeance = { id: '', matiere, jour, heureDebut, heureFin, teacherId: null, salleId: null, classes: [], dateDebut, dateFin, datesAnnulees: seance?.datesAnnulees ?? [], note: '', createdAt: '' }
    return occurrencesSeance(periode).length
  }, [seance, matiere, jour, heureDebut, heureFin, dateDebut, dateFin, periodeValide])

  const toggleClasse = (c: string) => setClasses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  const ajouterEleve = (id: string) => id && setStudentIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  const retirerEleve = (id: string) => setStudentIds((prev) => prev.filter((x) => x !== id))

  const handleSubmit = async () => {
    if (!canSubmit) return
    const input: SeanceInput = {
      matiere,
      jour,
      heureDebut,
      heureFin,
      teacherId: teacherId || null,
      salleId: salleId || null,
      classes,
      dateDebut,
      dateFin: dateFin || null,
      note: note.trim(),
    }
    setErreur('')
    try {
      if (seance) {
        // Un changement de jour ou d'horaire annule les réponses déjà notées : on prévient avant d'enregistrer.
        if (aConfirmer === null && creneauModifie(seance, input)) {
          const aReinitialiser = inscritsInitiaux.filter((i) => studentIds.includes(i.studentId) && (i.statut !== 'a_confirmer' || i.messageEnvoyeLe)).length
          if (aReinitialiser > 0) {
            setAConfirmer(aReinitialiser)
            return
          }
        }
        const r = await update.mutateAsync({ id: seance.id, seance: input, studentIds })
        onSaved?.(
          r.remisesEnAttente > 0
            ? `Séance modifiée. ${r.remisesEnAttente} famille${r.remisesEnAttente > 1 ? 's repassent' : ' repasse'} « à confirmer » : pensez à ${r.remisesEnAttente > 1 ? 'les' : 'la'} prévenir du nouveau créneau.`
            : 'Séance modifiée.',
        )
      } else {
        await add.mutateAsync({ seance: input, studentIds })
        onSaved?.('Séance créée.')
      }
      onClose()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <GraduationCap className="h-5 w-5 text-violet-500" />
            {seance ? 'Modifier la séance de soutien' : 'Nouvelle séance de soutien'}
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Matière*</label>
              <select
                value={matiere}
                onChange={(e) => {
                  setMatiere(e.target.value)
                  setTeacherId('')
                }}
                className={INPUT}
              >
                <option value="">Choisissez une matière…</option>
                {matieres.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Enseignant</label>
              <TeacherSearchSelect teachers={profsProposes} value={teacherId} onChange={setTeacherId} placeholder="Choisissez un enseignant…" />
              {matiere && profsDeLaMatiere.length > 0 && (
                <button type="button" onClick={() => setTousProfs((v) => !v)} className="mt-1 text-[11px] font-medium text-indigo-600 hover:underline">
                  {tousProfs ? `Seulement les enseignants de ${matiere}` : 'Voir tous les enseignants'}
                </button>
              )}
              {matiere && profsDeLaMatiere.length === 0 && <p className="mt-1 text-[11px] text-slate-400">Aucun enseignant ne déclare {matiere} : tous sont proposés.</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Jour*</label>
              <select value={jour} onChange={(e) => setJour(e.target.value as JourSoutien)} className={INPUT}>
                {JOURS_SOUTIEN.map((j) => (
                  <option key={j} value={j}>
                    {JOUR_LABELS[j]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Début*</label>
              <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fin*</label>
              <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Salle</label>
              <select value={salleId} onChange={(e) => setSalleId(e.target.value)} className={INPUT}>
                <option value="">— Aucune —</option>
                {salles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fullLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!heuresValides && <p className="-mt-3 text-[11px] text-amber-600">L'heure de fin doit être après l'heure de début.</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">À partir du*</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Jusqu'au</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={INPUT} />
              <p className="mt-1 text-[11px] text-slate-400">
                {dateFin
                  ? periodeValide
                    ? `${nbSeances} séance${(nbSeances ?? 0) > 1 ? 's' : ''}, chaque ${JOUR_LABELS[jour].toLowerCase()}, du ${dateCourte(dateDebut)} au ${dateCourte(dateFin)}.`
                    : 'La fin doit être après le début.'
                  : `Laissé vide : chaque ${JOUR_LABELS[jour].toLowerCase()} jusqu'à la fin de l'année. Une date précise s'annule ensuite séance par séance.`}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classes visées</label>
            <div className="flex flex-wrap gap-1.5">
              {allClasses.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleClasse(c)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${classes.includes(c) ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Les séances apparaissent dans l'emploi du temps de ces classes, et leurs élèves en difficulté sont suggérés ci-dessous.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élèves inscrits ({studentIds.length})</label>
            {studentIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {studentIds.map((id) => {
                  const s = studentById.get(id)
                  if (!s) return null
                  const car = alerteCar({ heureFin }, transportInfoOf(id))
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-1 pl-2.5 pr-1 text-xs font-medium text-violet-800">
                      {s.name} <span className="text-violet-400">({s.classe})</span>
                      {car && (
                        <span title={`Prend le transport du soir (départ ${car}) : la séance se termine après`} className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
                          <Bus className="h-3 w-3" />
                          {car}
                        </span>
                      )}
                      <button type="button" onClick={() => retirerEleve(id)} aria-label={`Retirer ${s.name}`} className="flex h-5 w-5 items-center justify-center rounded-full text-violet-400 hover:bg-violet-100">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="mb-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-violet-800">
                    Suggestions : moyenne sous le seuil en {matiere} ({suggestions.length})
                  </p>
                  <button type="button" onClick={() => setStudentIds((prev) => [...new Set([...prev, ...suggestions.map((s) => s.studentId)])])} className="text-xs font-semibold text-violet-700 hover:underline">
                    Ajouter tous
                  </button>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {suggestions.map((s) => (
                    <div key={s.studentId} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-700">
                        {s.name} <span className="text-slate-400">({s.classe})</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-slate-500">
                          {moyenneFR(s.moyenne)}/{s.scale} <span className="text-slate-400">(seuil {moyenneFR(s.seuil)})</span>
                        </span>
                        <button type="button" onClick={() => ajouterEleve(s.studentId)} aria-label={`Ajouter ${s.name}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-500">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {matiere && classes.length > 0 && suggestions.length === 0 && (
              <p className="mb-2 text-[11px] text-slate-400">Aucun élève de ces classes n'est sous le seuil en {matiere} (ou tous sont déjà inscrits).</p>
            )}

            <StudentSearchSelect students={students} value="" onChange={ajouterEleve} classe={classes[0]} placeholder="Ajouter un élève (nom ou classe)…" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Note (facultatif)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={INPUT} placeholder="Ex. apporter la calculatrice" />
          </div>

          {conflits.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {conflits.map((c, i) => (
                  <p key={i}>{c.message}</p>
                ))}
                <p className="font-semibold">Vous pouvez tout de même enregistrer si vous jugez que ça convient.</p>
              </div>
            </div>
          )}

          {aConfirmer !== null && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <p className="font-semibold">
                Le jour ou l'horaire change : {aConfirmer} famille{aConfirmer > 1 ? 's' : ''} repasse{aConfirmer > 1 ? 'nt' : ''} « à confirmer » et devr{aConfirmer > 1 ? 'ont' : 'a'} être prévenue{aConfirmer > 1 ? 's' : ''} du nouveau créneau.
              </p>
            </div>
          )}
          {erreur && <p className="text-sm text-rose-600">{erreur}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aConfirmer !== null ? 'Confirmer et enregistrer' : seance ? 'Enregistrer' : 'Créer la séance'}
          </button>
        </div>
      </div>
    </div>
  )
}
