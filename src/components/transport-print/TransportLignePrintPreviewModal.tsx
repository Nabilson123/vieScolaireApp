import PrintableTransportLignePage from './PrintableTransportLignePage'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'
import { chunkLigneTrajets, getLigneColors, type TransportTrajetInput } from '../../utils/transportRoutePagination'

interface TransportLignePrintPreviewModalProps {
  ligneNom: string
  trajet: string
  chauffeurNom: string | null
  chauffeurTel: string | null
  aideNom: string | null
  aideTel: string | null
  heureMatin: string
  heureSoirPrimaire: string
  trajetsRaw: TransportTrajetInput[]
  onClose: () => void
}

export default function TransportLignePrintPreviewModal({
  ligneNom,
  trajet,
  chauffeurNom,
  chauffeurTel,
  aideNom,
  aideTel,
  heureMatin,
  heureSoirPrimaire,
  trajetsRaw,
  onClose,
}: TransportLignePrintPreviewModalProps) {
  const chunks = chunkLigneTrajets(trajetsRaw)
  const { color, bgSoft } = getLigneColors(ligneNom)

  return (
    <PrintPreviewShell
      subtitle={`Feuille de route — Ligne ${ligneNom}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`${sanitizeFileName(`Ligne_${ligneNom}`)}_${todayFileStamp()}`}
    >
      {chunks.map((trajets, i) => (
        <PrintableTransportLignePage
          key={i}
          ligneNom={ligneNom}
          color={color}
          bgSoft={bgSoft}
          trajet={trajet}
          chauffeurNom={chauffeurNom}
          chauffeurTel={chauffeurTel}
          aideNom={aideNom}
          aideTel={aideTel}
          heureMatin={heureMatin}
          heureSoirPrimaire={heureSoirPrimaire}
          suiteLabel={i > 0 ? '(suite)' : ''}
          trajets={trajets}
          pageNum={i + 1}
          totalPages={chunks.length}
        />
      ))}
    </PrintPreviewShell>
  )
}
