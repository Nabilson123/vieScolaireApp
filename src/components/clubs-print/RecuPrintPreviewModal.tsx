import { useMemo } from 'react'
import { useClubsFinance } from '../../hooks/useClubsFinance'
import { recuDuReglement } from '../../utils/clubsContexte'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'
import PrintableRecu from './PrintableRecu'

/** Aperçu avant impression du reçu d'un règlement (réservé au droit paiements : il lit les règlements et leur répartition). */
export default function RecuPrintPreviewModal({ reglementId, onClose }: { reglementId: string; onClose: () => void }) {
  const { reglements, imputations, echeances, inscriptions, clubs, eleves } = useClubsFinance()
  const reglement = reglements.find((r) => r.id === reglementId)
  // Les données sont relues à chaque changement des listes chargées (le reçu d'un règlement qui vient d'être enregistré apparaît dès le rechargement).
  const recu = useMemo(() => (reglement ? recuDuReglement(reglement) : null), [reglement, imputations, echeances, inscriptions, clubs, eleves, reglements])

  if (!reglement || !recu) {
    return (
      <PrintPreviewShell subtitle="Reçu de paiement" printLabel="Imprimer / Télécharger" onClose={onClose} fileName="Recu">
        <div className="p-10 text-center text-sm text-slate-500">Chargement du reçu…</div>
      </PrintPreviewShell>
    )
  }
  return (
    <PrintPreviewShell subtitle={`Reçu ${reglement.numero} — ${reglement.familleLibelle}`} printLabel="Imprimer / Télécharger" onClose={onClose} fileName={`Recu_${reglement.numero}_${sanitizeFileName(reglement.familleLibelle)}_${todayFileStamp()}`}>
      <PrintableRecu recu={recu} />
    </PrintPreviewShell>
  )
}
