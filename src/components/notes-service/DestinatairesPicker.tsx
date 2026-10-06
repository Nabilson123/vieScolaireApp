import { useState } from 'react'
import { Users } from 'lucide-react'
import type { NoteAudience, NoteCibleType } from '../../data/notesService'
import { resolveDestinataires } from '../../services/notesServiceService'
import { getStudentsSnapshot } from '../../services/studentsService'
import { searchStudents } from '../../utils/studentSearch'
import { getActiveClassNamesSnapshot } from '../../services/classesService'
import { ALL_NIVEAUX } from '../../data/teachers'
import { getTeachersSnapshot } from '../../services/teachersService'
import { teacherName } from '../../data/teachers'
import { getProfilesSnapshot } from '../../services/profilesService'

interface DestinatairesPickerProps {
  audience: NoteAudience
  cibleType: NoteCibleType
  cibleNiveau: string | null
  cibleClasse: string | null
  cibleEleveIds: string[]
  ciblePersonneIds: string[]
  onChange: (patch: {
    cibleType?: NoteCibleType
    cibleNiveau?: string | null
    cibleClasse?: string | null
    cibleEleveIds?: string[]
    ciblePersonneIds?: string[]
  }) => void
}

export default function DestinatairesPicker({ audience, cibleType, cibleNiveau, cibleClasse, cibleEleveIds, ciblePersonneIds, onChange }: DestinatairesPickerProps) {
  const [search, setSearch] = useState('')

  const { count } = resolveDestinataires({ audience, cibleType, cibleNiveau, cibleClasse, cibleEleveIds, ciblePersonneIds })

  const toggleEleve = (id: string) => {
    onChange({ cibleEleveIds: cibleEleveIds.includes(id) ? cibleEleveIds.filter((x) => x !== id) : [...cibleEleveIds, id] })
  }
  const togglePersonne = (id: string) => {
    onChange({ ciblePersonneIds: ciblePersonneIds.includes(id) ? ciblePersonneIds.filter((x) => x !== id) : [...ciblePersonneIds, id] })
  }

  return (
    <div className="space-y-3">
      {audience === 'PARENTS' && (
        <>
          <select
            value={cibleType}
            onChange={(e) => onChange({ cibleType: e.target.value as NoteCibleType, cibleNiveau: null, cibleClasse: null, cibleEleveIds: [] })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
          >
            <option value="etablissement">Tout l'établissement</option>
            <option value="niveau">Par niveau</option>
            <option value="classe">Par classe</option>
            <option value="eleves">Élèves spécifiques</option>
          </select>
          {cibleType === 'niveau' && (
            <select
              value={cibleNiveau ?? ''}
              onChange={(e) => onChange({ cibleNiveau: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner un niveau...</option>
              {ALL_NIVEAUX.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
          {cibleType === 'classe' && (
            <select
              value={cibleClasse ?? ''}
              onChange={(e) => onChange({ cibleClasse: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner une classe...</option>
              {getActiveClassNamesSnapshot().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {cibleType === 'eleves' && (
            <div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un élève..."
                className="mb-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
                {searchStudents(getStudentsSnapshot(), search, { limit: Number.MAX_SAFE_INTEGER })
                  .map((s) => (
                    <label key={s.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={cibleEleveIds.includes(s.id)} onChange={() => toggleEleve(s.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
                      {s.name} <span className="text-slate-400">({s.classe})</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {(audience === 'ENSEIGNANTS' || audience === 'ADMINISTRATIF') && (
        <>
          <select
            value={cibleType}
            onChange={(e) => onChange({ cibleType: e.target.value as NoteCibleType, ciblePersonneIds: [] })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
          >
            <option value="etablissement">{audience === 'ENSEIGNANTS' ? 'Tous les enseignants' : 'Tout le personnel'}</option>
            <option value="personnes">Personnes spécifiques</option>
          </select>
          {cibleType === 'personnes' && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
              {(audience === 'ENSEIGNANTS' ? getTeachersSnapshot().map((t) => ({ id: t.id, label: teacherName(t) })) : getProfilesSnapshot().map((p) => ({ id: p.id, label: p.nomComplet }))).map(
                (person) => (
                  <label key={person.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={ciblePersonneIds.includes(person.id)} onChange={() => togglePersonne(person.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
                    {person.label}
                  </label>
                )
              )}
            </div>
          )}
        </>
      )}

      {audience === 'TOUS' && <p className="text-xs text-slate-400">Toute l'école (familles, enseignants et personnel administratif).</p>}

      <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
        <Users className="h-3.5 w-3.5" />
        {count} destinataire{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
      </p>
    </div>
  )
}
