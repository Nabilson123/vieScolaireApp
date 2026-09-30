import { MapPin, User, Calendar, Clock, Trash2, FileText } from 'lucide-react'
import { computeBCTotals } from '../../data/helpdesk'
import { STATUT_DEMANDE_ORDER, STATUT_DEMANDE_LABELS, TYPE_DEMANDE_LABELS, TYPE_DEMANDE_ICONS, type Demande, type StatutDemande } from '../../data/helpdeskDemandes'

const PRIORITE_STYLE: Record<Demande['priorite'], string> = {
  URGENT: 'bg-rose-50 text-rose-600',
  NORMALE: 'bg-amber-50 text-amber-600',
  BASSE: 'bg-emerald-50 text-emerald-600',
}

const STATUT_BC_STYLE: Record<Demande['bc']['statut'], string> = {
  BROUILLON: 'bg-slate-100 text-slate-500',
  EN_ATTENTE_DIRECTION: 'bg-amber-50 text-amber-600',
  VALIDE: 'bg-emerald-50 text-emerald-600',
}

const STATUT_BC_LABEL: Record<Demande['bc']['statut'], string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_DIRECTION: 'En attente Direction',
  VALIDE: 'Validé par Direction',
}

interface DemandeCardProps {
  demande: Demande
  onStatutChange: (statut: StatutDemande) => void
  onGererBC: () => void
  onImprimerBC: () => void
  onDelete: () => void
  onDragStart: () => void
  canEdit: boolean
}

export default function DemandeCard({ demande, onStatutChange, onGererBC, onImprimerBC, onDelete, onDragStart, canEdit }: DemandeCardProps) {
  const { totalTTC } = computeBCTotals(demande.bc)
  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${canEdit ? 'cursor-move' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITE_STYLE[demande.priorite]}`}>{demande.priorite}</span>
        {demande.lieu && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin className="h-3 w-3" />
            {demande.lieu}
          </span>
        )}
      </div>

      <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
        {TYPE_DEMANDE_ICONS[demande.type]} {TYPE_DEMANDE_LABELS[demande.type]}
      </span>

      <p className="mb-1 text-sm font-bold text-slate-900">{demande.titre}</p>
      {demande.description && <p className="mb-3 line-clamp-2 text-xs text-slate-500">{demande.description}</p>}

      <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-slate-50/60 p-2.5 text-xs">
        <Calendar className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-semibold text-slate-700">Échéance : {demande.dateCible}</span>
        {demande.heureCible && (
          <span className="ml-1 flex items-center gap-1 font-semibold text-slate-700">
            <Clock className="h-3 w-3 text-slate-400" />
            {demande.heureCible}
          </span>
        )}
      </div>

      <div className="mb-3 space-y-1.5 rounded-xl bg-slate-50/60 p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-slate-500">
            <FileText className="h-3 w-3" />
            Bon de Commande :
          </span>
          <span className="font-semibold text-indigo-600">{demande.bc.numero}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Prestataire :</span>
          <span className="font-semibold text-slate-700">{demande.bc.prestataireNom}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Statut Flux :</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUT_BC_STYLE[demande.bc.statut]}`}>{STATUT_BC_LABEL[demande.bc.statut]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Total Net (TTC) :</span>
          <span className="font-bold text-slate-800">{totalTTC.toFixed(0)} DH</span>
        </div>
      </div>

      <div className="mb-2.5 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {demande.declarant}
        </span>
        <span>Signalé le {demande.dateSignalement}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={demande.statut}
          onChange={(e) => onStatutChange(e.target.value as StatutDemande)}
          disabled={!canEdit}
          className="rounded-lg border border-slate-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {STATUT_DEMANDE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUT_DEMANDE_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onGererBC}
          disabled={!canEdit}
          className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gérer BC
        </button>
        <button
          type="button"
          onClick={onImprimerBC}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100"
        >
          Bon de Commande
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canEdit}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
