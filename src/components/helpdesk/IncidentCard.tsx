import { MapPin, User, Calendar, FileText, Trash2, AlertTriangle } from 'lucide-react'
import { STATUT_INCIDENT_ORDER, STATUT_INCIDENT_LABELS, computeBCTotals, type Incident, type StatutIncident } from '../../data/helpdesk'

const PRIORITE_STYLE: Record<Incident['priorite'], string> = {
  URGENT: 'bg-rose-50 text-rose-600',
  NORMALE: 'bg-amber-50 text-amber-600',
  BASSE: 'bg-emerald-50 text-emerald-600',
}

const STATUT_BC_STYLE: Record<Incident['bc']['statut'], string> = {
  BROUILLON: 'bg-slate-100 text-slate-500',
  EN_ATTENTE_DIRECTION: 'bg-amber-50 text-amber-600',
  VALIDE: 'bg-emerald-50 text-emerald-600',
}

const STATUT_BC_LABEL: Record<Incident['bc']['statut'], string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_DIRECTION: 'En attente Direction',
  VALIDE: 'Validé par Direction',
}

function ageDays(dateSignalement: string): number {
  const d = new Date(dateSignalement)
  const now = new Date()
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000))
}

interface IncidentCardProps {
  incident: Incident
  onStatutChange: (statut: StatutIncident) => void
  onGererBC: () => void
  onImprimerBC: () => void
  onDelete: () => void
  onDragStart: () => void
  canEdit: boolean
}

export default function IncidentCard({ incident, onStatutChange, onGererBC, onImprimerBC, onDelete, onDragStart, canEdit }: IncidentCardProps) {
  const { totalTTC } = computeBCTotals(incident.bc)
  const age = ageDays(incident.dateSignalement)
  const isStale = incident.priorite === 'URGENT' && incident.statut !== 'RESOLU' && age >= 2

  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${canEdit ? 'cursor-move' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITE_STYLE[incident.priorite]}`}>{incident.priorite}</span>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <MapPin className="h-3 w-3" />
          {incident.lieu}
        </span>
      </div>

      {incident.photo && <img src={incident.photo} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />}

      <p className="mb-1 text-sm font-bold text-slate-900">{incident.titre}</p>
      <p className="mb-3 line-clamp-2 text-xs text-slate-500">{incident.description}</p>

      <div className="mb-3 space-y-1.5 rounded-xl bg-slate-50/60 p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-slate-500">
            <FileText className="h-3 w-3" />
            Bon de Commande :
          </span>
          <span className="font-semibold text-indigo-600">{incident.bc.numero}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Prestataire :</span>
          <span className="font-semibold text-slate-700">{incident.bc.prestataireNom}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Statut Flux :</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUT_BC_STYLE[incident.bc.statut]}`}>{STATUT_BC_LABEL[incident.bc.statut]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Total Net (TTC) :</span>
          <span className="font-bold text-slate-800">{totalTTC.toFixed(0)} DH</span>
        </div>
      </div>

      <div className="mb-2.5 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {incident.declarant}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {incident.dateSignalement}
        </span>
      </div>

      {isStale && (
        <div className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Ouvert depuis {age}j — urgent non traité
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={incident.statut}
          onChange={(e) => onStatutChange(e.target.value as StatutIncident)}
          disabled={!canEdit}
          className="rounded-lg border border-slate-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {STATUT_INCIDENT_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUT_INCIDENT_LABELS[s]}
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
