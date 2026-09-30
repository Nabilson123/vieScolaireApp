import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DoorOpen, X } from 'lucide-react'
import { useStudents } from '../services/studentsService'
import { useStudentExtras } from '../services/studentDetailsService'
import { useSortiesAnticipees, declareSortieAnticipeeParent } from '../services/sortiesAnticipeesService'
import { useAbsencesConfig } from '../services/absencesConfigService'

interface ParentPortalAbsencesProps {
  studentId: string
  parentId: string
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function DeclarerSortieModal({ studentId, parentId, onClose }: { studentId: string; parentId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: absencesConfig } = useAbsencesConfig()
  const motifOptions = absencesConfig?.motifs ?? []
  const [date, setDate] = useState(todayISO())
  const [heure, setHeure] = useState('')
  const [recuperePar, setRecuperePar] = useState('')
  const [motif, setMotif] = useState('')
  const [saving, setSaving] = useState(false)

  const canSubmit = !!heure && recuperePar.trim() !== ''

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      await declareSortieAnticipeeParent({ studentId, parentId, date, heure, recuperePar: recuperePar.trim(), motif })
      await queryClient.invalidateQueries({ queryKey: ['sortiesAnticipees'] })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <DoorOpen className="h-5 w-5 text-indigo-500" />
            Sortie anticipée
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Heure de sortie</label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Récupéré par</label>
            <input
              value={recuperePar}
              onChange={(e) => setRecuperePar(e.target.value)}
              placeholder="Votre nom ou celui du responsable"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Motif (optionnel)</label>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner un motif...</option>
              {motifOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Envoi...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ParentPortalAbsences({ studentId, parentId }: ParentPortalAbsencesProps) {
  const { data: students = [] } = useStudents()
  const { data: extras = {} } = useStudentExtras()
  const { data: sorties = [] } = useSortiesAnticipees()
  const student = students.find((s) => s.id === studentId)
  const events = [...(extras[studentId]?.events ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))
  const sortiesEleve = [...sorties.filter((s) => s.studentId === studentId)].sort((a, b) => (a.date < b.date ? 1 : -1))
  const [showDeclare, setShowDeclare] = useState(false)

  if (!student) return <p className="py-10 text-center text-sm text-slate-400">Chargement...</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Absences</p>
          <p className="text-2xl font-bold text-slate-900">{student.absencesFois}</p>
          <p className="text-xs text-slate-500">{student.absencesHeures || '0h'} manquées</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Retards</p>
          <p className="text-2xl font-bold text-slate-900">{student.retardsFois}</p>
          <p className="text-xs text-slate-500">{student.retardsMin || '0min'} cumulées</p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucune absence ni retard enregistré — assiduité parfaite.</p>
      ) : (
        <div className="space-y-2">
          {events.map((e, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-semibold ${e.type === 'ABSENCE' ? 'text-rose-600' : 'text-amber-600'}`}>
                  {e.type === 'ABSENCE' ? 'Absence' : 'Retard'} — {e.subject}
                </p>
                <span className="text-xs text-slate-400">{e.date}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {e.duree} · {e.motif || 'Sans motif renseigné'}
              </p>
              {e.justified && (
                <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  Justifié
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <DoorOpen className="h-4 w-4 text-indigo-500" />
          Sorties anticipées
        </h3>
        <button
          type="button"
          onClick={() => setShowDeclare(true)}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700"
        >
          Signaler
        </button>
      </div>

      {sortiesEleve.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Aucune sortie anticipée déclarée.</p>
      ) : (
        <div className="space-y-2">
          {sortiesEleve.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{s.date} à {s.heure}</p>
                {s.source === 'staff' && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Par l'établissement</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">Récupéré par {s.recuperePar}{s.motif ? ` · ${s.motif}` : ''}</p>
            </div>
          ))}
        </div>
      )}

      {showDeclare && <DeclarerSortieModal studentId={studentId} parentId={parentId} onClose={() => setShowDeclare(false)} />}
    </div>
  )
}
