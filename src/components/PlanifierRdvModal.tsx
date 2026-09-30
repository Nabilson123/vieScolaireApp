import { useState } from 'react'
import { X, CalendarClock } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'

export interface PlanifierRdvPayload {
  studentId: string
  date: string
  heure: string
  duree: number
  mode: 'Présentiel' | 'Virtuel'
  lieu: string
  motif: string
  notesParents: string
  enseignant: string
}

interface PlanifierRdvModalProps {
  onClose: () => void
  onSubmit: (payload: PlanifierRdvPayload) => void
  fixedStudentId?: string
  initial?: PlanifierRdvPayload
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const DUREE_OPTIONS = [15, 30, 45, 60]

export default function PlanifierRdvModal({ onClose, onSubmit, fixedStudentId, initial }: PlanifierRdvModalProps) {
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const staffNames = getTeachersSnapshot()
    .map((t) => teacherName(t))
    .sort((a, b) => a.localeCompare(b))

  const fixedStudent = fixedStudentId ? getStudentsSnapshot().find((s) => s.id === fixedStudentId) : undefined

  const [classe, setClasse] = useState(fixedStudent?.classe ?? realClasses[0])
  const [studentId, setStudentId] = useState(initial?.studentId ?? fixedStudentId ?? '')
  const [enseignant, setEnseignant] = useState(initial?.enseignant ?? '')
  // Rencontre purement administrative (direction/CPE avec la famille, sans prof concerné) : pas de
  // nouveau champ séparé — enseignant reste '' comme avant, seule la validation change (n'était
  // jamais possible de soumettre avec enseignant vide auparavant).
  const [adminSeulement, setAdminSeulement] = useState(!initial?.enseignant && !!initial)
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [heure, setHeure] = useState(initial?.heure ?? '10:00')
  const [duree, setDuree] = useState(initial?.duree ?? 30)
  const [mode, setMode] = useState<'Présentiel' | 'Virtuel'>(initial?.mode ?? 'Présentiel')
  const [lieu, setLieu] = useState(initial?.lieu ?? '')
  const [motif, setMotif] = useState(initial?.motif ?? '')
  const [notesParents, setNotesParents] = useState(initial?.notesParents ?? '')

  const elevesDeLaClasse = fixedStudent ? [fixedStudent] : getStudentsSnapshot().filter((s) => s.classe === classe)

  const isEdit = !!initial

  const handleSubmit = () => {
    if (!studentId || (!adminSeulement && !enseignant) || !date || !heure || !lieu.trim() || !motif.trim()) return
    onSubmit({
      studentId,
      date,
      heure,
      duree,
      mode,
      lieu: lieu.trim(),
      motif: motif.trim(),
      notesParents: notesParents.trim(),
      enseignant: adminSeulement ? '' : enseignant,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CalendarClock className="h-5 w-5 text-indigo-500" />
            {isEdit ? 'Modifier le Rendez-vous' : 'Planifier un Rendez-vous'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!fixedStudent && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Filtrer par Classe</label>
                <select
                  value={classe}
                  onChange={(e) => {
                    setClasse(e.target.value)
                    setStudentId('')
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {realClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élève concerné*</label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">Sélectionnez un élève...</option>
                  {elevesDeLaClasse.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
              Enseignant concerné{adminSeulement ? '' : '*'}
            </label>
            <select
              value={enseignant}
              onChange={(e) => setEnseignant(e.target.value)}
              disabled={adminSeulement}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Sélectionnez un enseignant...</option>
              {staffNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={adminSeulement}
                onChange={(e) => {
                  setAdminSeulement(e.target.checked)
                  if (e.target.checked) setEnseignant('')
                }}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              Rencontre avec l'administration seulement (aucun enseignant concerné)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date*</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure (HH:MM)*</label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Durée*</label>
              <select
                value={duree}
                onChange={(e) => setDuree(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {DUREE_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} minutes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mode de rencontre*</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'Présentiel' | 'Virtuel')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="Présentiel">Présentiel</option>
                <option value="Virtuel">Virtuel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Lieu de rencontre / Lien Visioconférence*
            </label>
            <input
              type="text"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="ex: Salle 4, ou lien de visioconférence"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motif / Objet du rendez-vous*</label>
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="ex: Difficultés d'assiduité, Bilan d'orientation..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Demandes ou notes des parents (Optionnel)</label>
            <textarea
              value={notesParents}
              onChange={(e) => setNotesParents(e.target.value)}
              rows={2}
              placeholder="ex: Souhaite parler du comportement aux récréations..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!studentId || (!adminSeulement && !enseignant) || !lieu.trim() || !motif.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
