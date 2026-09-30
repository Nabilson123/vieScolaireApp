import { useState } from 'react'
import { X, HeartPulse } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'

interface NewInfirmerieVisitModalProps {
  onClose: () => void
  onSubmit: (payload: {
    studentId: string
    motif: string
    action: string
    date: string
    heure: string
  }) => void
}

const MOTIFS = [
  'Maux de tête / Fièvre',
  'Maux de dents / Douleur dentaire',
  'Maux de ventre / Nausées',
  "Accident / Blessure dans l'établissement",
  'Gêne respiratoire / Asthme',
  'Malaise / Fatigue intense',
  'Égratignure / Plaie légère',
  'Autre motif',
]

const ACTIONS = [
  'Repos à l’infirmerie (15-30 min)',
  'Appel téléphonique aux parents',
  "Prise en charge assurance & Évacuation d'urgence",
  'Administration médicament PAI',
  'Désinfection antiseptique & Pansement',
  'Prise de température & Surveillance',
  'Retour en classe après soins',
  'Autre action',
]

function nowISO() {
  const now = new Date()
  return { date: now.toISOString().slice(0, 10), heure: now.toTimeString().slice(0, 5) }
}

export default function NewInfirmerieVisitModal({ onClose, onSubmit }: NewInfirmerieVisitModalProps) {
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const initial = nowISO()

  const [classe, setClasse] = useState(realClasses[0])
  const [studentId, setStudentId] = useState('')
  const [motif, setMotif] = useState(MOTIFS[0])
  const [motifAutre, setMotifAutre] = useState('')
  const [action, setAction] = useState(ACTIONS[0])
  const [actionAutre, setActionAutre] = useState('')
  const [date, setDate] = useState(initial.date)
  const [heure, setHeure] = useState(initial.heure)

  const elevesDeLaClasse = getStudentsSnapshot().filter((s) => s.classe === classe)
  const isMotifAutre = motif === 'Autre motif'
  const isActionAutre = action === 'Autre action'

  const handleSubmit = () => {
    if (!studentId) return
    if (isMotifAutre && !motifAutre.trim()) return
    if (isActionAutre && !actionAutre.trim()) return

    onSubmit({
      studentId,
      motif: isMotifAutre ? motifAutre.trim() : motif,
      action: isActionAutre ? actionAutre.trim() : action,
      date,
      heure,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <HeartPulse className="h-5 w-5 text-indigo-600" />
            Nouveau Passage à l'Infirmerie
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classe</label>
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élève concerné</label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Sélectionner...</option>
                {elevesDeLaClasse.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motif de la Visite</label>
            <select
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value)
                setMotifAutre('')
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {MOTIFS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {isMotifAutre && (
              <input
                type="text"
                value={motifAutre}
                onChange={(e) => setMotifAutre(e.target.value)}
                placeholder="Précisez le motif..."
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Action menée / Soin apporté</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value)
                setActionAutre('')
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {isActionAutre && (
              <input
                type="text"
                value={actionAutre}
                onChange={(e) => setActionAutre(e.target.value)}
                placeholder="Précisez l'action..."
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure</label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
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
            disabled={!studentId || (isMotifAutre && !motifAutre.trim()) || (isActionAutre && !actionAutre.trim())}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Valider le passage
          </button>
        </div>
      </div>
    </div>
  )
}
