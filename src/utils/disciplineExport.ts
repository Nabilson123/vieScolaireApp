import * as XLSX from 'xlsx'

interface JournalRow {
  date: string
  studentName: string
  classe: string
  points: number
  title: string
  description: string
  author: string
}

export function exportDisciplineJournalExcel(entries: JournalRow[]): void {
  const wb = XLSX.utils.book_new()
  const rows: (string | number)[][] = [
    ['Date', 'Élève', 'Classe', 'Points', 'Fait / Catégorie', 'Commentaire', 'Par'],
    ...entries.map((e) => [e.date, e.studentName, e.classe, e.points, e.title, e.description, e.author]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 40 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Journal Disciplinaire')
  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `journal-disciplinaire-${today}.xlsx`)
}
