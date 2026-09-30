import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, DoorOpen } from 'lucide-react'
import { useAbsencesConfig } from '../../services/absencesConfigService'
import { useDeclareSortieAnticipeeStaff } from '../../services/sortiesAnticipeesService'
import { useIsViewedYearEditable } from '../../services/viewedYear'
import { getStudentExtraSnapshot, updateStudentEvents } from '../../services/studentDetailsService'
import { recomputeStudentAttendance } from '../../data/students'
import { enqueueNotification } from '../../services/notificationQueueService'
import { computeAbsencesForSortieAnticipee } from '../../utils/sortieAnticipeeAggregation'
import type { StudentIdentity } from '../../data/studentIdentity'
import type { CantineInfo } from '../../data/studentDetails'

interface DeclarerSortieAnticipeeModalProps {
  studentId: string
  classe: string
  studentName: string
  identity: StudentIdentity
  cantine: CantineInfo
  onClose: () => void
  onDeclared: (input: {
    date: string
    heure: string
    recuperePar: string
    lienParente: string
    motif: string
    verifIdentite: boolean
    verifAccordResponsable: boolean
    verifSurListe: boolean
    reference: string
  }) => void
}

const AUTRE_KEY = '__autre__'

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DeclarerSortieAnticipeeModal({ studentId, classe, studentName, identity, cantine, onClose, onDeclared }: DeclarerSortieAnticipeeModalProps) {
  const { data: absencesConfig } = useAbsencesConfig()
  const motifOptions = absencesConfig?.motifs ?? []
  const isEditable = useIsViewedYearEditable()
  const declareSortie = useDeclareSortieAnticipeeStaff()
  const queryClient = useQueryClient()

  // Parents + responsables habilités déjà enregistrés sur la fiche (cartes "Contacts parents" et
  // "Responsables habilités à récupérer l'élève") — mêmes personnes déjà autorisées à récupérer
  // l'élève, réutilisées ici plutôt qu'un texte libre pour éviter toute saisie non contrôlée.
  const recupererOptions = [
    ...(identity.parent1Nom.trim() || identity.parent1Prenom.trim()
      ? [{ key: 'parent1', nom: `${identity.parent1Prenom} ${identity.parent1Nom}`.trim(), relation: 'Parent', label: `${identity.parent1Prenom} ${identity.parent1Nom} (Parent 1)`.trim() }]
      : []),
    ...(identity.parent2Nom.trim() || identity.parent2Prenom.trim()
      ? [{ key: 'parent2', nom: `${identity.parent2Prenom} ${identity.parent2Nom}`.trim(), relation: 'Parent', label: `${identity.parent2Prenom} ${identity.parent2Nom} (Parent 2)`.trim() }]
      : []),
    ...cantine.responsables
      .filter((r) => r.name.trim())
      .map((r, i) => ({ key: `resp-${i}`, nom: r.name, relation: r.relation || 'Responsable habilité', label: `${r.name} (${r.relation || 'Responsable habilité'})` })),
  ]

  const [heure, setHeure] = useState(nowHHMM())
  const [recupererKey, setRecupererKey] = useState('')
  const [recupererAutre, setRecupererAutre] = useState('')
  const [lienParenteAutre, setLienParenteAutre] = useState('')
  const [motif, setMotif] = useState('')
  const [verifIdentite, setVerifIdentite] = useState(false)
  const [verifAccordResponsable, setVerifAccordResponsable] = useState(false)

  const selectedOption = recupererOptions.find((o) => o.key === recupererKey)
  const recuperePar = recupererKey === AUTRE_KEY ? recupererAutre.trim() : (selectedOption?.nom ?? '')
  const lienParente = recupererKey === AUTRE_KEY ? lienParenteAutre.trim() : (selectedOption?.relation ?? '')
  const verifSurListe = recupererKey !== '' && recupererKey !== AUTRE_KEY

  const canSubmit = isEditable && !!heure && recuperePar !== ''

  const handleSubmit = async () => {
    if (!canSubmit) return
    const date = todayISO()
    const id = await declareSortie.mutateAsync({ studentId, date, heure, recuperePar, motif })
    const reference = `SA-${date.slice(0, 4)}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`

    // Même chemin d'écriture que SignalerAbsenceModal.tsx pour ses propres absences — les cours
    // restants de la journée après l'heure de sortie sont marqués absents automatiquement.
    const newAbsences = computeAbsencesForSortieAnticipee(classe, date, heure, motif, id)
    if (newAbsences.length > 0) {
      const allEvents = [...getStudentExtraSnapshot(studentId).events, ...newAbsences]
      await updateStudentEvents(studentId, allEvents)
      await Promise.all(
        newAbsences.map((e) =>
          enqueueNotification({
            studentId,
            templateCode: 'absence',
            variables: { eleve: studentName, classe, date: e.date, motif: e.motif },
          })
        )
      )
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      await recomputeStudentAttendance(studentId, allEvents)
      await queryClient.invalidateQueries({ queryKey: ['students'] })
    }

    onDeclared({ date, heure, recuperePar, lienParente, motif, verifIdentite, verifAccordResponsable, verifSurListe, reference })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <DoorOpen className="h-5 w-5 text-teal-600" />
            Sortie anticipée
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!isEditable && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Année en lecture seule — basculez sur l'année active pour enregistrer une sortie anticipée.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure de sortie</label>
            <input
              type="time"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Récupéré par</label>
            <select
              value={recupererKey}
              onChange={(e) => setRecupererKey(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner une personne...</option>
              {recupererOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
              <option value={AUTRE_KEY}>Autre (préciser)...</option>
            </select>
            {recupererOptions.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                Aucun parent ni responsable habilité renseigné sur cette fiche pour l'instant.
              </p>
            )}
            {recupererKey === AUTRE_KEY && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  value={recupererAutre}
                  onChange={(e) => setRecupererAutre(e.target.value)}
                  placeholder="Nom de la personne"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
                <input
                  value={lienParenteAutre}
                  onChange={(e) => setLienParenteAutre(e.target.value)}
                  placeholder="Lien de parenté"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motif</label>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner un motif...</option>
              {motifOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vérifications effectuées</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={verifIdentite}
                onChange={(e) => setVerifIdentite(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-teal-600"
              />
              Identité vérifiée (CIN / pièce)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={verifAccordResponsable}
                onChange={(e) => setVerifAccordResponsable(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-teal-600"
              />
              Accord du responsable légal obtenu
            </label>
            <p className="text-xs text-slate-400">
              {verifSurListe ? '✓' : '—'} Personne inscrite sur la liste des habilités (automatique selon la sélection ci-dessus)
            </p>
          </div>

          <p className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 text-xs text-teal-700">
            Les cours restants de la journée seront automatiquement marqués absents (justifiés) à
            partir de l'heure de sortie, selon l'emploi du temps de la classe.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || declareSortie.isPending}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer et imprimer
          </button>
        </div>
      </div>
    </div>
  )
}
