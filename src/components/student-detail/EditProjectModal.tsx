import { useState } from 'react'
import { X, FlaskConical, LineChart, Palette, Cpu, Compass, Pin, Trophy, CalendarRange } from 'lucide-react'
import type { Student } from '../../data/students'
import type { ProjetPersonnelInfo } from '../../data/studentDetails'
import ObjectifsTab from './modal/ObjectifsTab'
import ActivitesTab from './modal/ActivitesTab'
import ChronologieTab from './modal/ChronologieTab'

interface EditProjectModalProps {
  student: Student
  projet: ProjetPersonnelInfo
  onClose: () => void
}

const modalTabs = [
  { key: 'filiere', label: 'Filière & Orientation', icon: Compass },
  { key: 'objectifs', label: 'Objectifs & Progression', icon: Pin },
  { key: 'activites', label: 'Activités & Talents', icon: Trophy },
  { key: 'chronologie', label: 'Chronologie / Jalons', icon: CalendarRange },
]

const filieres = [
  { key: 'sciences', label: 'Sciences', detail: 'Maths, Physique, SVT', icon: FlaskConical },
  { key: 'eco', label: 'Économie', detail: 'Gestion, Éco, Droit', icon: LineChart },
  { key: 'lettres', label: 'Lettres & Arts', detail: 'Langues, Philosophie, Art', icon: Palette },
  { key: 'techno', label: 'Technologie', detail: 'STI2D, Génie Électrique', icon: Cpu },
]

export default function EditProjectModal({ student, projet, onClose }: EditProjectModalProps) {
  const [activeModalTab, setActiveModalTab] = useState(modalTabs[0].key)
  const [selectedFiliere, setSelectedFiliere] = useState('sciences')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
              AA
            </div>
            <div>
              <p className="text-sm font-bold text-white">Éditer / Enrichir le Projet de {student.name}</p>
              <p className="text-xs text-indigo-100">
                Classe {student.classe} — Suivi d'orientation & compétences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-6 pt-3">
          {modalTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeModalTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveModalTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {activeModalTab === 'filiere' && (
            <>
              <p className="mb-3 text-sm font-semibold text-slate-700">Sélectionner la filière principale visée :</p>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {filieres.map((f) => {
                  const Icon = f.icon
                  const isSelected = selectedFiliere === f.key
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setSelectedFiliere(f.key)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-4 text-center transition-colors ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-semibold text-slate-800">{f.label}</span>
                      <span className="text-[11px] text-slate-400">{f.detail}</span>
                    </button>
                  )
                })}
              </div>

              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Précision du vœu de carrière ou école visée :
              </label>
              <input
                type="text"
                defaultValue="Filière Scientifique (Maths / Physique / NSI)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </>
          )}

          {activeModalTab === 'objectifs' && <ObjectifsTab initial={projet.objectifsChecklist} />}
          {activeModalTab === 'activites' && (
            <ActivitesTab initial={projet.competences.map((c) => c.label)} />
          )}
          {activeModalTab === 'chronologie' && <ChronologieTab initial={projet.timeline} />}
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
            onClick={onClose}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            Enregistrer le Projet
          </button>
        </div>
      </div>
    </div>
  )
}
