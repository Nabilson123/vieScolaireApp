import * as XLSX from 'xlsx'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { cycleOfClasse } from './alertEngine'

export interface TransportImportRow {
  id: string
  summary: string
  status: 'ok' | 'error'
  error?: string
  studentId?: string
  ligne?: string
}

export interface TransportImportResult {
  rows: TransportImportRow[]
}

function normHeader(v: unknown): string {
  return (v ?? '').toString().trim().toLowerCase()
}

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((h) => aliases.includes(h))
}

function isBlankRow(raw: unknown[]): boolean {
  return !raw || raw.every((c) => c === '' || c == null)
}

/**
 * Importe des affectations élève -> ligne depuis un fichier Excel (colonnes "Élève" et "Ligne").
 * Ne crée jamais d'élève : associe uniquement des lignes à des élèves déjà inscrits au transport
 * (identity.transport = true). Respecte la même règle que l'UI : un collégien ne peut être affecté
 * qu'à une ligne faisant le trajet collège cette semaine.
 */
export async function parseTransportImportFile(file: File, lignesCollegeNoms: string[]): Promise<TransportImportResult> {
  const buf = await file.arrayBuffer()
  const workbook = XLSX.read(buf, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  const header = (aoa[0] ?? []).map(normHeader)
  const eleveIdx = findColumn(header, ['eleve', 'élève', 'nom complet', 'nom'])
  const ligneIdx = findColumn(header, ['ligne'])

  const students = getStudentsSnapshot()
  const rows: TransportImportRow[] = []

  aoa.slice(1).forEach((raw, i) => {
    if (isBlankRow(raw)) return
    const id = `ti-${i}`
    const nom = (raw[eleveIdx] ?? '').toString().trim()
    const ligne = (raw[ligneIdx] ?? '').toString().trim().toUpperCase()

    if (!nom) {
      rows.push({ id, summary: `Ligne ${i + 2}`, status: 'error', error: 'Nom élève manquant.' })
      return
    }
    const student = students.find((s) => s.name.toLowerCase() === nom.toLowerCase())
    if (!student) {
      rows.push({ id, summary: nom, status: 'error', error: 'Élève introuvable (vérifiez le nom complet exact).' })
      return
    }
    const identity = getStudentIdentitySnapshot(student.id)
    if (!identity.transport) {
      rows.push({ id, summary: `${nom} (${student.classe})`, status: 'error', error: "Cet élève n'est pas inscrit au transport." })
      return
    }
    if (!['A', 'B', 'C', 'D', 'E'].includes(ligne)) {
      rows.push({ id, summary: `${nom} (${student.classe})`, status: 'error', error: `Ligne « ${ligne || '(vide)'} » invalide (A à E).` })
      return
    }
    const isCollege = cycleOfClasse(student.classe) === 'college'
    if (isCollege && !lignesCollegeNoms.includes(ligne)) {
      rows.push({
        id,
        summary: `${nom} (${student.classe})`,
        status: 'error',
        error: `La ligne ${ligne} ne fait pas le trajet collège cette semaine.`,
      })
      return
    }

    rows.push({ id, summary: `${nom} (${student.classe}) → Ligne ${ligne}`, status: 'ok', studentId: student.id, ligne })
  })

  return { rows }
}
