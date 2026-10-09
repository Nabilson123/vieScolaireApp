import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, CheckCircle2, Clock, DoorOpen, FileText, Pencil, PlusCircle, Printer, Trash2, Trophy, User, UserPlus, Users, X } from 'lucide-react'
import type { Club } from '../../data/clubs'
import { JOUR_LABELS } from '../../data/soutien'
import { useArchiveClub, useClubInscriptions, useClubs, useDeleteClub, useReconduireClubs } from '../../services/clubsService'
import { useSalles } from '../../services/sallesService'
import { useTeachers } from '../../services/teachersService'
import { datesDuClub, datesDuMois, inscritsActifs, listeAttente, placesRestantes } from '../../utils/clubs'
import { encadrantDuClub, feuilleDuClub, salleDuClub } from '../../utils/clubsContexte'
import { formatDH, libelleMois, moisDuClub } from '../../utils/clubsFinance'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'
import ClubsPrintPreviewModal, { type DocumentClub } from '../clubs-print/ClubsPrintPreviewModal'
import ClubModal from './ClubModal'
import InscrireClubModal from './InscrireClubModal'

type ChoixPresence = 'prochaine' | 'mois' | 'periode'

interface Props {
  isEditable: boolean
  /** Ouvre l'onglet « Inscrits » sur ce club. */
  onVoirInscrits: (clubId: string) => void
}

