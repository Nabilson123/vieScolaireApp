import { useMemo, useState } from 'react'
import { Plus, Trophy, TriangleAlert, X } from 'lucide-react'
import type { Club, ClubSeance, JourClub } from '../../data/clubs'
import { NIVEAUX } from '../../data/referentiel'
import { fullLabel } from '../../data/salles'
import { JOURS_SOUTIEN, JOUR_LABELS } from '../../data/soutien'
import { apercuSynchroClub, tarifOuPeriodeModifie, useAddClub, useUpdateClub, type ClubInput, type ResumeSynchro } from '../../services/clubsService'
import { useSalles } from '../../services/sallesService'
import { useTeachers } from '../../services/teachersService'
import { dhVersCentimes, libelleMois, moisDe } from '../../utils/clubsFinance'
import { conflitsClub } from '../../utils/clubsContexte'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'
import TeacherSearchSelect from '../TeacherSearchSelect'

interface Props {
  /** Club à modifier ; absent pour une création. */
  club?: Club
  /** Fiche sœur dont on reprend le nom, l'encadrant, le tarif et les mois pour créer une nouvelle catégorie (U9 → U12…). */
  modele?: Club
  onClose: () => void
  /** Message à afficher dans la page après l'enregistrement. */
  onSaved?: (message: string) => void
}

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none'

/** Mois de démarrage proposé : celui d'aujourd'hui ; fin : juin de l'année scolaire en cours. */
function moisParDefaut(): { debut: string; fin: string } {
  const aujourdhui = aujourdhuiLocalISO()
  const annee = Number(aujourdhui.slice(0, 4))
  const mois = Number(aujourdhui.slice(5, 7))
  return { debut: moisDe(aujourdhui), fin: `${mois >= 8 ? annee + 1 : annee}-06-01` }
}

function dhEnTexte(centimes: number): string {
  return (centimes / 100).toFixed(2).replace(/\.00$/, '').replace('.', ',')
}

function resumeTexte(r: ResumeSynchro): string {
  const parts: string[] = []
  if (r.modifiees > 0) parts.push(`${r.modifiees} mensualité${r.modifiees > 1 ? 's' : ''} recalculée${r.modifiees > 1 ? 's' : ''}`)
  if (r.ajoutees > 0) parts.push(`${r.ajoutees} échéance${r.ajoutees > 1 ? 's' : ''} ajoutée${r.ajoutees > 1 ? 's' : ''} (frais d'inscription ou nouveaux mois)`)
  if (r.supprimees > 0) parts.push(`${r.supprimees} supprimée${r.supprimees > 1 ? 's' : ''}`)
  return parts.join(', ')
}

const SEANCE_PAR_DEFAUT: ClubSeance = { jour: 'MERCREDI', heureDebut: '14:00', heureFin: '15:30', salleId: null }

const seanceValide = (s: ClubSeance) => !!s.heureDebut && !!s.heureFin && s.heureFin > s.heureDebut

