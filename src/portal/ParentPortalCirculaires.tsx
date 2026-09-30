import { useState } from 'react'
import { FileText, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { useMyCirculaires, useMarkCirculaireRead, type ParentCirculaireEntry } from '../services/circulairesService'

interface ParentPortalCirculairesProps {
  parentId: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ParentPortalCirculaires({ parentId }: ParentPortalCirculairesProps) {
  const { data: entries = [] } = useMyCirculaires(parentId)
  const markRead = useMarkCirculaireRead()
  const [openEntry, setOpenEntry] = useState<ParentCirculaireEntry | null>(null)

  const handleOpen = (entry: ParentCirculaireEntry) => {
    setOpenEntry(entry)
    if (!entry.readAt) markRead.mutate(entry.lectureId)
  }

  if (openEntry) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setOpenEntry(null)} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
          <ChevronLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-400">{formatDate(openEntry.circulaire.publieAt)}</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{openEntry.circulaire.titre}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{openEntry.circulaire.corps}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-slate-700" />
        <h2 className="text-sm font-bold text-slate-800">Circulaires</h2>
      </div>

      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucune circulaire pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <button
              key={entry.lectureId}
              type="button"
              onClick={() => handleOpen(entry)}
              className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm"
            >
              <div>
                <p className={`text-sm font-semibold ${entry.readAt ? 'text-slate-700' : 'text-slate-900'}`}>{entry.circulaire.titre}</p>
                <p className="mt-0.5 text-xs text-slate-400">{formatDate(entry.circulaire.publieAt)}</p>
              </div>
              {entry.readAt ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
