import { Bus, Clock, DoorOpen, GraduationCap, Pencil, User, X } from 'lucide-react'
import { statutSoutienLabel, type SoutienSeance, type StatutSoutien } from '../../data/soutien'
import { fullLabel } from '../../data/salles'
import { teacherName } from '../../data/teachers'
import { getStudentsSnapshot } from '../../services/studentsService'
import { useSalles } from '../../services/sallesService'
import { useTeachers } from '../../services/teachersService'
import { useSoutienInscriptions } from '../../services/soutienService'
import { alerteCar } from '../../utils/soutien'
import { transportInfoOf } from '../../utils/soutienContexte'
import { inscritsDeLaSeance, libelleCreneau } from '../../utils/soutienSeances'

const STATUT_STYLE: Record<StatutSoutien, string> = {
  a_confirmer: 'bg-amber-50 text-amber-700',
  reste: 'bg-emerald-50 text-emerald-700',
  ne_reste_pas: 'bg-slate-100 text-slate-600',
}

interface Props {
  seance: SoutienSeance
  /** Grille d'une classe : seuls les élèves de cette classe sont listés. */
  classe?: string
  onClose: () => void
  onEdit?: () => void
}

/** Détail d'une séance de soutien ouvert depuis un bloc hachuré de la grille : horaire, enseignant, salle et élèves inscrits. */
export default function SoutienSeanceDetailModal({ seance, classe, onClose, onEdit }: Props) {
  const { data: inscriptions = [] } = useSoutienInscriptions()
  const { data: teachers = [] } = useTeachers()
  const { data: salles = [] } = useSalles()
  const students = new Map(getStudentsSnapshot().map((s) => [s.id, s]))
  const prof = teachers.find((t) => t.id === seance.teacherId)
  const salle = salles.find((s) => s.id === seance.salleId)

  const lignes = inscritsDeLaSeance(inscriptions, seance.id)
    .map((i) => ({ i, student: students.get(i.studentId) }))
    .filter((l): l is { i: typeof l.i; student: NonNullable<typeof l.student> } => !!l.student && (!classe || l.student.classe === classe))
    .sort((a, b) => a.student.classe.localeCompare(b.student.classe, 'fr') || a.student.name.localeCompare(b.student.name, 'fr'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <GraduationCap className="h-5 w-5 text-violet-500" />
              Soutien — {seance.matiere}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-violet-700">
              <Clock className="h-3.5 w-3.5" />
              {libelleCreneau(seance)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-1 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              {prof ? teacherName(prof) : <span className="text-slate-400">Pas d'enseignant</span>}
            </p>
            <p className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-slate-400" />
              {salle ? fullLabel(salle) : <span className="text-slate-400">Pas de salle</span>}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {classe ? `Élèves de ${classe}` : 'Élèves inscrits'} ({lignes.length})
            </p>
            {lignes.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">Aucun élève inscrit{classe ? ' dans cette classe' : ''}.</p>
            ) : (
              <ul className="space-y-1.5">
                {lignes.map(({ i, student }) => {
                  const transport = transportInfoOf(student.id)
                  const car = alerteCar(seance, transport)
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-700">
                        {student.name} {!classe && <span className="text-slate-400">({student.classe})</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {car && (
                          <span title={`Au transport du soir, départ ${car} : la séance se termine après`} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            <Bus className="h-3 w-3" />
                            {car}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUT_STYLE[i.statut]}`}>{statutSoutienLabel(i.statut, transport.aTransportSoir)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {onEdit && (
          <div className="flex justify-end border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Pencil className="h-4 w-4" />
              Modifier la séance
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
