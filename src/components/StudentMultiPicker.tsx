import { useState } from 'react'
import { X } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import StudentSearchSelect from './StudentSearchSelect'

interface StudentMultiPickerProps {
  /** Libellé du sélecteur d'élève (ex. « Élève(s) concerné(s) »). */
  label: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** Élèves non proposés (ex. déjà retenus dans l'autre liste). */
  excludeIds?: string[]
  /** Teinte des pastilles des élèves retenus. */
  tone?: 'indigo' | 'rose'
  hint?: string
}

const selectClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none'

const CHIP: Record<NonNullable<StudentMultiPickerProps['tone']>, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
}

/** Choix d'un ou plusieurs élèves, de classes différentes si besoin : on filtre par classe, on ajoute, les élèves retenus
 * restent affichés en pastilles que l'on peut retirer. */
export default function StudentMultiPicker({ label, selectedIds, onChange, excludeIds = [], tone = 'indigo', hint }: StudentMultiPickerProps) {
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const [classe, setClasse] = useState(realClasses[0])
  const students = getStudentsSnapshot()
  // La recherche couvre toutes les classes ; la classe choisie ne fait que proposer ses élèves d'emblée.
  const options = students.filter((s) => !selectedIds.includes(s.id) && !excludeIds.includes(s.id))
  const selected = selectedIds.map((id) => students.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classe</label>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} className={selectClass}>
            {realClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
          <StudentSearchSelect
            students={options}
            value=""
            classe={classe}
            placeholder={selected.length === 0 ? 'Rechercher un élève...' : 'Ajouter un autre élève...'}
            onChange={(id) => {
              if (id) onChange([...selectedIds, id])
            }}
          />
        </div>
      </div>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s.id} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold ring-1 ring-inset ${CHIP[tone]}`}>
              {s.name}
              <span className="font-normal opacity-70">({s.classe})</span>
              <button
                type="button"
                onClick={() => onChange(selectedIds.filter((id) => id !== s.id))}
                aria-label={`Retirer ${s.name}`}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
