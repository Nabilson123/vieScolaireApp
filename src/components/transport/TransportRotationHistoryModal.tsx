import { X, History } from 'lucide-react'
import { useTransportRotationHistory } from '../../services/transportRotationHistoryService'

interface TransportRotationHistoryModalProps {
  onClose: () => void
}

function formatDateTimeFR(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function TransportRotationHistoryModal({ onClose }: TransportRotationHistoryModalProps) {
  const { data: history = [], isLoading } = useTransportRotationHistory()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <History className="h-5 w-5 text-indigo-500" />
            Historique des rotations
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && <p className="py-8 text-center text-sm text-slate-400">Chargement...</p>}
          {!isLoading && history.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Aucune modification enregistrée pour l'instant.</p>
          )}
          {!isLoading && history.length > 0 && (
            <div className="space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-xs text-slate-400">{formatDateTimeFR(entry.changedAt)}</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {entry.lignesCollege.length === 0
                      ? 'Aucune ligne collège'
                      : `Ligne${entry.lignesCollege.length > 1 ? 's' : ''} ${entry.lignesCollege.join(', ')}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
