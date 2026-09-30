/** Nettoie une chaîne pour en faire un nom de fichier valide sur Windows/macOS/Linux. */
export function sanitizeFileName(raw: string): string {
  return raw
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Date du jour au format AAAA-MM-JJ, pour suffixer les noms de fichiers PDF. */
export function todayFileStamp(): string {
  return new Date().toLocaleDateString('sv-SE')
}

/**
 * Imprime la page en suggérant `fileName` comme nom de fichier PDF : la plupart des navigateurs
 * pré-remplissent le nom de fichier de "Enregistrer en PDF" avec document.title au moment de
 * l'impression. Le titre d'origine est restauré une fois la boîte de dialogue fermée.
 */
export function printWithFileName(fileName: string): void {
  const previousTitle = document.title
  document.title = sanitizeFileName(fileName)
  const restore = () => {
    document.title = previousTitle
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}
