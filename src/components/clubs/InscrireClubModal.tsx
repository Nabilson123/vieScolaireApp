import { useMemo, useState } from 'react'
import { Bus, TriangleAlert, Trophy, Users, X } from 'lucide-react'
import { libelleClub } from '../../data/clubs'
import { getActiveClassNamesSnapshot } from '../../services/classesService'
import { getStudentsSnapshot } from '../../services/studentsService'
import { useClubInscriptions, useClubs, useInscrireClubLot } from '../../services/clubsService'
import { alerteTransportClub } from '../../utils/clubsContexte'
import { niveauAutorise, placesRestantes } from '../../utils/clubs'
import { formatDH, libelleMois, moisDe } from '../../utils/clubsFinance'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'
import StudentSearchSelect from '../StudentSearchSelect'

interface Props {
  /** Club présélectionné (inscription depuis la carte d'un club). */
  clubId?: string
  /** Élève présélectionné (inscription depuis une fiche élève) : la liste d'élèves n'est alors pas modifiable. */
  studentId?: string
  onClose: () => void
  /** Message à afficher dans la page après l'inscription. */
  onDone?: (message: string) => void
}

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none'

/**
 * Inscrit un ou plusieurs élèves à un club : ajout un par un par la recherche ou une classe entière, contrôle du niveau
 * (dérogation à confirmer), liste d'attente pour ceux qui dépassent les places, avertissement transport, exonération.
 */
