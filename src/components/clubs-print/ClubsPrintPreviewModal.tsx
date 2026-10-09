import { libelleClub } from '../../data/clubs'
import type { FeuilleClub } from '../../utils/clubsContexte'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'
import PrintableListeInscrits from './PrintableListeInscrits'
import PrintablePresenceSeance from './PrintablePresenceSeance'

export type DocumentClub = { type: 'liste'; feuilles: FeuilleClub[] } | { type: 'presence'; feuille: FeuilleClub; dates: string[]; portee: string }

/** Aperçu avant impression des documents des clubs : liste d'inscrits (un ou plusieurs clubs) ou feuilles de présence d'un club. */
export default function ClubsPrintPreviewModal({ document, onClose }: { document: DocumentClub; onClose: () => void }) {
  if (document.type === 'liste') {
    const n = document.feuilles.length
    const nom = n === 1 ? libelleClub(document.feuilles[0].club) : `${n}_clubs`
    return (
      <PrintPreviewShell
        subtitle={n === 1 ? `Liste des inscrits — ${libelleClub(document.feuilles[0].club)}` : `Liste des inscrits — ${n} clubs`}
        printLabel="Imprimer / Télécharger"
        onClose={onClose}
        fileName={`Inscrits_${sanitizeFileName(nom)}_${todayFileStamp()}`}
      >
        <PrintableListeInscrits feuilles={document.feuilles} />
      </PrintPreviewShell>
    )
  }
  const s = document.dates.length
  return (
    <PrintPreviewShell
      subtitle={`Feuille de présence — ${libelleClub(document.feuille.club)} (${document.portee}, ${s} séance${s > 1 ? 's' : ''})`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Presence_${sanitizeFileName(libelleClub(document.feuille.club))}_${todayFileStamp()}`}
    >
      <PrintablePresenceSeance feuille={document.feuille} dates={document.dates} />
    </PrintPreviewShell>
  )
}
