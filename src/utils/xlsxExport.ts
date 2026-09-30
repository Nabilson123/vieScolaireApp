import * as XLSX from 'xlsx'

export interface XlsxSheet {
  name: string
  headers: string[]
  rows: (string | number)[][]
}

/** Un classeur .xlsx avec un onglet par module — même bibliothèque que excelTemplates.ts/excelImport.ts. */
export function downloadXLSX(filename: string, sheets: XlsxSheet[]): void {
  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  sheets.forEach((sheet) => {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows])
    // Feuille Excel : 31 caractères max, pas de : \ / ? * [ ].
    let safeName = sheet.name.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Feuille'
    let suffix = 2
    while (usedNames.has(safeName)) {
      safeName = `${safeName.slice(0, 28)}_${suffix}`
      suffix += 1
    }
    usedNames.add(safeName)
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  })
  XLSX.writeFile(wb, filename)
}