export default function InscrireClubModal({ clubId: clubInitial, studentId: eleveInitial, onClose, onDone }: Props) {
  const { data: clubs = [] } = useClubs()
  const { data: inscriptions = [] } = useClubInscriptions()
  const inscrire = useInscrireClubLot()
  const students = getStudentsSnapshot()
  const classes = getActiveClassNamesSnapshot()

  const clubsOuverts = useMemo(() => clubs.filter((c) => !c.archive).sort((a, b) => libelleClub(a).localeCompare(libelleClub(b), 'fr', { numeric: true })), [clubs])
  const [clubId, setClubId] = useState(clubInitial ?? clubsOuverts[0]?.id ?? '')
  const [studentIds, setStudentIds] = useState<string[]>(eleveInitial ? [eleveInitial] : [])
  const [dateInscription, setDateInscription] = useState(aujourdhuiLocalISO())
  const [exonere, setExonere] = useState(false)
  const [motif, setMotif] = useState('')
  const [derogation, setDerogation] = useState(false)
  const [erreur, setErreur] = useState('')
  const figee = !!eleveInitial

  const club = clubs.find((c) => c.id === clubId)
  const eleveParId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])

  const lignes = studentIds
    .map((id) => {
      const eleve = eleveParId.get(id)
      if (!eleve) return null
      const existante = inscriptions.find((i) => i.clubId === clubId && i.studentId === id)
      return {
        eleve,
        dejaInscrit: existante?.statut === 'actif' || existante?.statut === 'attente',
        reinscription: existante?.statut === 'arrete',
        niveauHors: !!club && !niveauAutorise(club, eleve.classe),
        depart: club ? alerteTransportClub(club, id) : null,
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  const aInscrire = lignes.filter((l) => !l.dejaInscrit)
  const horsNiveau = aInscrire.filter((l) => l.niveauHors)
  const restantes = club ? placesRestantes(club, inscriptions) : null
  const enAttentePrevus = restantes === null ? 0 : Math.max(0, aInscrire.length - restantes)
  const reinscrits = aInscrire.filter((l) => l.reinscription).length

  const ajouter = (ids: string[]) => setStudentIds((prev) => [...new Set([...prev, ...ids])])
  const retirer = (id: string) => {
    setStudentIds((prev) => prev.filter((x) => x !== id))
    setDerogation(false)
  }

  const dateValide = !!dateInscription
  const canSubmit = !!club && aInscrire.length > 0 && dateValide && (horsNiveau.length === 0 || derogation) && (!exonere || motif.trim() !== '') && !inscrire.isPending

  const handleSubmit = async () => {
    if (!canSubmit || !club) return
    setErreur('')
    try {
      const r = await inscrire.mutateAsync({
        clubId: club.id,
        studentIds: aInscrire.map((l) => l.eleve.id),
        dateInscription,
        exonere,
        motifExoneration: motif,
        derogationIds: derogation ? horsNiveau.map((l) => l.eleve.id) : [],
      })
      if (r.inscrits + r.enAttente === 0) {
        setErreur(r.echecs[0]?.raison ?? 'Inscription impossible.')
        return
      }
      if (aInscrire.length === 1 && r.echecs.length === 0) {
        const nom = aInscrire[0].eleve.name
        onDone?.(r.enAttente > 0 ? `${nom} est sur la liste d'attente du club « ${libelleClub(club)} » (club complet).` : `${nom} est inscrit(e) au club « ${libelleClub(club)} ».`)
      } else {
        const parties: string[] = []
        if (r.inscrits > 0) parties.push(`${r.inscrits} élève${r.inscrits > 1 ? 's inscrits' : ' inscrit'}`)
        if (r.enAttente > 0) parties.push(`${r.enAttente} sur la liste d'attente (club complet)`)
        if (r.echecs.length > 0) parties.push(`${r.echecs.length} non inscrit${r.echecs.length > 1 ? 's' : ''} (${r.echecs[0].raison})`)
        onDone?.(`Club « ${libelleClub(club)} » : ${parties.join(', ')}.`)
      }
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
            {figee ? 'Inscrire un élève à un club' : 'Inscrire des élèves à un club'}
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
                  {libelleClub(c)}
                </option>
              ))}
            </select>
            {club && restantes !== null && (
              <p className="mt-1 text-[11px] text-slate-400">
                {restantes} place{restantes > 1 ? 's' : ''} libre{restantes > 1 ? 's' : ''} sur {club.placesMax}.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Élève{figee ? '' : 's'}* {!figee && lignes.length > 0 && <span className="font-normal text-slate-400">({lignes.length})</span>}
            </label>

            {lignes.length > 0 && (
              <div className="mb-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {lignes.map((l) => (
                  <span
                    key={l.eleve.id}
                    className={`inline-flex items-center gap-1 rounded-full py-1 pl-2.5 text-xs font-medium ${figee ? 'pr-2.5' : 'pr-1'} ${l.dejaInscrit ? 'bg-slate-100 text-slate-500 line-through' : 'bg-amber-50 text-amber-800'}`}
                  >
                    {l.eleve.name} <span className="text-slate-400">({l.eleve.classe})</span>
                    {l.dejaInscrit && <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold no-underline">déjà inscrit</span>}
                    {l.niveauHors && !l.dejaInscrit && <span title="Niveau non admis par le club" className="rounded-full bg-amber-200 px-1.5 text-[10px] font-semibold text-amber-900">niveau</span>}
                    {l.depart && !l.dejaInscrit && (
                      <span title={`Au transport du soir (départ ${l.depart}) : le club se termine après`} className="inline-flex items-center gap-0.5 rounded-full bg-amber-200 px-1.5 text-[10px] font-semibold text-amber-900">
                        <Bus className="h-3 w-3" />
                        {l.depart}
                      </span>
                    )}
                    {!figee && (
                      <button type="button" onClick={() => retirer(l.eleve.id)} aria-label={`Retirer ${l.eleve.name}`} className="flex h-5 w-5 items-center justify-center rounded-full text-amber-500 hover:bg-amber-100">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {!figee && (
              <div className="space-y-2">
                <StudentSearchSelect students={students} value="" onChange={(id) => id && ajouter([id])} placeholder="Ajouter un élève (nom ou classe)…" />
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0 text-slate-400" />
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) ajouter(students.filter((s) => s.classe === e.target.value).map((s) => s.id))
                    }}
                    className={INPUT}
                    aria-label="Ajouter toute une classe"
                  >
                    <option value="">Ajouter toute une classe…</option>
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c} ({students.filter((s) => s.classe === c).length} élèves)
                      </option>
                    ))}
                  </select>
                  {lignes.length > 0 && (
                    <button type="button" onClick={() => setStudentIds([])} className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">
                      Tout retirer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {lignes.some((l) => l.dejaInscrit) && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Les élèves barrés sont déjà inscrits (ou en liste d'attente) : ils seront ignorés.</p>}
          {reinscrits > 0 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{reinscrits} élève{reinscrits > 1 ? 's avaient quitté' : ' avait quitté'} ce club : réinscription sur la même ligne (leurs éventuels impayés d'avant restent dus).</p>}

          {horsNiveau.length > 0 && club && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <p className="flex items-start gap-2 font-medium">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Le club est réservé aux niveaux {club.niveaux.join(', ')}. Hors niveau : {horsNiveau.map((l) => `${l.eleve.name} (${l.eleve.classe})`).join(', ')}.
                </span>
              </p>
              <label className="mt-2 flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={derogation} onChange={(e) => setDerogation(e.target.checked)} />
                Inscrire malgré tout (dérogation)
              </label>
            </div>
          )}

          {enAttentePrevus > 0 && club && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
              Le club n'a {restantes === 0 ? 'plus de place' : `que ${restantes} place${(restantes ?? 0) > 1 ? 's' : ''} libre${(restantes ?? 0) > 1 ? 's' : ''}`} : {enAttentePrevus} élève{enAttentePrevus > 1 ? 's seront placés' : ' sera placé'} sur la liste d'attente (rien n'est facturé tant qu'ils ne sont pas promus).
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date d'inscription</label>
            <input type="date" value={dateInscription} onChange={(e) => setDateInscription(e.target.value)} className={INPUT} />
            {club && dateValide && (
              <p className="mt-1 text-[11px] text-slate-400">Le mois d'inscription est dû en entier : première mensualité {libelleMois(moisDe(dateInscription) > club.moisDebut ? moisDe(dateInscription) : club.moisDebut)}.</p>
            )}
            {club && club.fraisInscriptionCentimes > 0 && (
              <p className={`mt-1 text-[11px] font-medium ${exonere || (aInscrire.length > 0 && reinscrits === aInscrire.length) ? 'text-slate-400' : 'text-amber-700'}`}>
                {exonere
                  ? `Frais d'inscription (${formatDH(club.fraisInscriptionCentimes)}) non dus : élève exonéré.`
                  : aInscrire.length > 0 && reinscrits === aInscrire.length
                    ? "Les frais d'inscription ont déjà été facturés à la première inscription : rien de plus à payer."
                    : `Frais d'inscription : ${formatDH(club.fraisInscriptionCentimes)}, dus à la date d'inscription${reinscrits > 0 ? ` (sauf pour les ${reinscrits} réinscrit${reinscrits > 1 ? 's' : ''}, déjà facturé${reinscrits > 1 ? 's' : ''})` : ''}.`}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={exonere} onChange={(e) => setExonere(e.target.checked)} />
              Exonéré (ne paie pas la mensualité){!figee && lignes.length > 1 ? ' — pour tous les élèves ci-dessus' : ''}
            </label>
            {exonere && <input value={motif} onChange={(e) => setMotif(e.target.value)} className={`${INPUT} mt-2`} placeholder="Motif de l'exonération (obligatoire)" />}
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
            {inscrire.isPending ? 'Inscription…' : aInscrire.length > 1 ? `Inscrire ${aInscrire.length} élèves` : enAttentePrevus > 0 ? "Mettre sur la liste d'attente" : 'Inscrire'}
          </button>
        </div>
      </div>
    </div>
  )
}
