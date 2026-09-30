import { Bus, ArrowRight } from 'lucide-react'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getTransportLignesSnapshot, getTransportCapaciteTotaleSnapshot } from '../services/transportLignesService'
import { occupancyLevel, occupancyPct } from '../utils/reportsBIAggregation'

interface TransportCardProps {
  onManage?: () => void
}

const OCCUPANCY_TEXT_CLASS = { ok: 'text-emerald-600', warn: 'text-amber-600', over: 'text-rose-600' }

export default function TransportCard({ onManage }: TransportCardProps) {
  const students = getStudentsSnapshot()
  let effectif = 0
  let nbNonAffecte = 0
  students.forEach((s) => {
    const identity = getStudentIdentitySnapshot(s.id)
    if (identity.transport) {
      effectif += 1
      if (!identity.transportLigne) nbNonAffecte += 1
    }
  })
  const capaciteTotale = getTransportCapaciteTotaleSnapshot()
  const nbLignesCollege = getTransportLignesSnapshot().filter((l) => l.faitCollege).length
  const pct = occupancyPct(effectif, capaciteTotale)
  const level = occupancyLevel(effectif, capaciteTotale)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bus className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Transport</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          {nbLignesCollege} ligne{nbLignesCollege !== 1 ? 's' : ''} collège
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className={`text-2xl font-bold ${OCCUPANCY_TEXT_CLASS[level]}`}>
            {effectif} / {capaciteTotale}
          </span>
          <p className="text-xs text-slate-500">Élèves transportés / capacité totale ({pct}%)</p>
        </div>
        {nbNonAffecte > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
            {nbNonAffecte} non affecté{nbNonAffecte !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onManage}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800"
      >
        Gérer le Transport
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
