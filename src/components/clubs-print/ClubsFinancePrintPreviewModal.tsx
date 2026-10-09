import type { BilanClub, ImpayeFamille } from '../../utils/clubsFinance'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'
import PrintableBilanMensuel from './PrintableBilanMensuel'
import PrintableEtatImpayes from './PrintableEtatImpayes'

export type DocumentFinance =
  | { type: 'impayes'; impayes: ImpayeFamille[]; aujourdhui: string; portee: string }
  | { type: 'bilan'; bilans: BilanClub[]; aujourdhui: string }

/** Aperçu avant impression des états financiers des clubs : état des impayés ou bilan mensuel (réservés au droit paiements). */
export default function ClubsFinancePrintPreviewModal({ document, onClose }: { document: DocumentFinance; onClose: () => void }) {
  if (document.type === 'impayes') {
    return (
      <PrintPreviewShell
        subtitle={`État des impayés — ${document.portee} (${document.impayes.length} famille${document.impayes.length > 1 ? 's' : ''})`}
        printLabel="Imprimer / Télécharger"
        onClose={onClose}
        fileName={`Impayes_clubs_${sanitizeFileName(document.portee)}_${todayFileStamp()}`}
      >
        <PrintableEtatImpayes impayes={document.impayes} aujourdhui={document.aujourdhui} portee={document.portee} />
      </PrintPreviewShell>
    )
  }
  return (
    <PrintPreviewShell subtitle={`Bilan mensuel des clubs (${document.bilans.length} club${document.bilans.length > 1 ? 's' : ''})`} printLabel="Imprimer / Télécharger" onClose={onClose} fileName={`Bilan_clubs_${todayFileStamp()}`}>
      <PrintableBilanMensuel bilans={document.bilans} aujourdhui={document.aujourdhui} />
    </PrintPreviewShell>
  )
}
