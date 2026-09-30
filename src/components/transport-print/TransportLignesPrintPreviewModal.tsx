import PrintableTransportLignePage from './PrintableTransportLignePage'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'
import { chunkLigneTrajets, getLigneColors, type TransportTrajetInput } from '../../utils/transportRoutePagination'

export interface TransportLigneDocData {
  ligneNom: string
  trajet: string
  chauffeurNom: string | null
  chauffeurTel: string | null
  aideNom: string | null
  aideTel: string | null
  heureMatin: string
  heureSoirPrimaire: string
  trajetsRaw: TransportTrajetInput[]
}

interface TransportLignesPrintPreviewModalProps {
  lignes: TransportLigneDocData[]
  onClose: () => void
}

export default function TransportLignesPrintPreviewModal({ lignes, onClose }: TransportLignesPrintPreviewModalProps) {
  // La numérotation de page est globale sur tout le document (toutes les lignes, y compris les
  // pages de suite), pas remise à zéro par ligne — d'où le calcul des chunks de toutes les lignes
  // avant d'assigner pageNum/totalPages, plutôt que de le faire ligne par ligne.
  const allPages = lignes.flatMap((ligne) =>
    chunkLigneTrajets(ligne.trajetsRaw).map((trajets, i) => ({ ligne, trajets, suiteLabel: i > 0 ? '(suite)' : '' }))
  )

  return (
    <PrintPreviewShell
      subtitle="Feuilles de route — Toutes les lignes"
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Feuilles_de_route_Transport_${todayFileStamp()}`}
    >
      {allPages.map((page, i) => {
        const { color, bgSoft } = getLigneColors(page.ligne.ligneNom)
        return (
          <PrintableTransportLignePage
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
