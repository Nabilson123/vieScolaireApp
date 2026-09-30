import { MessageSquareWarning } from 'lucide-react'
import type { ReclamationRecord } from '../../data/studentDetails'
import ReclamationCard from '../ReclamationCard'
import { useIsViewedYearEditable } from '../../services/viewedYear'

interface ReclamationsTabProps {
  reclamations: ReclamationRecord[]
  onTakeCharge: (index: number) => void
  onResolve: (index: number, resolution: string) => void
  onDelete: (index: number) => void
}

export default function ReclamationsTab({ reclamations, onTakeCharge, onResolve, onDelete }: ReclamationsTabProps) {
  const isEditable = useIsViewedYearEditable()
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquareWarning className="h-4 w-4 text-rose-400" />
        <h3 className="text-sm font-semibold text-slate-800">Suivi des Réclamations des Parents</h3>
      </div>

      {reclamations.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucune réclamation enregistrée.</p>
      ) : (
        <div className="space-y-3">
          {reclamations.map((r, idx) => (
            <ReclamationCard
              key={idx}
              reclamation={r}
              onTakeCharge={() => onTakeCharge(idx)}
              onResolve={(resolution) => onResolve(idx, resolution)}
              onDelete={() => onDelete(idx)}
              isEditable={isEditable}
            />
          ))}
        </div>
      )}
    </div>
  )
}
