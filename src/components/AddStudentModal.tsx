import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, UserPlus } from 'lucide-react'
import { CLASSE_DOSSIER_INCOMPLET, type Student } from '../data/students'
import { fetchStudents, useAddStudent } from '../services/studentsService'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import type { StudentIdentity } from '../data/studentIdentity'
import { fetchStudentIdentities, upsertStudentIdentity } from '../services/studentIdentityService'
import { getViewedYearIdSnapshot } from '../services/viewedYear'
import StudentIdentityFormFields, { type StudentFormValue } from './student-detail/StudentIdentityFormFields'

interface AddStudentModalProps {
  onClose: () => void
  onCreated: (studentId: string) => void
}

const emptyValue: StudentFormValue = {
  prenom: '',
  nom: '',
  nomAr: '',
  prenomAr: '',
  codeMassar: '',
  classe: '',
  genre: 'Garçon',
  cantine: false,
  gardeApresMidi: false,
  gardeMatin: false,
  gardeMidi: false,
  transport: false,
  dateNaissance: '',
  lieuNaissance: '',
  dateEntree: '',
  parent1Nom: '',
  parent1Prenom: '',
  parent1Tel: '',
  parent1Email: '',
  parent2Nom: '',
  parent2Prenom: '',
  parent2Tel: '',
  parent2Email: '',
}

export default function AddStudentModal({ onClose, onCreated }: AddStudentModalProps) {
  const addStudent = useAddStudent()
  const queryClient = useQueryClient()
  const [value, setValue] = useState<StudentFormValue>(emptyValue)
  const patch = (p: Partial<StudentFormValue>) => setValue((prev) => ({ ...prev, ...p }))
  const canSave = value.prenom.trim() !== '' && value.nom.trim() !== '' && value.classe.trim() !== ''

  const [duplicate, setDuplicate] = useState<{ id: string; message: string } | null>(null)

  const handleCreate = async () => {
    setDuplicate(null)
    const sexe: Student['sexe'] = value.genre === 'Fille' ? 'F' : 'M'
    const fullName = `${value.prenom} ${value.nom}`.trim()
    const codeMassar = value.codeMassar.trim()

    // Rapprochement frais en base (pas un cache client, potentiellement pas encore chargé) avec un
    // élève déjà présent cette année — même code Massar, ou à défaut même nom+classe — pour ne
    // jamais dupliquer. Contrairement à l'import Excel (qui met à jour la fiche existante avec les
    // valeurs du fichier), ce formulaire démarre toujours vierge : y écrire écraserait le transport/
    // les emails parents déjà réels de la fiche existante avec du vide. On refuse donc la création
    // et on renvoie directement vers la fiche déjà là, sans rien modifier.
    const yearId = getViewedYearIdSnapshot()
    const currentYearStudents = await fetchStudents(yearId)
    let existing: Student | undefined
    if (codeMassar) {
      const identities = await fetchStudentIdentities()
      const matchedId = Object.keys(identities).find((id) => identities[id].codeMassar === codeMassar)
      existing = currentYearStudents.find((s) => s.id === matchedId)
    }
    if (!existing) {
      existing = currentYearStudents.find((s) => s.name.toLowerCase() === fullName.toLowerCase() && s.classe === value.classe)
    }
    if (existing) {
      setDuplicate({
        id: existing.id,
        message:
          codeMassar && existing.name.toLowerCase() !== fullName.toLowerCase()
            ? `Un élève avec ce code Massar existe déjà : ${existing.name} (${existing.classe}).`
            : `${existing.name} existe déjà en ${existing.classe}. Pas de seconde fiche créée.`,
      })
      return
    }

    const newStudentId = await addStudent.mutateAsync({
      data: {
        name: fullName,
        sexe,
        classe: value.classe,
        absencesHeures: '0h',
        absencesFois: 0,
        retardsMin: '0h',
        retardsFois: 0,
        totalHeures: '0h',
        taux: 100,
      },
      // Rapproche automatiquement du dossier d'une année précédente si ce code Massar y existe
      // déjà (réinscription) — voir insertStudent()/findDossierIdByCodeMassar() dans le service.
      codeMassar,
    })
    const identity: StudentIdentity = {
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
      transportLigne: null,
      transportLigneSoir: null,
      transportSortie17h: false,
      transportMotifException: null,
      transportMotifAutre: null,
    }
    await upsertStudentIdentity(newStudentId, identity)
    await queryClient.invalidateQueries({ queryKey: ['studentIdentities'] })
    onCreated(newStudentId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserPlus className="h-5 w-5 text-indigo-500" />
            Ajouter un élève
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {duplicate && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>{duplicate.message}</span>
              <button
                type="button"
                onClick={() => {
                  onCreated(duplicate.id)
                  onClose()
                }}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Ouvrir sa fiche
              </button>
            </div>
          )}
          <StudentIdentityFormFields value={value} onChange={patch} classOptions={[...getActiveClassNamesSnapshot(), CLASSE_DOSSIER_INCOMPLET]} />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSave}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ajouter l'élève
          </button>
        </div>
      </div>
    </div>
  )
}
