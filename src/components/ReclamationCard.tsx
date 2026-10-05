import { useState } from 'react'
import { CheckCircle2, MessageCircle, Pencil, RotateCcw, Trash2, UserCog, X } from 'lucide-react'
import type { ReclamationRecord } from '../data/studentDetails'
import {
  cleanReclamationText,
  delaiResolutionJours,
  echeanceStatut,
  formatDateFR,
  isHorsDelai,
  joursOuverts,
  type EcheanceStatut,
} from '../utils/reclamationsLogic'
import { buildStaffOptions } from '../utils/staffOptions'

/** Une couleur par catégorie (les 19 du référentiel), pour repérer d'un coup d'œil. */
export const CATEGORY_COLORS: Record<string, string> = {
  Notes: 'bg-indigo-50 text-indigo-600',
  'Examens / Évaluations': 'bg-blue-50 text-blue-600',
  'Absence / Assiduité': 'bg-purple-50 text-purple-600',
  Comportement: 'bg-rose-50 text-rose-600',
  'Harcèlement / Intimidation': 'bg-red-50 text-red-600',
  Cantine: 'bg-amber-50 text-amber-600',
  Transport: 'bg-teal-50 text-teal-600',
  'Infirmerie / Santé': 'bg-emerald-50 text-emerald-600',
  'Pédagogie / Enseignement': 'bg-sky-50 text-sky-600',
  'Emploi du temps': 'bg-cyan-50 text-cyan-600',
  'Communication / Administration': 'bg-violet-50 text-violet-600',
  Sécurité: 'bg-orange-50 text-orange-600',
  'Frais de scolarité / Facturation': 'bg-lime-50 text-lime-700',
  'Inscription / Admission': 'bg-fuchsia-50 text-fuchsia-600',
  'Activités périscolaires / Sorties': 'bg-pink-50 text-pink-600',
  'Uniforme / Tenue vestimentaire': 'bg-yellow-50 text-yellow-700',
  'Hygiène / Locaux': 'bg-stone-100 text-stone-600',
  'Accueil / Réception': 'bg-slate-100 text-slate-600',
  Autre: 'bg-slate-100 text-slate-500',
}

const STATUT_COLORS: Record<ReclamationRecord['statut'], string> = {
  'En cours': 'bg-amber-50 text-amber-600',
  Résolue: 'bg-emerald-50 text-emerald-600',
  'En attente': 'bg-slate-100 text-slate-500',
}

const ECHEANCE_COLORS: Record<EcheanceStatut, string> = {
  ok: 'text-slate-700',
  proche: 'text-amber-600',
  depassee: 'text-rose-600',
}

/** Depuis combien de temps la réclamation attend — ou en combien de temps elle a été résolue. */
function DelaiBadge({ reclamation }: { reclamation: ReclamationRecord }) {
  if (reclamation.statut === 'Résolue') {
    const jours = delaiResolutionJours(reclamation)
    if (jours === null) return null
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
        Résolue en {jours} j
      </span>
    )
  }
  const jours = joursOuverts(reclamation.date)
  if (isHorsDelai(reclamation)) {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">Hors délai · {jours} j</span>
  }
  const label = jours === 0 ? "Reçue aujourd'hui" : `Ouverte depuis ${jours} j`
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${jours >= 2 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
      {label}
    </span>
  )
}

interface ReclamationCardProps {
  reclamation: ReclamationRecord
  studentName?: string
  classe?: string
  isEditable: boolean
  onTakeCharge: () => void
  onResolve: (resolution: string) => void
  onReopen: () => void
  onEdit: () => void
  onDelete: () => void
  /** Ouvre le message prêt à envoyer au parent (WhatsApp). */
  onMessage?: () => void
  /** Change le responsable et l'échéance. */
  onAssign?: (responsable: string, echeance: string) => void
}

