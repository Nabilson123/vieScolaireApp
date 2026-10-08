import { useMemo, useState } from 'react'
import { Bus, CheckCircle2, GraduationCap, TriangleAlert, X } from 'lucide-react'
import { JOURS_SOUTIEN, statutSoutienLabel } from '../../data/soutien'
import { teacherName } from '../../data/teachers'
import { getStudentExtraSnapshot } from '../../services/studentDetailsService'
import { useAlertRules } from '../../services/alertRulesService'
import { useTeachers } from '../../services/teachersService'
import { useAddSoutienInscription, useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { cycleOfClasse, moyenneScaleForClasse } from '../../utils/alertEngine'
import { alerteCar } from '../../utils/soutien'
import { buildConflitsContext, transportInfoOf } from '../../utils/soutienContexte'
import { aujourdhuiLocalISO, libelleCreneau, seanceTerminee } from '../../utils/soutienSeances'
import { computeSubjectMoyenne } from '../../utils/studentAggregation'
import { normalizeText } from '../../utils/textMatch'

interface Props {
  studentId: string
  studentName: string
  classe: string
  onClose: () => void
}

function chiffre(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/**
 * Inscrire un élève à une séance de soutien depuis la Réunion de suivi : les séances en cours avec, pour chacune, la moyenne de
 * l'élève dans la matière (celles où il est sous le seuil en premier), les cours de sa classe au même moment et son transport du soir.
 */
export default function InscrireSoutienModal({ studentId, studentName, classe, onClose }: Props) {
  const { data: seances = [] } = useSoutienSeances()
  const { data: inscriptions = [] } = useSoutienInscriptions()
  const { data: teachers = [] } = useTeachers()
  const { data: rules } = useAlertRules()
  const inscrire = useAddSoutienInscription()
  const [erreur, setErreur] = useState('')
  const [inscritA, setInscritA] = useState<string | null>(null)

  const lignes = useMemo(() => {
    const aujourdhui = aujourdhuiLocalISO()
    const notes = getStudentExtraSnapshot(studentId).notes
    const scale = moyenneScaleForClasse(classe)
    const cycle = cycleOfClasse(classe)
    const seuil = cycle ? rules?.[cycle]?.seuilMoyennePedagogique : undefined
    const contexte = buildConflitsContext()
    const transport = transportInfoOf(studentId)
    return seances
      .filter((s) => !seanceTerminee(s, aujourdhui))
      .map((s) => {
        const row = notes.find((n) => normalizeText(n.subject) === normalizeText(s.matiere))
        const moyenne = row ? computeSubjectMoyenne(row) : null
        const cours = contexte.coursClasse(classe, s.jour).find((p) => p.start < s.heureFin && s.heureDebut < p.end)
        const inscription = inscriptions.find((i) => i.seanceId === s.id && i.studentId === studentId)
        return {
          seance: s,
          moyenne,
          scale,
          sousSeuil: moyenne !== null && seuil !== undefined && moyenne < seuil,
          cours,
          inscription,
          car: alerteCar(s, transport),
          transport,
        }
      })
      .sort(
        (a, b) =>
          Number(b.sousSeuil) - Number(a.sousSeuil) ||
          JOURS_SOUTIEN.indexOf(a.seance.jour) - JOURS_SOUTIEN.indexOf(b.seance.jour) ||
          a.seance.heureDebut.localeCompare(b.seance.heureDebut),
      )
  }, [seances, inscriptions, rules, studentId, classe])

  const handleInscrire = async (seanceId: string) => {
    setErreur('')
    try {
      await inscrire.mutateAsync({ seanceId, studentId })
      setInscritA(seanceId)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Inscription impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-label="Proposer le soutien">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <GraduationCap className="h-5 w-5 text-violet-500" />
              Proposer le soutien
            </h2>
            <p className="text-sm text-slate-500">
              {studentName} <span className="text-slate-400">({classe})</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 overflow-y-auto px-6 py-4">
          {lignes.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Aucune séance de soutien en cours. Créez-en une dans Emplois du Temps → Soutien & Sorties.
            </p>
          )}
          {lignes.map(({ seance: s, moyenne, scale, sousSeuil, cours, inscription, car, transport }) => (
            <article key={s.id} className={`rounded-xl border p-3.5 ${sousSeuil ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {s.matiere} <span className="font-semibold text-violet-700">{libelleCreneau(s)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.teacherId ? (teachers.find((t) => t.id === s.teacherId) ? teacherName(teachers.find((t) => t.id === s.teacherId)!) : 'Enseignant introuvable') : "Pas d'enseignant"}
                    {' · '}
                    {s.dateFin ? `du ${dateCourte(s.dateDebut)} au ${dateCourte(s.dateFin)}` : `depuis le ${dateCourte(s.dateDebut)}`}
                  </p>
                </div>
                {inscription ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Inscrit · {statutSoutienLabel(inscription.statut, transport.aTransportSoir)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInscrire(s.id)}
                    disabled={inscrire.isPending}
                    className="shrink-0 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
                  >
                    Inscrire
                  </button>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                {moyenne !== null && scale !== null && (
                  <span className={sousSeuil ? 'font-semibold text-violet-700' : 'text-slate-500'}>
                    Moyenne en {s.matiere} : {chiffre(moyenne)}/{scale}
                    {sousSeuil ? ' (sous le seuil)' : ''}
                  </span>
                )}
                {moyenne === null && <span className="text-slate-400">Pas de note en {s.matiere}</span>}
                {cours && (
                  <span className="flex items-center gap-1 font-medium text-amber-700">
                    <TriangleAlert className="h-3 w-3" />
                    Cours de la classe à ce moment ({cours.libelle})
                  </span>
                )}
                {car && (
                  <span className="flex items-center gap-1 font-medium text-amber-700">
                    <Bus className="h-3 w-3" />
                    Transport du soir à {car} : la séance finit après
                  </span>
                )}
              </div>
              {inscritA === s.id && <p className="mt-1.5 text-xs font-medium text-emerald-700">Inscrit : la famille est à prévenir dans Emplois du Temps → Soutien & Sorties → Confirmations.</p>}
            </article>
          ))}
          {erreur && <p className="text-sm text-rose-600">{erreur}</p>}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
