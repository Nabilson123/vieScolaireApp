import { useMemo, useState } from 'react'
import { sortiesDuJourDeLEcole } from '../../utils/soutienContexte'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'
import PrintPreviewShell from '../print/PrintPreviewShell'
import PrintableSortiesDuJour from './PrintableSortiesDuJour'

/** Aperçu de la feuille « Sorties du soir » ; la date se change depuis l'en-tête de l'aperçu. */
export default function SortiesDuJourPrintPreviewModal({ initialDate, onClose }: { initialDate?: string; onClose: () => void }) {
  const [date, setDate] = useState(initialDate ?? aujourdhuiLocalISO())
  const data = useMemo(() => sortiesDuJourDeLEcole(date), [date])

  return (
    <PrintPreviewShell
      subtitle={`Sorties du soir — ${date.split('-').reverse().join('/')}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Sorties_du_soir_${date}`}
      extraHeaderActions={
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Jour de la feuille"
          className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-white"
        />
      }
    >
      {/* Remonter la feuille à chaque changement de jour : sa pagination se recalcule sur les nouveaux blocs. */}
      <PrintableSortiesDuJour key={date} data={data} />
    </PrintPreviewShell>
  )
}
