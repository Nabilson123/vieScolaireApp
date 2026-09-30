import { UtensilsCrossed, ArrowRight } from 'lucide-react'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getEnrolledStudents, computeCantineStats, isPointedToday } from '../utils/cantineAggregation'
import { getServicesCapaciteSnapshot } from '../services/servicesCapaciteService'

interface CantineCardProps {
  onManage?: () => void
}

export default function CantineCard({ onManage }: CantineCardProps) {
  const enrolled = getEnrolledStudents()
  const stats = computeCantineStats(enrolled)
  const servis = enrolled.filter((s) => isPointedToday(getStudentExtraSnapshot(s.id).cantine)).length
  // Deux réfectoires, deux créneaux (maternelle 11h-12h, primaire/collège 12h-13h) configurés via
  // "Configurer les créneaux" (Vue Live Cockpit) — pas de valeur codée en dur ici, sinon elle
  // deviendrait fausse pour l'un des deux publics dès que les créneaux réels divergent.
  const creneauxCantine = (getServicesCapaciteSnapshot()?.creneauxFixes ?? [])
    .filter((c) => c.icon === 'cantine')
    .sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Service Cantine (Aujourd'hui)</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {creneauxCantine.length > 0 ? (
            creneauxCantine.map((c, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                {c.start} - {c.end}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">
              Créneaux non configurés
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold text-slate-900">
            {servis} / {stats.inscrits}
          </span>
          <p className="text-xs text-slate-500">Repas servis / prévus</p>
        </div>
        {stats.alertesPAI > 0 && (
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-500">
            {stats.alertesPAI} Alerte{stats.alertesPAI > 1 ? 's' : ''} PAI
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onManage}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800"
      >
        Gérer la surveillance & les repas
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