/** Création et modification d'un club : encadrant, séances de la semaine (jour, heures, salle), places, niveaux, tarif et mois facturés. */
export default function ClubModal({ club, modele, onClose, onSaved }: Props) {
  const { data: teachers = [] } = useTeachers()
  const { data: salles = [] } = useSalles()
  const add = useAddClub()
  const update = useUpdateClub()
  const defauts = useMemo(moisParDefaut, [])
  // Les réglages communs à toutes les catégories d'une activité viennent du club modifié, ou de la fiche sœur d'une nouvelle catégorie.
  const source = club ?? modele

  const [nom, setNom] = useState(source?.nom ?? '')
  const [categorie, setCategorie] = useState(club?.categorie ?? '')
  const [description, setDescription] = useState(source?.description ?? '')
  const [encadrant, setEncadrant] = useState<'ecole' | 'externe'>(source && !source.teacherId && source.intervenantNom ? 'externe' : 'ecole')
  const [teacherId, setTeacherId] = useState(source?.teacherId ?? '')
  const [intervenantNom, setIntervenantNom] = useState(source?.intervenantNom ?? '')
  const [seances, setSeances] = useState<ClubSeance[]>(club && club.seances.length > 0 ? club.seances : [SEANCE_PAR_DEFAUT])
  const [placesMax, setPlacesMax] = useState(club?.placesMax != null ? String(club.placesMax) : '')
  const [niveaux, setNiveaux] = useState<string[]>(club?.niveaux ?? [])
  const [mensualite, setMensualite] = useState(source ? dhEnTexte(source.mensualiteCentimes) : '')
  const [frais, setFrais] = useState(source && source.fraisInscriptionCentimes > 0 ? dhEnTexte(source.fraisInscriptionCentimes) : '')
  const [moisDebut, setMoisDebut] = useState(source?.moisDebut ?? defauts.debut)
  const [moisFin, setMoisFin] = useState(source?.moisFin ?? defauts.fin)
  const [jourEcheance, setJourEcheance] = useState(String(source?.jourEcheance ?? 5))
  const [delaiGrace, setDelaiGrace] = useState(String(source?.delaiGraceJours ?? 5))
  const [erreur, setErreur] = useState('')
  const [aConfirmer, setAConfirmer] = useState<ResumeSynchro | null>(null)
  const [verification, setVerification] = useState(false)

  const centimes = dhVersCentimes(mensualite)
  const seancesValides = seances.length > 0 && seances.every(seanceValide)
  const moisValides = !!moisDebut && !!moisFin && moisFin >= moisDebut
  const echeance = Number(jourEcheance)
  const grace = Number(delaiGrace)
  const places = placesMax.trim() === '' ? null : Number(placesMax)
  const placesValides = places === null || (Number.isInteger(places) && places > 0)
  const tarifValide = centimes !== null
  // Frais d'inscription : champ vide = aucun frais.
  const centimesFrais = frais.trim() === '' ? 0 : dhVersCentimes(frais)
  const fraisValides = centimesFrais !== null
  const echeanceValide = Number.isInteger(echeance) && echeance >= 1 && echeance <= 28
  const graceValide = Number.isInteger(grace) && grace >= 0
  const canSubmit = nom.trim() !== '' && seancesValides && moisValides && tarifValide && fraisValides && echeanceValide && graceValide && placesValides && !add.isPending && !update.isPending && !verification

  const conflits = useMemo(
    () =>
      conflitsClub({
        id: club?.id,
        nom: nom.trim() || 'Club',
        categorie,
        seances,
        teacherId: encadrant === 'ecole' ? teacherId || null : null,
        moisDebut,
        moisFin,
      }),
    [club, nom, categorie, seances, encadrant, teacherId, moisDebut, moisFin],
  )

  const toggleNiveau = (n: string) => setNiveaux((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))

  const modifierSeance = (index: number, patch: Partial<ClubSeance>) => setSeances((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  const retirerSeance = (index: number) => setSeances((prev) => prev.filter((_, i) => i !== index))
  /** Nouvelle séance : même horaire et même salle que la dernière, le jour ouvré suivant. */
  const ajouterSeance = () =>
    setSeances((prev) => {
      const derniere = prev[prev.length - 1] ?? SEANCE_PAR_DEFAUT
      const suivant = JOURS_SOUTIEN[(JOURS_SOUTIEN.indexOf(derniere.jour) + 1) % JOURS_SOUTIEN.length]
      return [...prev, { ...derniere, jour: suivant }]
    })

  const handleSubmit = async () => {
    if (!canSubmit || centimes === null) return
    const input: ClubInput = {
      nom: nom.trim(),
      categorie: categorie.trim(),
      description: description.trim(),
      teacherId: encadrant === 'ecole' ? teacherId || null : null,
      intervenantNom: encadrant === 'externe' ? intervenantNom.trim() : '',
      seances,
      placesMax: places,
      niveaux,
      mensualiteCentimes: centimes,
      fraisInscriptionCentimes: centimesFrais ?? 0,
      moisDebut,
      moisFin,
      jourEcheance: echeance,
      delaiGraceJours: grace,
    }
    setErreur('')
    try {
      if (club) {
        // Un changement de tarif ou de mois touche les mensualités déjà créées : on prévient avant d'enregistrer.
        if (aConfirmer === null && tarifOuPeriodeModifie(club, input)) {
          setVerification(true)
          const apercu = await apercuSynchroClub({ ...club, ...input })
          setVerification(false)
          if (apercu.modifiees + apercu.ajoutees + apercu.supprimees > 0) {
            setAConfirmer(apercu)
            return
          }
        }
        const r = await update.mutateAsync({ id: club.id, club: input })
        onSaved?.(r.modifiees + r.ajoutees + r.supprimees > 0 ? `Club modifié : ${resumeTexte(r)}.` : 'Club modifié.')
      } else {
        await add.mutateAsync(input)
        onSaved?.('Club créé.')
      }
      onClose()
    } catch (e) {
      setVerification(false)
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Trophy className="h-5 w-5 text-amber-500" />
            {club ? 'Modifier le club' : modele ? `Nouvelle catégorie — ${modele.nom}` : 'Nouveau club'}
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nom du club*</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} className={INPUT} placeholder="Ex. Robotique, Théâtre, Football…" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Catégorie (facultatif)</label>
              <input value={categorie} onChange={(e) => setCategorie(e.target.value)} className={INPUT} placeholder="Ex. U9, U12, U14…" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description (facultatif)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
            </div>
          </div>
          {modele && !club && <p className="-mt-3 text-[11px] text-slate-400">Nom, encadrant, tarif et mois repris de « {modele.nom}{modele.categorie ? ` ${modele.categorie}` : ''} » : modifiez ce qui diffère pour cette catégorie (séances, niveaux, places).</p>}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Encadrant</label>
            <div className="mb-2 inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Type d'encadrant">
              {(['ecole', 'externe'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEncadrant(m)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${encadrant === m ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {m === 'ecole' ? "Enseignant de l'école" : 'Intervenant externe'}
                </button>
              ))}
            </div>
            {encadrant === 'ecole' ? (
              <TeacherSearchSelect teachers={teachers} value={teacherId} onChange={setTeacherId} placeholder="Choisissez un enseignant…" />
            ) : (
              <input value={intervenantNom} onChange={(e) => setIntervenantNom(e.target.value)} className={INPUT} placeholder="Nom de l'intervenant" />
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-slate-700">Séances de la semaine*</label>
              <button type="button" onClick={ajouterSeance} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Plus className="h-3.5 w-3.5" />
                Ajouter une séance
              </button>
            </div>
            <div className="space-y-2">
              {seances.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_1.6fr_auto]">
                    <div>
                      {i === 0 && <label className="mb-1 block text-[11px] font-semibold text-slate-500">Jour*</label>}
                      <select value={s.jour} onChange={(e) => modifierSeance(i, { jour: e.target.value as JourClub })} className={INPUT} aria-label={`Jour de la séance ${i + 1}`}>
                        {JOURS_SOUTIEN.map((j) => (
                          <option key={j} value={j}>
                            {JOUR_LABELS[j]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      {i === 0 && <label className="mb-1 block text-[11px] font-semibold text-slate-500">Début*</label>}
                      <input type="time" value={s.heureDebut} onChange={(e) => modifierSeance(i, { heureDebut: e.target.value })} className={INPUT} aria-label={`Début de la séance ${i + 1}`} />
                    </div>
                    <div>
                      {i === 0 && <label className="mb-1 block text-[11px] font-semibold text-slate-500">Fin*</label>}
                      <input type="time" value={s.heureFin} onChange={(e) => modifierSeance(i, { heureFin: e.target.value })} className={INPUT} aria-label={`Fin de la séance ${i + 1}`} />
                    </div>
                    <div>
                      {i === 0 && <label className="mb-1 block text-[11px] font-semibold text-slate-500">Salle</label>}
                      <select value={s.salleId ?? ''} onChange={(e) => modifierSeance(i, { salleId: e.target.value || null })} className={INPUT} aria-label={`Salle de la séance ${i + 1}`}>
                        <option value="">— Aucune —</option>
                        {salles.map((salle) => (
                          <option key={salle.id} value={salle.id}>
                            {fullLabel(salle)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => retirerSeance(i)}
                      disabled={seances.length === 1}
                      title={seances.length === 1 ? 'Un club a au moins une séance' : 'Retirer cette séance'}
                      aria-label={`Retirer la séance ${i + 1}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {!seanceValide(s) && <p className="mt-1 text-[11px] text-amber-600">L'heure de fin doit être après l'heure de début.</p>}
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">La mensualité est la même quel que soit le nombre de séances par semaine.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Places maximum</label>
              <input type="number" min={1} value={placesMax} onChange={(e) => setPlacesMax(e.target.value)} className={INPUT} placeholder="Illimité" />
              <p className="mt-1 text-[11px] text-slate-400">Quand le club est complet, les nouveaux inscrits vont sur la liste d'attente ; vous les promouvez à la main.</p>
              {!placesValides && <p className="mt-1 text-[11px] text-amber-600">Entrez un nombre entier supérieur à 0, ou laissez vide.</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Niveaux admis</label>
              <div className="flex flex-wrap gap-1.5">
                {NIVEAUX.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNiveau(n)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${niveaux.includes(n) ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{niveaux.length === 0 ? 'Aucun niveau choisi : ouvert à tous les niveaux.' : 'Un autre niveau reste possible avec une dérogation, à confirmer à l’inscription.'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-800">Tarif</p>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Montant (DH)*</label>
                <input value={mensualite} onChange={(e) => setMensualite(e.target.value)} inputMode="decimal" className={INPUT} placeholder="150" />
                {mensualite.trim() !== '' && !tarifValide && <p className="mt-1 text-[11px] text-amber-600">Montant illisible (ex. 150 ou 150,50).</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Premier mois*</label>
                <input type="month" value={moisDebut.slice(0, 7)} onChange={(e) => setMoisDebut(e.target.value ? `${e.target.value}-01` : '')} className={INPUT} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dernier mois*</label>
                <input type="month" value={moisFin.slice(0, 7)} onChange={(e) => setMoisFin(e.target.value ? `${e.target.value}-01` : '')} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Échéance le</label>
                  <input type="number" min={1} max={28} value={jourEcheance} onChange={(e) => setJourEcheance(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Grâce (j)</label>
                  <input type="number" min={0} value={delaiGrace} onChange={(e) => setDelaiGrace(e.target.value)} className={INPUT} />
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Frais d'inscription (DH)</label>
                <input value={frais} onChange={(e) => setFrais(e.target.value)} inputMode="decimal" className={INPUT} placeholder="Aucun" />
                {frais.trim() !== '' && !fraisValides && <p className="mt-1 text-[11px] text-amber-600">Montant illisible (ex. 100 ou 100,50).</p>}
              </div>
              <p className="self-end pb-2 text-[11px] text-slate-500 sm:col-span-3">
                Montant unique par élève, dû à la date d'inscription et payé avant les mensualités. Un élève exonéré ne les doit pas ; un élève qui revient après un arrêt ne les repaie pas.
              </p>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {moisValides ? `Facturé de ${libelleMois(moisDebut)} à ${libelleMois(moisFin)}. ` : 'Le dernier mois doit être après le premier. '}
              Chaque mensualité est due le {echeanceValide ? echeance : '…'} du mois, puis « en retard » {graceValide ? grace : '…'} jour{grace > 1 ? 's' : ''} après. Le mois d’inscription et le mois d’arrêt sont dus en entier ; aucune pénalité de retard.
            </p>
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

          {aConfirmer && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <p className="font-semibold">Ce changement modifie les mensualités déjà créées des inscrits : {resumeTexte(aConfirmer)}.</p>
              <p className="mt-0.5">Les mois qui ont déjà reçu un règlement ne changent pas.</p>
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
            {verification ? 'Vérification…' : aConfirmer ? 'Confirmer et enregistrer' : club ? 'Enregistrer' : 'Créer le club'}
          </button>
        </div>
      </div>
    </div>
  )
}
