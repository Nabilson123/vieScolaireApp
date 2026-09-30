import type { TeacherAbsenceDetail } from '../../utils/replacementAggregation'
import type { DisciplineIncident, InfirmerieAccidentRow, StudentAbsenceRow } from '../../utils/liveCockpitAggregation'
import PrintableCockpitReport from './PrintableCockpitReport'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface CockpitPrintPreviewModalProps {
  periodLabel: string
  periodStart: string
  periodEnd: string
  absentTeachers: TeacherAbsenceDetail[]
  absentStudents: StudentAbsenceRow[]
  incidents: DisciplineIncident[]
  infirmerieAccidents: InfirmerieAccidentRow[]
  onClose: () => void
}

export default function CockpitPrintPreviewModal({
  periodLabel,
  periodStart,
  periodEnd,
  absentTeachers,
  absentStudents,
  incidents,
  infirmerieAccidents,
  onClose,
}: CockpitPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Cockpit Opérationnel (${periodLabel})`}
      onClose={onClose}
      fileName={`Cockpit_Operationnel_${sanitizeFileName(periodLabel)}_${todayFileStamp()}`}
    >
      <PrintableCockpitReport
        periodLabel={periodLabel}
        periodStart={periodStart}
        periodEnd={periodEnd}
        absentTeachers={absentTeachers}
        absentStudents={absentStudents}
        incidents={incidents}
        infirmerieAccidents={infirmerieAccidents}
      />
    </PrintPreviewShell>
  )
}
