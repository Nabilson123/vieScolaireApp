import { useState } from 'react'
import { X } from 'lucide-react'
import { CLASSE_DOSSIER_INCOMPLET, type Student } from '../../data/students'
import { useUpdateStudent } from '../../services/studentsService'
import { getActiveClassNamesSnapshot } from '../../services/classesService'
import type { StudentIdentity } from '../../data/studentIdentity'
import { useUpsertStudentIdentity } from '../../services/studentIdentityService'
import StudentIdentityFormFields, { type StudentFormValue } from './StudentIdentityFormFields'

interface StudentIdentityEditModalProps {
  student: Student
  identity: StudentIdentity
  onClose: () => void
  onSaved: (student: Student) => void
}

function splitName(name: string): { prenom: string; nom: string } {
  const parts = name.trim().split(/\s+/)
  return { prenom: parts[0] ?? '', nom: parts.slice(1).join(' ') }
}

export default function StudentIdentityEditModal({ student, identity, onClose, onSaved }: StudentIdentityEditModalProps) {
  const updateStudent = useUpdateStudent()
  const upsertIdentity = useUpsertStudentIdentity()
  const fallback = splitName(student.name)
  const [value, setValue] = useState<StudentFormValue>({
    prenom: identity.prenom || fallback.prenom,
    nom: identity.nom || fallback.nom,
    nomAr: identity.nomAr,
    prenomAr: identity.prenomAr,
    codeMassar: identity.codeMassar,
    classe: student.classe,
    genre: student.sexe === 'F' ? 'Fille' : 'Garçon',
    cantine: identity.cantine,
    gardeApresMidi: identity.gardeApresMidi,
    gardeMatin: identity.gardeMatin,
    gardeMidi: identity.gardeMidi,
    transport: identity.transport,
    dateNaissance: identity.dateNaissance,
    lieuNaissance: identity.lieuNaissance,
    dateEntree: identity.dateEntree,
    parent1Nom: identity.parent1Nom,
    parent1Prenom: identity.parent1Prenom,
    parent1Tel: identity.parent1Tel,
    parent1Email: identity.parent1Email,
    parent2Nom: identity.parent2Nom,
    parent2Prenom: identity.parent2Prenom,
    parent2Tel: identity.parent2Tel,
    parent2Email: identity.parent2Email,
  })

  const patch = (p: Partial<StudentFormValue>) => setValue((prev) => ({ ...prev, ...p }))
  const canSave = value.prenom.trim() !== '' && value.nom.trim() !== '' && value.classe.trim() !== ''

  const handleSave = () => {
    const name = `${value.prenom} ${value.nom}`.trim()
    const sexe: Student['sexe'] = value.genre === 'Fille' ? 'F' : 'M'
    updateStudent.mutate({ id: student.id, patch: { name, sexe, classe: value.classe } })
    const newIdentity: StudentIdentity = {
      prenom: value.prenom,
      nom: value.nom,
      nomAr: value.nomAr,
      prenomAr: value.prenomAr,
      codeMassar: value.codeMassar,
      cantine: value.cantine,
      gardeApresMidi: value.gardeApresMidi,
      gardeMatin: value.gardeMatin,
      gardeMidi: value.gardeMidi,
      transport: value.transport,
      dateNaissance: value.dateNaissance,
      lieuNaissance: value.lieuNaissance,
      dateEntree: value.dateEntree,
      parent1Nom: value.parent1Nom,
      parent1Prenom: value.parent1Prenom,
      parent1Tel: value.parent1Tel,
      parent1Email: value.parent1Email,
      parent2Nom: value.parent2Nom,
      parent2Prenom: value.parent2Prenom,
      parent2Tel: value.parent2Tel,
      parent2Email: value.parent2Email,
      // Champs gérés uniquement depuis le module Transport, absents de ce formulaire : on les
      // reporte tels quels pour ne pas effacer une affectation existante lors d'un upsert complet.
      transportLigne: identity.transportLigne,
      transportLigneSoir: identity.transportLigneSoir,
      transportSortie17h: identity.transportSortie17h,
      transportMotifException: identity.transportMotifException,
      transportMotifAutre: identity.transportMotifAutre,
    }
    upsertIdentity.mutate({ studentId: student.id, identity: newIdentity })
    onSaved({ ...student, name, sexe, classe: value.classe })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Modifier les informations générales</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <StudentIdentityFormFields value={value} onChange={patch} classOptions={[...getActiveClassNamesSnapshot(), CLASSE_DOSSIER_INCOMPLET]} />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}
