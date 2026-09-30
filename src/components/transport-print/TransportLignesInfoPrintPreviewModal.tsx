import PrintableTransportLigneInfoPage from './PrintableTransportLigneInfoPage'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'
import { chunkLigneTrajetsInfo, getLigneColors } from '../../utils/transportRoutePagination'
import type { TransportLigneDocData } from './TransportLignesPrintPreviewModal'

interface TransportLignesInfoPrintPreviewModalProps {
  lignes: TransportLigneDocData[]
  onClose: () => void
}

export default function TransportLignesInfoPrintPreviewModal({ lignes, onClose }: TransportLignesInfoPrintPreviewModalProps) {
  // Numérotation de page globale sur tout le document, comme pour la feuille de route.
  const allPages = lignes.flatMap((ligne) =>
    chunkLigneTrajetsInfo(ligne.trajetsRaw).map((trajets, i) => ({ ligne, trajets, suiteLabel: i > 0 ? '(suite)' : '' }))
  )

  return (
    <PrintPreviewShell
      subtitle="Informations Transport — Toutes les lignes"
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Informations_Transport_Lignes_${todayFileStamp()}`}
    >
      {allPages.map((page, i) => {
        const { color, bgSoft } = getLigneColors(page.ligne.ligneNom)
        return (
          <PrintableTransportLigneInfoPage
            key={i}
            ligneNom={page.ligne.ligneNom}
            color={color}
            bgSoft={bgSoft}
            trajet={page.ligne.trajet}
            chauffeurNom={page.ligne.chauffeurNom}
            chauffeurTel={page.ligne.chauffeurTel}
            aideNom={page.ligne.aideNom}
            aideTel={page.ligne.aideTel}
            heureMatin={page.ligne.heureMatin}
            heureSoirPrimaire={page.ligne.heureSoirPrimaire}
            suiteLabel={page.suiteLabel}
            trajets={page.trajets}
            pageNum={i + 1}
            totalPages={allPages.length}
          />
        )
      })}
    </PrintPreviewShell>
  )
}