/** Catalogue des clubs de l'année : créer, modifier, archiver, inscrire, imprimer la liste ou la feuille de présence, reconduire l'an dernier. */
export default function ClubsCatalogue({ isEditable, onVoirInscrits }: Props) {
  const { data: clubs = [] } = useClubs()
  const { data: inscriptions = [] } = useClubInscriptions()
  // Abonnés pour que les noms d'enseignants et de salles se rafraîchissent.
  useTeachers()
  useSalles()
  const archiver = useArchiveClub()
  const supprimer = useDeleteClub()
  const reconduire = useReconduireClubs()

  const [modal, setModal] = useState<{ club?: Club } | null>(null)
  const [inscrireClubId, setInscrireClubId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [erreur, setErreur] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmReconduire, setConfirmReconduire] = useState(false)
  const [voirArchives, setVoirArchives] = useState(false)
  const [document, setDocument] = useState<DocumentClub | null>(null)
  const [presence, setPresence] = useState<{ clubId: string; choix: ChoixPresence; mois: string } | null>(null)

  const aujourdhui = aujourdhuiLocalISO()
  const archives = clubs.filter((c) => c.archive).length
  const visibles = useMemo(() => clubs.filter((c) => voirArchives || !c.archive), [clubs, voirArchives])

  const ouvrirPresence = (club: Club, choix: ChoixPresence, mois: string) => {
    const dates = choix === 'prochaine' ? datesDuClub(club, { depuis: aujourdhui, max: 1 }) : choix === 'mois' ? datesDuMois(club, mois) : datesDuClub(club)
    if (dates.length === 0) {
      setErreur('Aucune séance sur cette période.')
      return
    }
    setErreur('')
    setDocument({ type: 'presence', feuille: feuilleDuClub(club), dates, portee: choix === 'prochaine' ? 'prochaine séance' : choix === 'mois' ? libelleMois(mois) : 'toute la période' })
    setPresence(null)
  }

  const lancerReconduction = () => {
    setErreur('')
    reconduire.mutate(undefined, {
      onSuccess: (r) => {
        setConfirmReconduire(false)
        setNotice(
          r.crees === 0
            ? "Aucun club à recopier : tous ceux de l'année précédente existent déjà (ou aucun n'est ouvert)."
            : `${r.crees} club${r.crees > 1 ? 's recopiés' : ' recopié'} depuis l'année précédente${r.ignores > 0 ? ` (${r.ignores} déjà présent${r.ignores > 1 ? 's' : ''})` : ''}. Vérifiez les tarifs et les mois, puis inscrivez les élèves.`,
        )
      },
      onError: (e) => {
        setConfirmReconduire(false)
        setErreur(e instanceof Error ? e.message : 'Reconduction impossible.')
      },
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Trophy className="h-5 w-5 text-amber-500" />
            Clubs de l'année
          </h2>
          <p className="text-xs text-slate-500">Chaque club a lieu chaque semaine sur sa période, avec une mensualité unique pour tous ses inscrits.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {archives > 0 && (
            <button type="button" onClick={() => setVoirArchives((v) => !v)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              {voirArchives ? 'Masquer' : 'Voir'} les clubs archivés ({archives})
            </button>
          )}
          {visibles.length > 0 && (
            <button
              type="button"
              onClick={() => setDocument({ type: 'liste', feuilles: visibles.filter((c) => !c.archive).map(feuilleDuClub) })}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Listes des inscrits (PDF)
            </button>
          )}
          {isEditable && (
            <button type="button" onClick={() => setConfirmReconduire(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Reconduire les clubs
            </button>
          )}
          <button
            type="button"
            onClick={() => setModal({})}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Nouveau club
          </button>
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

      {confirmReconduire && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Recopier les clubs de l'année précédente dans cette année ?</p>
          <p className="mt-0.5 text-xs">On reprend le nom, l'encadrant, les horaires, les niveaux et le tarif (mois décalés d'un an). Aucun inscrit ni paiement n'est copié ; les clubs déjà présents ne sont pas dupliqués.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={lancerReconduction} disabled={reconduire.isPending} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
              {reconduire.isPending ? 'Reconduction…' : 'Reconduire'}
            </button>
            <button type="button" onClick={() => setConfirmReconduire(false)} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
              Annuler
            </button>
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          Aucun club pour cette année. {isEditable ? 'Créez-en un avec « Nouveau club », ou reprenez ceux de l\'an dernier avec « Reconduire les clubs ».' : ''}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles
            .slice()
            .sort((a, b) => Number(a.archive) - Number(b.archive) || a.nom.localeCompare(b.nom, 'fr'))
            .map((club) => {
              const actifs = inscritsActifs(inscriptions, club.id).length
              const attente = listeAttente(inscriptions, club.id).length
              const restantes = placesRestantes(club, inscriptions)
              const encadrant = encadrantDuClub(club)
              const salle = salleDuClub(club)
              const avecInscrits = inscriptions.some((i) => i.clubId === club.id)
              const choix = presence?.clubId === club.id ? presence : null
              return (
                <article key={club.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${club.archive ? 'border-slate-200 opacity-70' : 'border-amber-100'}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900">
                        {club.nom}
                        {club.archive && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Archivé</span>}
                      </p>
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        {JOUR_LABELS[club.jour]} {club.heureDebut} – {club.heureFin}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" title="Imprimer la liste des inscrits" aria-label="Imprimer la liste des inscrits" onClick={() => setDocument({ type: 'liste', feuilles: [feuilleDuClub(club)] })} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Feuille de présence"
                        aria-label="Feuille de présence"
                        onClick={() => setPresence(choix ? null : { clubId: club.id, choix: 'prochaine', mois: moisDuClub(club)[0] ?? club.moisDebut })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      {isEditable && (
                        <>
                          <button type="button" title="Modifier" aria-label="Modifier le club" onClick={() => setModal({ club })} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={club.archive ? 'Désarchiver' : 'Archiver'}
                            aria-label={club.archive ? 'Désarchiver le club' : 'Archiver le club'}
                            onClick={() => archiver.mutate({ id: club.id, archive: !club.archive })}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                          >
                            {club.archive ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </button>
                          {!avecInscrits && (
                            <button type="button" title="Supprimer" aria-label="Supprimer le club" onClick={() => setConfirmDelete(club.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {club.description && <p className="mb-2 text-xs text-slate-500">{club.description}</p>}

                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {encadrant ? encadrant : <span className="text-slate-400">Pas d'encadrant</span>}
                      {!club.teacherId && club.intervenantNom && <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500">externe</span>}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5 text-slate-400" />
                      {salle ? salle : <span className="text-slate-400">Pas de salle</span>}
                    </p>
                    <p className="text-slate-500">
                      De {libelleMois(club.moisDebut)} à {libelleMois(club.moisFin)} · <span className="font-semibold text-slate-700">{formatDH(club.mensualiteCentimes)}</span> par mois, due le {club.jourEcheance}
                    </p>
                  </div>

                  {club.niveaux.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {club.niveaux.map((n) => (
                        <span key={n} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                      {actifs}
                      {club.placesMax !== null ? ` / ${club.placesMax}` : ''} inscrit{actifs > 1 ? 's' : ''}
                    </span>
                    {restantes === 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600">Complet</span>}
                    {restantes !== null && restantes > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        {restantes} place{restantes > 1 ? 's' : ''} libre{restantes > 1 ? 's' : ''}
                      </span>
                    )}
                    {attente > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">{attente} en attente</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onVoirInscrits(club.id)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <Users className="h-3.5 w-3.5" />
                      Voir les inscrits
                    </button>
                    {isEditable && !club.archive && (
                      <button type="button" onClick={() => setInscrireClubId(club.id)} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
                        <UserPlus className="h-3.5 w-3.5" />
                        Inscrire un élève
                      </button>
                    )}
                  </div>

                  {choix && (
                    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-xs font-semibold text-slate-700">Feuille de présence pour…</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={choix.choix} onChange={(e) => setPresence({ ...choix, choix: e.target.value as ChoixPresence })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                          <option value="prochaine">la prochaine séance</option>
                          <option value="mois">les séances d'un mois</option>
                          <option value="periode">toute la période</option>
                        </select>
                        {choix.choix === 'mois' && (
                          <select value={choix.mois} onChange={(e) => setPresence({ ...choix, mois: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                            {moisDuClub(club).map((m) => (
                              <option key={m} value={m}>
                                {libelleMois(m)}
                              </option>
                            ))}
                          </select>
                        )}
                        <button type="button" onClick={() => ouvrirPresence(club, choix.choix, choix.mois)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
                          Aperçu
                        </button>
                        <button type="button" onClick={() => setPresence(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          Fermer
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">Une feuille par séance, avec les élèves inscrits et une case de présence à cocher à la main.</p>
                    </div>
                  )}

                  {confirmDelete === club.id && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-rose-700">Supprimer ce club ? Cette action est définitive.</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            supprimer.mutate(club.id, { onError: (e) => setErreur(e instanceof Error ? e.message : 'Suppression impossible.') })
                            setConfirmDelete(null)
                          }}
                          className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                        >
                          Supprimer
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
        </div>
      )}

      {modal && <ClubModal club={modal.club} onClose={() => setModal(null)} onSaved={setNotice} />}
      {inscrireClubId && <InscrireClubModal clubId={inscrireClubId} onClose={() => setInscrireClubId(null)} onDone={setNotice} />}
      {document && <ClubsPrintPreviewModal document={document} onClose={() => setDocument(null)} />}
    </div>
  )
}
