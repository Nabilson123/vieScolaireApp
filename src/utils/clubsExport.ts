import * as XLSX from 'xlsx'
import type { LigneJournal } from './clubsContexte'

/** Journal des encaissements des clubs en tableur : une ligne par règlement (annulés compris, marqués), avec le détail et le total encaissé. */
export function exportJournalEncaissementsExcel(lignes: LigneJournal[]): void {
  const wb = XLSX.utils.book_new()
  const valides = lignes.filter((l) => l.statut === 'Valide')
  const rows: (string | number)[][] = [
    ['N° de reçu', 'Date', 'Famille', 'Mode', 'Référence', 'Montant (DH)', 'Statut', "Motif d'annulation", 'Détail'],
    ...lignes.map((l) => [l.numero, l.dateReglement, l.famille, l.mode, l.reference, l.montantDh, l.statut, l.motifAnnulation, l.detail]),
    [],
    ['', '', '', '', 'Total encaissé (règlements valides)', Math.round(valides.reduce((n, l) => n + l.montantDh * 100, 0)) / 100, `${valides.length} règlement${valides.length > 1 ? 's' : ''}`],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Encaissements')
  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `journal-encaissements-clubs-${today}.xlsx`)
}
