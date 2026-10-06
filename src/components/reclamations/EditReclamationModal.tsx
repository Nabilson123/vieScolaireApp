import { useState } from 'react'
import { X, Pencil } from 'lucide-react'
import { RECLAMATION_CATEGORIES, type ReclamationRecord } from '../../data/studentDetails'
import { teacherName } from '../../data/teachers'
import { getTeachersSnapshot } from '../../services/teachersService'
import { getStudentIdentitySnapshot } from '../../services/studentIdentityService'
import type { ReclamationPatch } from '../../services/studentDetailsService'
import { cleanReclamationText } from '../../utils/reclamationsLogic'
import { useReclamationServices } from '../../services/reclamationServicesService'
import { serviceFor } from '../../utils/reclamationsServices'
import TeacherSearchSelect from '../TeacherSearchSelect'

const AUTRE_SENTINEL = '__AUTRE__'

interface EditReclamationModalProps {
  reclamation: ReclamationRecord
  studentId: string
  studentName?: string
  onClose: () => void
  /** `detail` = libellés des champs réellement modifiés, pour la frise chronologique. */
  onSave: (patch: ReclamationPatch, detail: string) => void
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none'

/**
 * Corriger une réclamation déjà enregistrée (catégorie, objet, description, concerné, parent, date). Les
 * textes sont pré-remplis nettoyés de leur mise en forme markdown : enregistrer corrige donc aussi les
 * anciens titres abîmés par un copier-coller.
 */
export default function EditReclamationModal({ reclamation, studentId, studentName, onClose, onSave }: EditReclamationModalProps) {
  const staffNames = getTeachersSnapshot()
    .map((t) => teacherName(t))
    .sort((a, b) => a.localeCompare(b))
  const identity = getStudentIdentitySnapshot(studentId)
  const parentSuggestions = [
    `${identity.parent1Prenom} ${identity.parent1Nom}`.trim(),
    `${identity.parent2Prenom} ${identity.parent2Nom}`.trim(),
  ].filter(Boolean)

  const enseignantIsStaff = staffNames.includes(reclamation.enseignant)
  const [type, setType] = useState(RECLAMATION_CATEGORIES.includes(reclamation.type) ? reclamation.type : 'Autre')
  const [objet, setObjet] = useState(cleanReclamationText(reclamation.objet))
  const [description, setDescription] = useState(cleanReclamationText(reclamation.description))
  const [concernantSelect, setConcernantSelect] = useState(enseignantIsStaff ? reclamation.enseignant : reclamation.enseignant ? AUTRE_SENTINEL : '')
  const [concernantAutre, setConcernantAutre] = useState(enseignantIsStaff ? '' : reclamation.enseignant)
  const [parentNom, setParentNom] = useState(reclamation.parentNom)
  const [date, setDate] = useState(reclamation.date)
  const { data: services = [] } = useReclamationServices()
  const [serviceChoice, setServiceChoice] = useState(reclamation.serviceId ?? '')
  const defaultService = serviceFor({ type }, services)

  const concernant = concernantSelect === AUTRE_SENTINEL ? concernantAutre.trim() : concernantSelect
  const isValid = objet.trim() !== '' && description.trim() !== '' && date !== ''

  const handleSave = () => {
    if (!isValid) return
    const patch: ReclamationPatch = {
      type,
      objet: objet.trim(),
      description: description.trim(),
      enseignant: concernant,
      parentNom: parentNom.trim(),
      date,
      serviceId: serviceChoice || undefined,
    }
    const changed: string[] = []
    if (patch.type !== reclamation.type) changed.push('catégorie')
    if (patch.objet !== reclamation.objet) changed.push('objet')
    if (patch.description !== reclamation.description) changed.push('description')
    if (patch.enseignant !== reclamation.enseignant) changed.push('concerné')
    if (patch.parentNom !== reclamation.parentNom) changed.push('parent')
    if (patch.date !== reclamation.date) changed.push('date')
    if ((patch.serviceId ?? '') !== (reclamation.serviceId ?? '')) changed.push('service')
    if (changed.length === 0) {
      onClose()
      return
    }
    onSave(patch, `Modifié : ${changed.join(', ')}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Pencil className="h-5 w-5 text-indigo-500" />
              Modifier la réclamation
            </h2>
            {studentName && <p className="mt-0.5 text-sm text-slate-500">{studentName}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Catégorie</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                {RECLAMATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date de réception</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {services.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Service chargé du traitement</label>
              <select value={serviceChoice} onChange={(e) => setServiceChoice(e.target.value)} className={inputClass}>
                <option value="">Selon la catégorie{defaultService ? ` (${defaultService.nom})` : ''}</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Objet</label>
            <input type="text" value={objet} onChange={(e) => setObjet(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Concernant</label>
              <TeacherSearchSelect
                teachers={getTeachersSnapshot()}
                valueBy="name"
                value={concernantSelect}
                onChange={setConcernantSelect}
                extra={{ value: AUTRE_SENTINEL, label: 'Autre / Personnel non-enseignant...' }}
                placeholder="Non précisé"
              />
              {concernantSelect === AUTRE_SENTINEL && (
                <input
                  type="text"
                  value={concernantAutre}
                  onChange={(e) => setConcernantAutre(e.target.value)}
                  placeholder="ex : Administration, Personnel cantine..."
                  className={`mt-2 ${inputClass}`}
                />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Parent réclamant</label>
              <input type="text" list="parents-suggestions" value={parentNom} onChange={(e) => setParentNom(e.target.value)} className={inputClass} />
              <datalist id="parents-suggestions">
                {parentSuggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
