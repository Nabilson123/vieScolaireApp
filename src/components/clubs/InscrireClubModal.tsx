import { useMemo, useState } from 'react'
import { Bus, TriangleAlert, Trophy, X } from 'lucide-react'
import { getStudentsSnapshot } from '../../services/studentsService'
import { useClubInscriptions, useClubs, useInscrireClub } from '../../services/clubsService'
import { alerteTransportClub } from '../../utils/clubsContexte'
import { clubComplet, niveauAutorise } from '../../utils/clubs'
import { libelleMois, moisDe } from '../../utils/clubsFinance'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'
import StudentSearchSelect from '../StudentSearchSelect'

interface Props {
  /** Club présélectionné (inscription depuis la carte d'un club). */
  clubId?: string
  /** Élève présélectionné (inscription depuis une fiche élève). */
  studentId?: string
  onClose: () => void
  /** Message à afficher dans la page après l'inscription. */
  onDone?: (message: string) => void
}

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none'

/** Inscrit un élève à un club : contrôle du niveau (dérogation à confirmer), liste d'attente si complet, avertissement transport, exonération. */
export default function InscrireClubModal({ clubId: clubInitial, studentId: eleveInitial, onClose, onDone }: Props) {
  const { data: clubs = [] } = useClubs()
  const { data: inscriptions = [] } = useClubInscriptions()
  const inscrire = useInscrireClub()
  const students = getStudentsSnapshot()

  const clubsOuverts = useMemo(() => clubs.filter((c) => !c.archive).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), [clubs])
  const [clubId, setClubId] = useState(clubInitial ?? clubsOuverts[0]?.id ?? '')
  const [studentId, setStudentId] = useState(eleveInitial ?? '')
  const [dateInscription, setDateInscription] = useState(aujourdhuiLocalISO())
  const [exonere, setExonere] = useState(false)
  const [motif, setMotif] = useState('')
  const [derogation, setDerogation] = useState(false)
  const [erreur, setErreur] = useState('')

  const club = clubs.find((c) => c.id === clubId)
  const eleve = students.find((s) => s.id === studentId)
  const existante = inscriptions.find((i) => i.clubId === clubId && i.studentId === studentId)
  const dejaInscrit = existante?.statut === 'actif' || existante?.statut === 'attente'
  const niveauHors = !!club && !!eleve && !niveauAutorise(club, eleve.classe)
  const complet = !!club && clubComplet(club, inscriptions)
  const depart = club && studentId ? alerteTransportClub(club, studentId) : null

  const dateValide = !!dateInscription
  const canSubmit = !!club && !!eleve && !dejaInscrit && dateValide && (!niveauHors || derogation) && (!exonere || motif.trim() !== '') && !inscrire.isPending

  const handleSubmit = async () => {
    if (!canSubmit || !club || !eleve) return
    setErreur('')
    try {
      const r = await inscrire.mutateAsync({ clubId: club.id, studentId: eleve.id, dateInscription, exonere, motifExoneration: motif, derogationNiveau: niveauHors && derogation })
      onDone?.(r.statut === 'attente' ? `${eleve.name} est sur la liste d'attente du club « ${club.nom} » (club complet).` : `${eleve.name} est inscrit(e) au club « ${club.nom} ».`)
      onClose()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Inscription impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Trophy className="h-5 w-5 text-amber-500" />
            Inscrire un élève à un club
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Club*</label>
            <select
              value={clubId}
              onChange={(e) => {
                setClubId(e.target.value)
                setDerogation(false)
              }}
              className={INPUT}
              disabled={!!clubInitial}
            >
              {clubsOuverts.length === 0 && <option value="">Aucun club ouvert</option>}
              {clubsOuverts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élève*</label>
            <StudentSearchSelect
              students={students}
              value={studentId}
              onChange={(id) => {
                setStudentId(id)
                setDerogation(false)
              }}
              placeholder="Rechercher un élève (nom ou classe)…"
              disabled={!!eleveInitial}
            />
          </div>

          {dejaInscrit && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              {existante?.statut === 'actif' ? 'Cet élève est déjà inscrit à ce club.' : "Cet élève est déjà sur la liste d'attente de ce club."}
            </p>
          )}
          {existante?.statut === 'arrete' && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Cet élève avait quitté ce club : il sera réinscrit (ses éventuels impayés d'avant restent dus).</p>}

          {niveauHors && club && eleve && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <p className="flex items-start gap-2 font-medium">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Le club est réservé aux niveaux {club.niveaux.join(', ')} ; {eleve.name} est en {eleve.classe}.
                </span>
              </p>
              <label className="mt-2 flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={derogation} onChange={(e) => setDerogation(e.target.checked)} />
                Inscrire malgré tout (dérogation)
              </label>
            </div>
          )}

          {complet && club && !dejaInscrit && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
              Le club est complet ({club.placesMax} place{(club.placesMax ?? 0) > 1 ? 's' : ''}) : l'élève sera placé sur la liste d'attente et rien ne sera facturé tant que vous ne l'aurez pas promu.
            </p>
          )}

          {depart && club && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <Bus className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Cet élève prend le transport du soir (départ {depart}) et le club se termine à {club.heureFin} : il ne pourra pas le prendre ces jours-là. L'inscription reste possible.
              </span>
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date d'inscription</label>
            <input type="date" value={dateInscription} onChange={(e) => setDateInscription(e.target.value)} className={INPUT} />
            {club && dateValide && !complet && <p className="mt-1 text-[11px] text-slate-400">Le mois d'inscription est dû en entier : première mensualité {libelleMois(moisDe(dateInscription) > club.moisDebut ? moisDe(dateInscription) : club.moisDebut)}.</p>}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={exonere} onChange={(e) => setExonere(e.target.checked)} />
              Exonéré (ne paie pas la mensualité)
            </label>
            {exonere && (
              <input value={motif} onChange={(e) => setMotif(e.target.value)} className={`${INPUT} mt-2`} placeholder="Motif de l'exonération (obligatoire)" />
            )}
          </div>

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
            {complet ? "Mettre sur la liste d'attente" : 'Inscrire'}
          </button>
        </div>
      </div>
    </div>
  )
}
