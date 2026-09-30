import PrintableAbsencesBilan, { type BilanPrintRow, type SortiePrintRow } from './PrintableAbsencesBilan'
import type { CycleSummaryRow } from '../../utils/absencesCycleSummary'
import { classeScopeLabel } from '../../utils/absencesScope'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface AbsencesPrintPreviewModalProps {
  classe: string
  date: string
  absMatin: BilanPrintRow[]
  absApresMidi: BilanPrintRow[]
  retMatin: BilanPrintRow[]
  retApresMidi: BilanPrintRow[]
  sorties: SortiePrintRow[]
  cycleSummaries: CycleSummaryRow[]
  heureDebutMatin: string
  heureFinMatin: string
  heureDebutApresMidi: string
  heureFinApresMidi: string
  onClose: () => void
}

export default function AbsencesPrintPreviewModal({
  classe,
  date,
  absMatin,
  absApresMidi,
  retMatin,
  retApresMidi,
  sorties,
  cycleSummaries,
  heureDebutMatin,
  heureFinMatin,
  heureDebutApresMidi,
  heureFinApresMidi,
  onClose,
}: AbsencesPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Bilan Journalier — ${classeScopeLabel(classe)} (${date})`}
      onClose={onClose}
      fileName={`Bilan_Journalier_${sanitizeFileName(classeScopeLabel(classe))}_${date}`}
    >
      {cycleSummaries.map((cycle, index) => {
        // Une page A4 par cycle : chaque tableau de signalements est restreint aux classes de ce
        // cycle, pour que la page reste lisible (au lieu de tout empiler sur une seule page, cf.
        // demande explicite de l'utilisateur).
        const classesDuCycle = new Set(cycle.classes.map((c) => c.classe))
        const inCycle = (r: { classe: string }) => classesDuCycle.has(r.classe)
        return (
          <PrintableAbsencesBilan
            key={cycle.key}
            classe={classe}
            date={date}
            cycle={cycle}
            absMatin={absMatin.filter(inCycle)}
            absApresMidi={absApresMidi.filter(inCycle)}
            retMatin={retMatin.filter(inCycle)}
            retApresMidi={retApresMidi.filter(inCycle)}
            sorties={sorties.filter(inCycle)}
            heureDebutMatin={heureDebutMatin}
            heureFinMatin={heureFinMatin}
            heureDebutApresMidi={heureDebutApresMidi}
            heureFinApresMidi={heureFinApresMidi}
            pageIndex={index}
            pageCount={cycleSummaries.length}
          />
        )
      })}
    </PrintPreviewShell>
  )
}
