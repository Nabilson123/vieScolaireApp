import { useState } from 'react'
import { Clock, DoorOpen, Lock, Trophy, User, UserPlus } from 'lucide-react'
import { STATUT_INSCRIPTION_LABELS, libelleClub } from '../../data/clubs'
import { JOUR_LABELS } from '../../data/soutien'
import { useClubsFinance } from '../../hooks/useClubsFinance'
import { getModuleAccess, useCurrentProfile } from '../../services/permissions'
import { useIsViewedYearEditable } from '../../services/viewedYear'
import { clubsDeLEleve, listeAttente, seancesTriees } from '../../utils/clubs'
import { encadrantDuClub, salleDuClub } from '../../utils/clubsContexte'
import { STATUT_ECHEANCE_LABELS, formatDH, libelleMois, soldeDeLignes, type StatutEcheance } from '../../utils/clubsFinance'
import InscrireClubModal from '../clubs/InscrireClubModal'

const STATUT_STYLE: Record<StatutEcheance, string> = {
  payee: 'bg-emerald-50 text-emerald-700',
  exoneree: 'bg-violet-50 text-violet-700',
  en_retard: 'bg-rose-100 text-rose-700',
  partielle: 'bg-amber-100 text-amber-800',
  due: 'bg-sky-50 text-sky-700',
  a_venir: 'bg-slate-50 text-slate-400',
}

function dateCourte(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/**
 * Clubs de l'élève : ses inscriptions pour tout le personnel ; le tarif, les mensualités et les paiements seulement avec le
 * droit sur les paiements des clubs.
 */
export default function ClubsTab({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { clubs, inscriptions, lignes, paiementsConnus, aujourdhui } = useClubsFinance()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEdit = canEditYear && getModuleAccess(profile, 'clubs').canEdit
  const [inscrire, setInscrire] = useState(false)
  const [notice, setNotice] = useState('')

  const siens = clubsDeLEleve(clubs, inscriptions, studentId).sort((a, b) => Number(a.inscription.statut === 'arrete') - Number(b.inscription.statut === 'arrete') || libelleClub(a.club).localeCompare(libelleClub(b.club), 'fr'))
  const mensualites = lignes.filter((l) => l.studentId === studentId)
  const solde = soldeDeLignes(mensualites, aujourdhui)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Trophy className="h-5 w-5 text-amber-500" />
          Clubs de {studentName}
        </h2>
        {canEdit && (
          <button type="button" onClick={() => setInscrire(true)} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600">
            <UserPlus className="h-4 w-4" />
            Inscrire à un club
          </button>
        )}
      </div>

      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</p>}

      {siens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Cet élève n'est inscrit à aucun club.</div>
      ) : (
        <div className="space-y-3">
          {siens.map(({ club, inscription }) => {
            const rang = inscription.statut === 'attente' ? listeAttente(inscriptions, club.id).findIndex((i) => i.id === inscription.id) + 1 : 0
            const duClub = mensualites.filter((l) => l.inscriptionId === inscription.id)
            const encadrant = encadrantDuClub(club)
            const salle = salleDuClub(club)
            return (
              <article key={inscription.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${inscription.statut === 'arrete' ? 'border-slate-200 opacity-70' : 'border-amber-100'}`}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-slate-900">{libelleClub(club)}</p>
                    <div className="flex items-start gap-1.5 text-sm font-semibold text-amber-700">
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
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${inscription.statut === 'actif' ? 'bg-emerald-50 text-emerald-700' : inscription.statut === 'attente' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                    {STATUT_INSCRIPTION_LABELS[inscription.statut]}
                    {inscription.statut === 'attente' && rang > 0 ? ` (rang ${rang})` : ''}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {encadrant || <span className="text-slate-400">Pas d'encadrant</span>}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <DoorOpen className="h-3.5 w-3.5 text-slate-400" />
                    {salle || <span className="text-slate-400">Pas de salle</span>}
                  </p>
                  <p className="text-slate-500">
                    {inscription.statut === 'arrete' ? `Arrêté le ${dateCourte(inscription.dateArret)}` : `${inscription.statut === 'attente' ? 'Demande' : 'Inscrit'} le ${dateCourte(inscription.dateInscription)}`}
                    {paiementsConnus && inscription.exonere && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Exonéré{inscription.motifExoneration ? ` : ${inscription.motifExoneration}` : ''}</span>}
                  </p>
                </div>

                {paiementsConnus && duClub.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {duClub.map((l) => (
                      <span key={l.echeanceId} title={`${STATUT_ECHEANCE_LABELS[l.statut]} — ${formatDH(l.montantCentimes)}, payé ${formatDH(l.payeCentimes)}`} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${STATUT_STYLE[l.statut]}`}>
                        {l.type === 'inscription' ? "Frais d'inscription" : libelleMois(l.mois).replace(/ \d{4}$/, '')} · {STATUT_ECHEANCE_LABELS[l.statut]}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {paiementsConnus ? (
        mensualites.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Attendu', valeur: formatDH(solde.attenduCentimes), ton: 'text-slate-900' },
              { label: 'Payé', valeur: formatDH(solde.payeCentimes), ton: 'text-emerald-600' },
              { label: 'Reste dû (échu)', valeur: formatDH(solde.resteEchuCentimes), ton: solde.resteEchuCentimes > 0 ? 'text-rose-600' : 'text-slate-900' },
              { label: 'À venir', valeur: formatDH(solde.resteAVenirCentimes), ton: 'text-slate-600' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</p>
                <p className={`mt-0.5 text-lg font-bold ${t.ton}`}>{t.valeur}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        siens.length > 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Les tarifs, les mensualités et les paiements sont réservés aux personnes qui ont le droit « Paiements des clubs ».
          </p>
        )
      )}

      {inscrire && <InscrireClubModal studentId={studentId} onClose={() => setInscrire(false)} onDone={setNotice} />}
    </div>
  )
}
