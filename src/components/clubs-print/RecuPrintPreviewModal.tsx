import { useMemo, useState } from 'react'
import { useClubsFinance } from '../../hooks/useClubsFinance'
import { recuDuReglement } from '../../utils/clubsContexte'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'
import PrintableRecu from './PrintableRecu'
import PrintableRecuTicket from './PrintableRecuTicket'

type FormatRecu = 'ticket' | 'a4'

const CLE_FORMAT = 'clubsRecuFormat'

/** Dernier format choisi (ticket thermique par défaut) ; le stockage du navigateur peut être indisponible. */
function formatMemorise(): FormatRecu {
  try {
    return localStorage.getItem(CLE_FORMAT) === 'a4' ? 'a4' : 'ticket'
  } catch {
    return 'ticket'
  }
}

/** Aperçu avant impression du reçu d'un règlement (réservé au droit paiements : il lit les règlements et leur répartition). */
export default function RecuPrintPreviewModal({ reglementId, onClose }: { reglementId: string; onClose: () => void }) {
  const { reglements, imputations, echeances, inscriptions, clubs, eleves } = useClubsFinance()
  const reglement = reglements.find((r) => r.id === reglementId)
  const [format, setFormat] = useState<FormatRecu>(formatMemorise)
  // Les données sont relues à chaque changement des listes chargées (le reçu d'un règlement qui vient d'être enregistré apparaît dès le rechargement).
  const recu = useMemo(() => (reglement ? recuDuReglement(reglement) : null), [reglement, imputations, echeances, inscriptions, clubs, eleves, reglements])

  const choisir = (f: FormatRecu) => {
    setFormat(f)
    try {
      localStorage.setItem(CLE_FORMAT, f)
    } catch {
      // Sans stockage, le choix ne vaut que pour cette fenêtre.
    }
  }

  const choixFormat = (
    <div className="inline-flex items-center rounded-lg bg-white/10 p-0.5" role="group" aria-label="Format d'impression">
      {(['ticket', 'a4'] as const).map((f) => (
        <button key={f} type="button" onClick={() => choisir(f)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${format === f ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}`}>
          {f === 'ticket' ? 'Ticket 80 mm' : 'A4'}
        </button>
      ))}
    </div>
  )

  if (!reglement || !recu) {
    return (
      <PrintPreviewShell subtitle="Reçu de paiement" printLabel="Imprimer / Télécharger" onClose={onClose} fileName="Recu">
        <div className="p-10 text-center text-sm text-slate-500">Chargement du reçu…</div>
      </PrintPreviewShell>
    )
  }
  return (
    <PrintPreviewShell
      subtitle={`Reçu ${reglement.numero} — ${reglement.familleLibelle}`}
      printLabel="Imprimer / Télécharger"
      extraHeaderActions={choixFormat}
      onClose={onClose}
      fileName={`Recu_${reglement.numero}_${sanitizeFileName(reglement.familleLibelle)}_${todayFileStamp()}`}
    >
      {format === 'ticket' ? <PrintableRecuTicket recu={recu} /> : <PrintableRecu recu={recu} />}
    </PrintPreviewShell>
  )
}
