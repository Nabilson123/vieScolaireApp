import { useMemo, useState } from 'react'
import { ArrowUpCircle, Bus, CheckCircle2, ChevronDown, ChevronRight, LogOut, Printer, RotateCcw, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import { STATUT_INSCRIPTION_LABELS, type Club, type ClubInscription } from '../../data/clubs'
import { JOUR_LABELS } from '../../data/soutien'
import { useArreterInscription, useClubInscriptions, useClubs, usePromouvoirInscription, useSetExoneration } from '../../services/clubsService'
import { getStudentsSnapshot } from '../../services/studentsService'
import { clubComplet, inscritsActifs, inscritsArretes, listeAttente, placesRestantes } from '../../utils/clubs'
import { alerteTransportClub, feuilleDuClub } from '../../utils/clubsContexte'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'
import ClubsPrintPreviewModal, { type DocumentClub } from '../clubs-print/ClubsPrintPreviewModal'
import InscrireClubModal from './InscrireClubModal'

interface Props {
  isEditable: boolean
  /** Club à afficher d'emblée (depuis « Voir les inscrits » du catalogue) ; vide = tous. */
  clubInitial?: string
}

type Action = { type: 'arreter'; id: string; date: string } | { type: 'exonerer'; id: string; motif: string }

const INPUT = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none'

function dateCourte(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Inscrits de chaque club : actifs, liste d'attente et arrêtés ; promouvoir, arrêter, exonérer, ré-inscrire. */
export default function InscritsPanel({ isEditable, clubInitial }: Props) {
  const { data: clubs = [] } = useClubs()
  const { data: inscriptions = [] } = useClubInscriptions()
  const arreter = useArreterInscription()
  const promouvoir = usePromouvoirInscription()
  const exonerer = useSetExoneration()

  const [clubFiltre, setClubFiltre] = useState(clubInitial ?? '')
  const [recherche, setRecherche] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [arretesOuverts, setArretesOuverts] = useState<Set<string>>(new Set())
  const [inscrire, setInscrire] = useState<{ clubId: string; studentId?: string } | null>(null)
  const [notice, setNotice] = useState('')
  const [erreur, setErreur] = useState('')
  const [document, setDocument] = useState<DocumentClub | null>(null)

  const eleves = useMemo(() => new Map(getStudentsSnapshot().map((s) => [s.id, s])), [inscriptions])
  const terme = recherche.trim().toLowerCase()
  const clubsAffiches = useMemo(
    () => clubs.filter((c) => !c.archive && (!clubFiltre || c.id === clubFiltre)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [clubs, clubFiltre],
  )

  const correspond = (i: ClubInscription) => {
    if (!terme) return true
    const s = eleves.get(i.studentId)
    return !!s && `${s.name} ${s.classe}`.toLowerCase().includes(terme)
  }
  const parNom = (a: ClubInscription, b: ClubInscription) => (eleves.get(a.studentId)?.name ?? '').localeCompare(eleves.get(b.studentId)?.name ?? '', 'fr')

  const reussi = (message: string) => {
    setErreur('')
    setNotice(message)
    setAction(null)
  }
  const echec = (e: unknown) => {
    setNotice('')
    setErreur(e instanceof Error ? e.message : 'Action impossible.')
  }

  const nomEleve = (i: ClubInscription) => eleves.get(i.studentId)?.name ?? 'Élève introuvable'

  const ligne = (club: Club, i: ClubInscription, rang?: number) => {
    const s = eleves.get(i.studentId)
    const depart = i.statut !== 'arrete' ? alerteTransportClub(club, i.studentId) : null
    const enAction = action && action.id === i.id ? action : null
    return (
      <li key={i.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium text-slate-700">
            {rang !== undefined && <span className="mr-2 text-xs font-bold text-slate-400">{rang}.</span>}
            {nomEleve(i)} {s && <span className="text-slate-400">({s.classe})</span>}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {i.exonere && (
              <span title={i.motifExoneration || 'Exonéré'} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                <ShieldCheck className="h-3 w-3" />
                Exonéré{i.motifExoneration ? ` : ${i.motifExoneration}` : ''}
              </span>
            )}
            {i.derogationNiveau && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Dérogation de niveau</span>}
            {depart && (
              <span title={`Au transport du soir, départ ${depart} : le club se termine après`} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                <Bus className="h-3 w-3" />
                {depart}
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              {i.statut === 'arrete' ? `arrêté le ${dateCourte(i.dateArret)}` : `${i.statut === 'attente' ? 'demandé' : 'inscrit'} le ${dateCourte(i.dateInscription)}`}
            </span>
            {isEditable && (
              <span className="flex items-center gap-1">
                {i.statut === 'attente' && (
                  <button
                    type="button"
                    disabled={clubComplet(club, inscriptions) || promouvoir.isPending}
                    title={clubComplet(club, inscriptions) ? 'Le club est complet' : 'Promouvoir'}
                    onClick={() => promouvoir.mutate(i.id, { onSuccess: () => reussi(`${nomEleve(i)} est maintenant inscrit(e) à « ${club.nom} ».`), onError: echec })}
                    className="flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUpCircle className="h-3 w-3" />
                    Promouvoir
                  </button>
                )}
                {i.statut === 'actif' && (
                  <button
                    type="button"
                    onClick={() => setAction(enAction?.type === 'exonerer' ? null : { type: 'exonerer', id: i.id, motif: i.motifExoneration })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {i.exonere ? 'Exonération' : 'Exonérer'}
                  </button>
                )}
                {i.statut !== 'arrete' && (
                  <button
                    type="button"
                    onClick={() => setAction(enAction?.type === 'arreter' ? null : { type: 'arreter', id: i.id, date: aujourdhuiLocalISO() })}
                    className="flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-3 w-3" />
                    {i.statut === 'attente' ? 'Retirer' : 'Arrêter'}
                  </button>
                )}
                {i.statut === 'arrete' && (
                  <button type="button" onClick={() => setInscrire({ clubId: club.id, studentId: i.studentId })} className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                    <RotateCcw className="h-3 w-3" />
                    Ré-inscrire
                  </button>
                )}
              </span>
            )}
          </span>
        </div>

        {enAction?.type === 'arreter' && (
          <div className="mt-2 space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
            <p className="text-xs font-semibold text-rose-700">
              {i.statut === 'attente'
                ? `Retirer ${nomEleve(i)} de la liste d'attente ?`
                : `Arrêter ${nomEleve(i)} ? Le mois d'arrêt reste dû ; les mensualités suivantes non réglées sont supprimées.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {i.statut !== 'attente' && (
                <>
                  <label className="text-xs font-medium text-slate-600">Date d'arrêt</label>
                  <input type="date" value={enAction.date} onChange={(e) => setAction({ ...enAction, date: e.target.value })} className={INPUT} />
                </>
              )}
              <button
                type="button"
                disabled={arreter.isPending || (i.statut !== 'attente' && !enAction.date)}
                onClick={() => arreter.mutate({ id: i.id, dateArret: enAction.date }, { onSuccess: () => reussi(i.statut === 'attente' ? `${nomEleve(i)} est retiré(e) de la liste d'attente.` : `${nomEleve(i)} a quitté le club « ${club.nom} ».`), onError: echec })}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                Confirmer
              </button>
              <button type="button" onClick={() => setAction(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
            </div>
          </div>
        )}

        {enAction?.type === 'exonerer' && (
          <div className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-2.5">
            <p className="text-xs font-semibold text-violet-700">
              {i.exonere ? 'Exonération en cours : retirez-la ou modifiez le motif. Seuls les mois sans règlement changent.' : 'Exonérer cet élève : ses mensualités sans règlement passent à 0. Les mois déjà payés ne changent pas.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={enAction.motif} onChange={(e) => setAction({ ...enAction, motif: e.target.value })} className={`${INPUT} min-w-[14rem] flex-1`} placeholder="Motif de l'exonération (obligatoire)" />
              <button
                type="button"
                disabled={exonerer.isPending || enAction.motif.trim() === ''}
                onClick={() => exonerer.mutate({ id: i.id, exonere: true, motif: enAction.motif }, { onSuccess: () => reussi(`${nomEleve(i)} est exonéré(e).`), onError: echec })}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {i.exonere ? 'Mettre à jour' : 'Exonérer'}
              </button>
              {i.exonere && (
                <button
                  type="button"
                  disabled={exonerer.isPending}
                  onClick={() => exonerer.mutate({ id: i.id, exonere: false, motif: '' }, { onSuccess: () => reussi(`L'exonération de ${nomEleve(i)} est retirée.`), onError: echec })}
                  className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                >
                  Retirer l'exonération
                </button>
              )}
              <button type="button" onClick={() => setAction(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Fermer
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Users className="h-5 w-5 text-amber-500" />
            Inscrits aux clubs
          </h2>
          <p className="text-xs text-slate-500">Le mois d'inscription et le mois d'arrêt sont dus en entier ; la liste d'attente n'est pas facturée.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={clubFiltre} onChange={(e) => setClubFiltre(e.target.value)} className={INPUT} aria-label="Filtrer par club">
            <option value="">Tous les clubs</option>
            {clubs
              .filter((c) => !c.archive)
              .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
          </select>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un élève ou une classe…" className={`${INPUT} w-60`} />
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice('')} aria-label="Fermer" className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {erreur && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <span>{erreur}</span>
          <button type="button" onClick={() => setErreur('')} aria-label="Fermer" className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {clubsAffiches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Aucun club à afficher.</div>
      ) : (
        <div className="space-y-5">
          {clubsAffiches.map((club) => {
            const actifs = inscritsActifs(inscriptions, club.id).filter(correspond).sort(parNom)
            const attente = listeAttente(inscriptions, club.id).filter(correspond)
            const arretes = inscritsArretes(inscriptions, club.id).filter(correspond).sort(parNom)
            const restantes = placesRestantes(club, inscriptions)
            const ouvert = arretesOuverts.has(club.id)
            return (
              <section key={club.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{club.nom}</h3>
                    <p className="text-xs text-slate-500">
                      {JOUR_LABELS[club.jour]} {club.heureDebut} – {club.heureFin} ·{' '}
                      {club.placesMax === null ? `${inscritsActifs(inscriptions, club.id).length} inscrits` : `${inscritsActifs(inscriptions, club.id).length} / ${club.placesMax} places`}
                      {restantes === 0 && <span className="ml-1 font-semibold text-rose-600">· complet</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setDocument({ type: 'liste', feuilles: [feuilleDuClub(club)] })} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <Printer className="h-3.5 w-3.5" />
                      Liste (PDF)
                    </button>
                    {isEditable && (
                      <button type="button" onClick={() => setInscrire({ clubId: club.id })} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
                        <UserPlus className="h-3.5 w-3.5" />
                        Inscrire un élève
                      </button>
                    )}
                  </div>
                </div>

                {actifs.length === 0 && attente.length === 0 && arretes.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">{terme ? 'Aucun élève ne correspond.' : "Aucun élève inscrit pour l'instant."}</p>
                ) : (
                  <div className="space-y-3">
                    {actifs.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                          {STATUT_INSCRIPTION_LABELS.actif}s ({actifs.length})
                        </p>
                        <ul className="space-y-1.5">{actifs.map((i) => ligne(club, i))}</ul>
                      </div>
                    )}
                    {attente.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-sky-700">
                          {STATUT_INSCRIPTION_LABELS.attente} ({attente.length})
                        </p>
                        <ul className="space-y-1.5">{attente.map((i, idx) => ligne(club, i, idx + 1))}</ul>
                      </div>
                    )}
                    {arretes.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setArretesOuverts((prev) => {
                              const suivant = new Set(prev)
                              if (suivant.has(club.id)) suivant.delete(club.id)
                              else suivant.add(club.id)
                              return suivant
                            })
                          }
                          className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-slate-600"
                        >
                          {ouvert ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          {STATUT_INSCRIPTION_LABELS.arrete}s ({arretes.length})
                        </button>
                        {ouvert && <ul className="space-y-1.5">{arretes.map((i) => ligne(club, i))}</ul>}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {inscrire && <InscrireClubModal clubId={inscrire.clubId} studentId={inscrire.studentId} onClose={() => setInscrire(null)} onDone={reussi} />}
      {document && <ClubsPrintPreviewModal document={document} onClose={() => setDocument(null)} />}
    </div>
  )
}
