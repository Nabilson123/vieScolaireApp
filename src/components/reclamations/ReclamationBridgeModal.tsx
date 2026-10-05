import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardList, X } from 'lucide-react'
import type { ReclamationRecord } from '../../data/studentDetails'
import { teacherName, type Teacher } from '../../data/teachers'
import { getStudentExtraSnapshot, updateStudentRendezVous } from '../../services/studentDetailsService'
import { useAddSuiviClasseAction } from '../../services/suiviClasseActionsService'
import { useAddSuiviProf } from '../../services/suiviProfsService'
import { useAddIncident } from '../../services/helpdeskService'
import { getCurrentActorName } from '../../services/permissions'
import { cleanReclamationText, echeanceParDefaut, formatDateFR } from '../../utils/reclamationsLogic'
import type { LogicalGroup } from '../../utils/suiviClasseGroups'
import PlanifierRdvModal, { rdvFieldsFromPayload } from '../PlanifierRdvModal'
import SuiviProfModal from '../SuiviProfModal'
import IncidentModal from '../helpdesk/IncidentModal'
import { findGroupForClasse, findTeacherFor, type BridgeKind } from './bridges'

interface ReclamationBridgeModalProps {
  kind: BridgeKind
  reclamation: ReclamationRecord
  studentId: string
  studentName: string
  classe: string
  groups: LogicalGroup[]
  teachers: Teacher[]
  /** Appelé une fois l'élément créé, avec une phrase pour la frise chronologique. */
  onDone: (detail: string) => void
  onClose: () => void
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none'

/**
 * « Transformer en… » : ouvre sur place, pré-rempli, le formulaire du module concerné (action de suivi de
 * classe, suivi avec l'enseignant, incident Helpdesk, rendez-vous parent) et appelle la même création que
 * ce module — sans changer de page ni ressaisir les informations.
 */
export default function ReclamationBridgeModal({ kind, reclamation, studentId, studentName, classe, groups, teachers, onDone, onClose }: ReclamationBridgeModalProps) {
  const queryClient = useQueryClient()
  const addSuiviProf = useAddSuiviProf()
  const addIncident = useAddIncident()
  const objet = cleanReclamationText(reclamation.objet)

  if (kind === 'action_classe') {
    const group = findGroupForClasse(groups, classe)
    if (!group) return null
    return <ActionClasseModal group={group} reclamation={reclamation} studentName={studentName} classe={classe} onDone={onDone} onClose={onClose} />
  }

  if (kind === 'suivi_prof') {
    const teacher = findTeacherFor(reclamation.enseignant, teachers)
    if (!teacher) return null
    return (
      <SuiviProfModal
        onClose={onClose}
        prefillPonctuel={{ teacherIds: [teacher.id], motif: `Réclamation parent (${studentName}, ${classe}) — ${objet}` }}
        onSubmit={(dataList) => {
          dataList.forEach((data) => addSuiviProf.mutate(data))
          onDone(`Suivi avec ${teacherName(teacher)} le ${formatDateFR(dataList[0]?.date ?? '')}`)
        }}
      />
    )
  }

  if (kind === 'incident') {
    return (
      <IncidentModal
        onClose={onClose}
        initial={{
          lieu: `Classe ${classe}`,
          description: `Signalé par un parent (réclamation du ${formatDateFR(reclamation.date)}, ${studentName}) : ${cleanReclamationText(reclamation.description)}`,
        }}
        onSubmit={(data) => {
          addIncident.mutate(data)
          onDone(`Incident Helpdesk : ${data.titre}`)
        }}
      />
    )
  }

  return (
    <PlanifierRdvModal
      fixedStudentId={studentId}
      prefillMotif={objet}
      onClose={onClose}
      onSubmit={async (payload) => {
        const record = { ...rdvFieldsFromPayload(payload), statut: 'Planifié' as const }
        await updateStudentRendezVous(studentId, [record, ...getStudentExtraSnapshot(studentId).rendezVous])
        await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
        onDone(`Rendez-vous parent le ${formatDateFR(payload.date)} à ${payload.heure}`)
      }}
    />
  )
}

function ActionClasseModal({
  group,
  reclamation,
  studentName,
  classe,
  onDone,
  onClose,
}: {
  group: LogicalGroup
  reclamation: ReclamationRecord
  studentName: string
  classe: string
  onDone: (detail: string) => void
  onClose: () => void
}) {
  const addAction = useAddSuiviClasseAction()
  const actor = getCurrentActorName()
  const owners = Array.from(new Set([...group.teachers.map(teacherName), actor].filter(Boolean)))
  const [texte, setTexte] = useState(`Réclamation de ${studentName} (${classe}) — ${cleanReclamationText(reclamation.objet)}`)
  const [ownerName, setOwnerName] = useState(reclamation.responsable && owners.includes(reclamation.responsable) ? reclamation.responsable : actor || owners[0] || '')
  const [echeance, setEcheance] = useState(reclamation.echeance ?? echeanceParDefaut(reclamation))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!texte.trim() || !ownerName) return
    setSaving(true)
    try {
      await addAction.mutateAsync({ niveau: group.key, texte: texte.trim(), ownerName, echeance: echeance || undefined })
      onDone(`Action de suivi de classe (${group.key}) : ${texte.trim()}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ClipboardList className="h-5 w-5 text-indigo-500" />
            Action de suivi de classe — {group.label}
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-xs text-slate-500">L'action apparaîtra dans l'onglet Actions du suivi de classe et dans la réunion hebdomadaire.</p>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Action à mener</label>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Responsable</label>
              <select value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass}>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Échéance</label>
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!texte.trim() || !ownerName || saving}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Création...' : "Créer l'action"}
          </button>
        </div>
      </div>
    </div>
  )
}