export default function ReclamationCard({
  reclamation,
  studentName,
  classe,
  isEditable,
  onTakeCharge,
  onResolve,
  onReopen,
  onEdit,
  onDelete,
  onMessage,
  onAssign,
}: ReclamationCardProps) {
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [draftResponsable, setDraftResponsable] = useState('')
  const [draftEcheance, setDraftEcheance] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState('')

  const categoryClass = CATEGORY_COLORS[reclamation.type] ?? 'bg-slate-100 text-slate-600'
  const statutClass = STATUT_COLORS[reclamation.statut]
  const horsDelai = isHorsDelai(reclamation)
  const echeance = echeanceStatut(reclamation)

  const openAssign = () => {
    setDraftResponsable(reclamation.responsable ?? '')
    setDraftEcheance(reclamation.echeance ?? '')
    setShowAssign(true)
  }

  const handleValidate = () => {
    if (!draft.trim()) return
    onResolve(draft.trim())
    setShowResolveForm(false)
    setDraft('')
  }

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${horsDelai ? 'border-rose-200' : 'border-slate-100'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className={`mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${categoryClass}`}>
            {reclamation.type}
          </span>
          <p className="text-sm font-bold text-slate-900">{cleanReclamationText(reclamation.objet)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statutClass}`}>{reclamation.statut}</span>
          <DelaiBadge reclamation={reclamation} />
        </div>
      </div>

      <p className="mb-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">{cleanReclamationText(reclamation.description)}</p>

      {reclamation.statut === 'Résolue' && reclamation.resolution && (
        <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            SOLUTION / COMMENTAIRE :
          </p>
          <p className="text-sm text-emerald-700">{reclamation.resolution}</p>
        </div>
      )}

      {showResolveForm && (
        <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Décrire la solution apportée..."
            className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowResolveForm(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={!draft.trim()}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Valider la résolution
            </button>
          </div>
        </div>
      )}

      {showAssign && onAssign && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Responsable</label>
            <select
              value={draftResponsable}
              onChange={(e) => setDraftResponsable(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Aucun</option>
              {buildStaffOptions(reclamation.responsable).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Échéance</label>
            <input
              type="date"
              value={draftEcheance}
              onChange={(e) => setDraftEcheance(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onAssign(draftResponsable, draftEcheance)
              setShowAssign(false)
            }}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setShowAssign(false)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {studentName && (
            <span>
              Élève : <span className="font-semibold text-slate-700">{studentName}</span>
              {classe && (
                <span className="ml-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                  {classe}
                </span>
              )}
            </span>
          )}
          <span>
            Date : <span className="font-semibold text-slate-700">{formatDateFR(reclamation.date)}</span>
          </span>
          {reclamation.parentNom && (
            <span>
              Parent : <span className="font-semibold text-slate-700">{reclamation.parentNom}</span>
            </span>
          )}
          {reclamation.enseignant && (
            <span>
              Concernant : <span className="font-semibold text-slate-700">{reclamation.enseignant}</span>
            </span>
          )}
          {reclamation.responsable && (
            <span>
              Responsable : <span className="font-semibold text-slate-700">{reclamation.responsable}</span>
            </span>
          )}
          {echeance && reclamation.echeance && (
            <span>
              Échéance : <span className={`font-semibold ${ECHEANCE_COLORS[echeance]}`}>{formatDateFR(reclamation.echeance)}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {confirmingDelete ? (
            <>
              <span className="text-[11px] font-medium text-rose-600">Supprimer ?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete()
                  setConfirmingDelete(false)
                }}
                className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                title="Annuler"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              {reclamation.statut === 'En attente' && !showResolveForm && (
                <button
                  type="button"
                  onClick={onTakeCharge}
                  disabled={!isEditable}
                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prendre en charge
                </button>
              )}
              {reclamation.statut !== 'Résolue' && !showResolveForm && (
                <button
                  type="button"
                  onClick={() => setShowResolveForm(true)}
                  disabled={!isEditable}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Résoudre
                </button>
              )}
              {reclamation.statut === 'Résolue' && (
                <button
                  type="button"
                  onClick={onReopen}
                  disabled={!isEditable}
                  title="Rouvrir cette réclamation"
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Rouvrir
                </button>
              )}
              {onMessage && (
                <button
                  type="button"
                  onClick={onMessage}
                  title="Message au parent (WhatsApp)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </button>
              )}
              {onAssign && reclamation.statut !== 'Résolue' && (
                <button
                  type="button"
                  onClick={openAssign}
                  disabled={!isEditable}
                  title="Responsable et échéance"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UserCog className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onEdit}
                disabled={!isEditable}
                title="Modifier"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={!isEditable}
                title="Supprimer"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
