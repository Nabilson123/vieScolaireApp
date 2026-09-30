import { useState } from 'react'
import {
  Target,
  Pencil,
  Send,
  PlusCircle,
  MessageCircle,
  Check,
  Clock3,
} from 'lucide-react'
import type { Student } from '../../data/students'
import type { ProjetPersonnelInfo } from '../../data/studentDetails'
import { initials } from '../../data/students'
import EditProjectModal from './EditProjectModal'

interface ProjetPersonnelTabProps {
  student: Student
  projet: ProjetPersonnelInfo
}

export default function ProjetPersonnelTab({ student, projet }: ProjetPersonnelTabProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Suivi du Projet Personnel & Orientation</h3>
            <p className="text-xs text-slate-500">
              Enrichissez les filières visées, la checklist des objectifs et les compétences de{' '}
              {student.name.split(' ')[0]}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <Pencil className="h-4 w-4" />
          Éditer / Enrichir le Projet
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-800">Profil & Parcours</p>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
              {initials(student.name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{student.name}</p>
              <p className="text-xs text-slate-500">Classe : {student.classe}</p>
            </div>
          </div>
          <span className="mb-2 inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
            RANG : {projet.rang.toUpperCase()}
          </span>
          <div className="mb-3">
            <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
              Moyenne : {student.id === 's1' ? '13.6' : '—'} / 20
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Intérêt orientation visée
            </p>
            <p className="flex items-center justify-between text-sm font-medium text-slate-700">
              {projet.filiereVisee}
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Objectifs & Progression</p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">
              {projet.progressionPct}%
            </span>
          </div>

          <p className="text-xs text-slate-500">{projet.objectifLabel}</p>
          <p className="mb-1 text-xs font-medium text-slate-700">{projet.objectifSousLabel}</p>
          <div className="mb-3 h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500"
              style={{ width: `${projet.progressionPct}%` }}
            />
          </div>

          <div className="space-y-2">
            <div className="rounded-lg bg-emerald-50 px-2.5 py-2">
              <p className="text-xs font-semibold text-emerald-700">{projet.stageValide}</p>
              <p className="text-[11px] text-emerald-600">{projet.stageDetail}</p>
            </div>
            <div className="rounded-lg bg-rose-50 px-2.5 py-2">
              <p className="text-xs font-semibold text-rose-700">{projet.pointFaible}</p>
              <p className="text-[11px] text-rose-600">{projet.pointFaibleDetail}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-2.5 py-2">
              <p className="text-xs font-semibold text-slate-700">Évaluation Psy. Orientation</p>
              <p className="text-[11px] text-slate-500">{projet.evaluationPsy}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <MessageCircle className="h-4 w-4 text-slate-400" />
            Suivi de l'Orientation & Chat IA
          </p>
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto pr-1">
            {projet.messages.map((m, idx) => (
              <div key={idx} className="rounded-lg bg-slate-50 p-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{m.author}</span>
                  <span className="text-[10px] text-slate-400">{m.date}</span>
                </div>
                <p className="text-xs text-slate-600">{m.message}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Poser une question au..."
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-medium text-white hover:from-indigo-500 hover:to-violet-500"
            >
              <Send className="h-3.5 w-3.5" />
              Envoyer
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-800">Compétences & Activités Extra-scolaires</p>
          <div className="mb-3 space-y-2">
            {projet.competences.map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-xs"
              >
                <span className="font-medium text-slate-700">{c.label}</span>
                {c.active && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    ACTIF
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Ajouter une activité ou compétence
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">
          Historique des Conseils & Chronologie de l'Orientation
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {projet.timeline.map((step, idx) => {
            const validated = step.status === 'VALIDÉ'
            return (
              <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="mb-1 text-xs font-medium text-slate-500">{step.date}</p>
                <p className="mb-2 text-sm font-semibold text-slate-800">{step.label}</p>
                <span
                  className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    validated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {validated ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                  {step.status}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && (
        <EditProjectModal student={student} projet={projet} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
