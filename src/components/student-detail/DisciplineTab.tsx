import { useState } from 'react'
import { Shield, ThumbsUp, ThumbsDown, Printer } from 'lucide-react'
import type { DisciplineEvent } from '../../data/studentDetails'
import DisciplineNoticePreviewModal from '../discipline-print/DisciplineNoticePreviewModal'

export default function DisciplineTab({
  studentName,
  classe,
  conduite,
  events,
}: {
  studentName: string
  classe: string
  conduite: number
  events: DisciplineEvent[]
}) {
  const [printEvent, setPrintEvent] = useState<DisciplineEvent | null>(null)
  const typeCounts = events.reduce<Record<string, number>>((acc, e) => {
    if (e.typeCode) acc[e.typeCode] = (acc[e.typeCode] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800">Dossier Disciplinaire & Note de Conduite</h3>
      </div>

      <div className="mb-4 flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-50 text-lg font-bold text-amber-600">
          {conduite}/20
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Note de Conduite et Discipline</p>
          <p className="text-xs text-slate-500">
            Suivi complet des encouragements, avertissements et sanctions de l'élève.
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun événement disciplinaire enregistré.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event, idx) => {
            const positive = event.points >= 0
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 ${
                  positive ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                  <span className="text-xs text-slate-400">{event.date}</span>
                  <span
                    className={`flex items-center gap-1 text-sm font-semibold ${
                      positive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {positive ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                    {positive ? '+' : ''}
                    {event.points} point(s)
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {event.typeCode && <span className="mr-1.5 text-xs font-normal text-slate-400">{event.typeCode}</span>}
                  {event.title}
                  {event.sanction && (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {event.sanction}
                    </span>
                  )}
                  {event.typeCode && typeCounts[event.typeCode] > 1 && (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      ×{typeCounts[event.typeCode]} cette année
                    </span>
                  )}
                </p>
                <p className="mb-2 text-sm text-slate-600">{event.description}</p>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPrintEvent(event)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
                  >
                    <Printer className="h-3 w-3" />
                    Imprimer
                  </button>
                  <p className="text-xs text-slate-400">Signalé par {event.author}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {printEvent && (
        <DisciplineNoticePreviewModal
          studentName={studentName}
          classe={classe}
          date={printEvent.date}
          author={printEvent.author}
          typeCode={printEvent.typeCode}
          title={printEvent.title}
          description={printEvent.description}
          sanction={printEvent.sanction}
          onClose={() => setPrintEvent(null)}
        />
      )}
    </div>
  )
}
