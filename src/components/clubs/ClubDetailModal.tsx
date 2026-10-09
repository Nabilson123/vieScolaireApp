import { Bus, Clock, DoorOpen, Pencil, Trophy, User, X } from 'lucide-react'
import { libelleClub, type Club } from '../../data/clubs'
import { JOUR_LABELS } from '../../data/soutien'
import { getStudentsSnapshot } from '../../services/studentsService'
import { useClubInscriptions } from '../../services/clubsService'
import { inscritsActifs, seancesTriees } from '../../utils/clubs'
import { alerteTransportClub, encadrantDuClub, salleDuClub } from '../../utils/clubsContexte'
import { libelleMois } from '../../utils/clubsFinance'

interface Props {
  club: Club
  onClose: () => void
  /** Ouvre la modification du club (pour qui peut le faire). */
  onEdit?: () => void
}

/** Détail d'un club ouvert depuis un bloc ambre de la grille de l'encadrant : horaire, encadrant, salle et élèves inscrits (aucun montant). */
export default function ClubDetailModal({ club, onClose, onEdit }: Props) {
  const { data: inscriptions = [] } = useClubInscriptions()
  const eleves = new Map(getStudentsSnapshot().map((s) => [s.id, s]))
  const encadrant = encadrantDuClub(club)
  const salle = salleDuClub(club)
  const inscrits = inscritsActifs(inscriptions, club.id)
    .map((i) => ({ i, eleve: eleves.get(i.studentId) }))
    .filter((l): l is { i: typeof l.i; eleve: NonNullable<typeof l.eleve> } => !!l.eleve)
    .sort((a, b) => a.eleve.classe.localeCompare(b.eleve.classe, 'fr') || a.eleve.name.localeCompare(b.eleve.name, 'fr'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Trophy className="h-5 w-5 text-amber-500" />
              Club — {libelleClub(club)}
            </h2>
            <div className="mt-0.5 flex items-start gap-1.5 text-sm font-semibold text-amber-700">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                {seancesTriees(club).map((s, i) => (
                  <p key={i}>
                    {JOUR_LABELS[s.jour]} {s.heureDebut} – {s.heureFin}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-1 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              {encadrant || <span className="text-slate-400">Pas d'encadrant</span>}
            </p>
            <p className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-slate-400" />
              {salle || <span className="text-slate-400">Pas de salle</span>}
            </p>
            <p className="text-xs text-slate-500">
              De {libelleMois(club.moisDebut)} à {libelleMois(club.moisFin)}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Élèves inscrits ({inscrits.length})</p>
            {inscrits.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">Aucun élève inscrit.</p>
            ) : (
              <ul className="space-y-1.5">
                {inscrits.map(({ i, eleve }) => {
                  const depart = alerteTransportClub(club, eleve.id)
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-700">
                        {eleve.name} <span className="text-slate-400">({eleve.classe})</span>
                      </span>
                      {depart && (
                        <span title={`Au transport du soir, départ ${depart} : le club se termine après`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <Bus className="h-3 w-3" />
                          {depart}
                        </span>
                      )}
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
              Modifier le club
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
