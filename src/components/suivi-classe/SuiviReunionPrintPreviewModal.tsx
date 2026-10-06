import { useState } from 'react'
import PrintableCompteRenduReunion from './PrintableCompteRenduReunion'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'
import type { SuiviProf } from '../../data/suiviProfs'
import type { SuiviCompteRendu } from '../../data/suiviCompteRendu'
import type { SuiviClasseAction } from '../../data/suiviClasseActions'
import type { LogicalGroup } from '../../utils/suiviClasseGroups'
import type { RiskStudent, OpenReclamation } from '../../utils/suiviClasseRisqueAggregation'

interface SuiviReunionPrintPreviewModalProps {
  group: LogicalGroup
  suivi: SuiviProf
  compteRendu: SuiviCompteRendu
  riskStudents: RiskStudent[]
  reclamations: OpenReclamation[]
  actions?: SuiviClasseAction[]
  onClose: () => void
}

export default function SuiviReunionPrintPreviewModal({ group, suivi, compteRendu, riskStudents, reclamations, actions, onClose }: SuiviReunionPrintPreviewModalProps) {
  const [blank, setBlank] = useState(false)

  return (
    <PrintPreviewShell
      subtitle={`Réunion de suivi de classe — ${group.label}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(`Compte_Rendu_Reunion_${group.key}_${todayFileStamp()}`)}
      extraHeaderActions={
        <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white">
          <input type="checkbox" checked={blank} onChange={(e) => setBlank(e.target.checked)} className="h-3.5 w-3.5" />
          Version vierge
        </label>
      }
    >
      <PrintableCompteRenduReunion group={group} suivi={suivi} compteRendu={compteRendu} riskStudents={riskStudents} reclamations={reclamations} actions={actions} blank={blank} />
    </PrintPreviewShell>
  )
}
