import PrintableNoteService from './PrintableNoteService'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'
import type { NoteService } from '../../data/notesService'
import { getProfilesSnapshot } from '../../services/profilesService'

interface NoteServicePrintPreviewModalProps {
  note: NoteService
  onClose: () => void
}

export default function NoteServicePrintPreviewModal({ note, onClose }: NoteServicePrintPreviewModalProps) {
  const signataireProfile = getProfilesSnapshot().find((p) => p.id === note.signataireId)
  const signataire = signataireProfile
    ? { nomComplet: signataireProfile.nomComplet, role: signataireProfile.role, signatureImage: signataireProfile.signatureImage }
    : undefined

  return (
    <PrintPreviewShell
      subtitle={`Note de Service — ${note.reference}`}
      onClose={onClose}
      printLabel="Imprimer / Télécharger"
      fileName={`${sanitizeFileName(note.reference)}_${sanitizeFileName(note.objet || note.type)}_${todayFileStamp()}`}
    >
      <PrintableNoteService note={note} signataire={signataire} />
    </PrintPreviewShell>
  )
}
