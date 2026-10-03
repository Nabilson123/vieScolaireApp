import { useState } from 'react'
import { CalendarClock, PlusCircle } from 'lucide-react'
import type { RendezVousRecord, CompteRenduRDV } from '../../data/studentDetails'
import PlanifierRdvModal, { rdvFieldsFromPayload, type PlanifierRdvPayload } from '../PlanifierRdvModal'
import PartagerRdvModal from '../PartagerRdvModal'
import RedigerCompteRenduModal from '../RedigerCompteRenduModal'
import RdvCard from '../RdvCard'
import CompteRenduRdvPrintPreviewModal from '../rdv-print/CompteRenduRdvPrintPreviewModal'
import { getStudentsSnapshot } from '../../services/studentsService'
import { buildRdvMessage } from '../../utils/whatsapp'

interface RendezVousTabProps {
  studentId: string
  rendezVous: RendezVousRecord[]
  onChange: (list: RendezVousRecord[]) => void
}

export default function RendezVousTab({ studentId, rendezVous, onChange }: RendezVousTabProps) {
  const [showPlanifier, setShowPlanifier] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [crIndex, setCrIndex] = useState<number | null>(null)
  const [crPrintIndex, setCrPrintIndex] = useState<number | null>(null)
  const [share, setShare] = useState<{ message: string; justCreated: boolean } | null>(null)
  const student = getStudentsSnapshot().find((s) => s.id === studentId)

  const shareMessageFor = (record: RendezVousRecord) => buildRdvMessage({ studentName: student?.name ?? '', classe: student?.classe ?? '', record })

  const updateAt = (idx: number, updater: (r: RendezVousRecord) => RendezVousRecord) => {
    onChange(rendezVous.map((r, i) => (i === idx ? updater(r) : r)))
  }

  const handleCreate = (payload: PlanifierRdvPayload) => {
    const record: RendezVousRecord = { ...rdvFieldsFromPayload(payload), statut: 'Planifié' }
    onChange([record, ...rendezVous])
    setShare({ message: shareMessageFor(record), justCreated: true })
    setShowPlanifier(false)
  }

  const handleEditSubmit = (payload: PlanifierRdvPayload) => {
    if (editingIndex === null) return
    updateAt(editingIndex, (r) => ({ ...r, ...rdvFieldsFromPayload(payload) }))
    setEditingIndex(null)
  }

  const handleCancel = (idx: number) => {
    updateAt(idx, (r) => ({ ...r, statut: 'Annulé' }))
  }

  const handleDelete = (idx: number) => {
    onChange(rendezVous.filter((_, i) => i !== idx))
  }

  const handleCompteRenduSubmit = (compteRendu: CompteRenduRDV) => {
    if (crIndex === null) return
    updateAt(crIndex, (r) => ({ ...r, statut: 'Réalisé', compteRendu }))
    setCrIndex(null)
  }

  const editingRecord = editingIndex !== null ? rendezVous[editingIndex] : null
  const crRecord = crIndex !== null ? rendezVous[crIndex] : null
  const crPrintRecord = crPrintIndex !== null ? rendezVous[crPrintIndex] : null

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-800">Suivi des Rendez-vous avec les Parents</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowPlanifier(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Planifier
        </button>
      </div>

      {rendezVous.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun rendez-vous enregistré.</p>
      ) : (
        <div className="space-y-3">
          {rendezVous.map((r, idx) => (
            <RdvCard
              key={idx}
              record={r}
              onEdit={() => setEditingIndex(idx)}
              onCancel={() => handleCancel(idx)}
              onDelete={() => handleDelete(idx)}
              onRedigerCR={() => setCrIndex(idx)}
              onDownloadCR={() => setCrPrintIndex(idx)}
              onShare={() => setShare({ message: shareMessageFor(r), justCreated: false })}
            />
          ))}
        </div>
      )}

      {showPlanifier && (
        <PlanifierRdvModal onClose={() => setShowPlanifier(false)} onSubmit={handleCreate} fixedStudentId={studentId} />
      )}

      {editingRecord && (
        <PlanifierRdvModal
          onClose={() => setEditingIndex(null)}
          onSubmit={handleEditSubmit}
          fixedStudentId={studentId}
          initial={{
            studentId,
            date: editingRecord.date,
            heure: editingRecord.heure,
            duree: editingRecord.duree,
            mode: editingRecord.mode,
            lieu: editingRecord.lieu,
            motif: editingRecord.motif,
            notesParents: editingRecord.notesParents ?? '',
            enseignants: editingRecord.enseignants,
            demandeur: editingRecord.demandeur,
            animateur: editingRecord.animateur,
          }}
        />
      )}

      {share && <PartagerRdvModal message={share.message} justCreated={share.justCreated} onClose={() => setShare(null)} />}

      {crRecord && (
        <RedigerCompteRenduModal
          motif={crRecord.motif}
          hasEnseignant={crRecord.enseignants.length > 0}
          initial={crRecord.compteRendu}
          onClose={() => setCrIndex(null)}
          onSubmit={handleCompteRenduSubmit}
        />
      )}

      {crPrintRecord && (
        <CompteRenduRdvPrintPreviewModal
          record={crPrintRecord}
          studentName={student?.name ?? ''}
          classe={student?.classe ?? ''}
          onClose={() => setCrPrintIndex(null)}
        />
      )}
    </div>
  )
}
