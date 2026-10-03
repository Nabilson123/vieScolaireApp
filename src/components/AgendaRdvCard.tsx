import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, MapPin, Plus, ArrowRight, Video } from 'lucide-react'
import { getStudentsSnapshot } from '../services/studentsService'
import type { RendezVousRecord } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentRendezVous } from '../services/studentDetailsService'
import PlanifierRdvModal, { rdvFieldsFromPayload, type PlanifierRdvPayload } from './PlanifierRdvModal'
import PartagerRdvModal from './PartagerRdvModal'
import { buildRdvMessage } from '../utils/whatsapp'

interface AgendaRdvCardProps {
  onNavigateToStudent: (id: string) => void
  onViewAll?: () => void
}

interface UpcomingRdv {
  studentId: string
  studentName: string
  classe: string
  record: RendezVousRecord
}

const MOIS_ABBR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC']

function computeUpcoming(limit: number): UpcomingRdv[] {
  const now = new Date()
  const nowISO = now.toISOString().slice(0, 10)
  const nowTime = now.toTimeString().slice(0, 5)
  const list: UpcomingRdv[] = []
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).rendezVous.forEach((r) => {
      if (r.statut !== 'Planifié') return
      if (r.date < nowISO || (r.date === nowISO && r.heure < nowTime)) return
      list.push({ studentId: s.id, studentName: s.name, classe: s.classe, record: r })
    })
  })
  return list.sort((a, b) => (a.record.date + a.record.heure < b.record.date + b.record.heure ? -1 : 1)).slice(0, limit)
}

function dateBadge(dateISO: string): { day: string; mois: string } {
  const d = new Date(`${dateISO}T00:00:00`)
  return { day: String(d.getDate()).padStart(2, '0'), mois: MOIS_ABBR[d.getMonth()] }
}

export default function AgendaRdvCard({ onNavigateToStudent, onViewAll }: AgendaRdvCardProps) {
  const queryClient = useQueryClient()
  const [, setRefresh] = useState(0)
  const [showPlanifier, setShowPlanifier] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const upcoming = computeUpcoming(5)

  const handleCreate = async (payload: PlanifierRdvPayload) => {
    const record: RendezVousRecord = { ...rdvFieldsFromPayload(payload), statut: 'Planifié' }
    const existing = getStudentExtraSnapshot(payload.studentId).rendezVous
    await updateStudentRendezVous(payload.studentId, [record, ...existing])
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    const student = getStudentsSnapshot().find((s) => s.id === payload.studentId)
    setShareMessage(buildRdvMessage({ studentName: student?.name ?? '', classe: student?.classe ?? '', record }))
    setShowPlanifier(false)
    setRefresh((v) => v + 1)
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-indigo-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Agenda des Rendez-vous Parents</h3>
            <p className="text-xs text-slate-400">Planning des réunions et entretiens individuels planifiés.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPlanifier(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <Plus className="h-4 w-4" />
          Planifier un RDV
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun rendez-vous à venir.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((item, idx) => {
            const badge = dateBadge(item.record.date)
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigateToStudent(item.studentId)}
                className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <span className="text-base font-bold leading-none">{badge.day}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide">{badge.mois}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {item.studentName} <span className="text-slate-400">· {item.classe}</span>
                    </p>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
                      {item.record.heure}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{item.record.motif}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    {item.record.mode === 'Virtuel' ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                    {item.record.mode === 'Virtuel' ? 'Visioconférence' : `Lieu : ${item.record.lieu}`}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Voir tous les rendez-vous
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}

      {showPlanifier && <PlanifierRdvModal onClose={() => setShowPlanifier(false)} onSubmit={handleCreate} />}
      {shareMessage && <PartagerRdvModal message={shareMessage} justCreated onClose={() => setShareMessage(null)} />}
    </div>
  )
}
