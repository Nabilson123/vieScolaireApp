import { Loader2, ShieldCheck, X } from 'lucide-react'

interface WriteToolConfirmationCardProps {
  description: string
  executing: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function WriteToolConfirmationCard({ description, executing, onConfirm, onCancel }: WriteToolConfirmationCardProps) {
  return (
    <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <ShieldCheck className="h-4 w-4" />
        Confirmation requise
      </div>
      <p className="mb-3 text-sm text-slate-700">{description}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={executing}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {executing && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirmer
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={executing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Annuler
        </button>
      </div>
    </div>
  )
}
