import * as XLSX from 'xlsx'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { getAbsencesConfigSnapshot } from '../services/absencesConfigService'
import { getTeachersSnapshot } from '../services/teachersService'
import { fetchStudents } from '../services/studentsService'
import { fetchStudentIdentities } from '../services/studentIdentityService'
import { getViewedYearIdSnapshot } from '../services/viewedYear'

const SCHEDULE_SLOTS = ['08:30-10:30', '10:45-12:45', '14:00-16:00', '16:15-17:45']

function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename)
}

function sheetFromRows(rows: (string | number)[][], colWidths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = colWidths.map((wch) => ({ wch }))
  return ws
}

const STUDENTS_HEADER = [
  'Nom',
  'Prenom',
  'Nom (ar)',
  'Prenom (ar)',
  'Code massar',
  'Niveau',
  'Classe',
  'Genre',
  'Cantine',
  'Garde Apres midi',
  'Garde matin',
  'Garde midi',
  'Transport',
  'Date de naissance',
  'Lieu de naissance',
  "Date d'entree",
  'Nom parent 1',
  'Prenom parent 1',
  'Tel parent 1',
  'Email parent 1',
  'Nom parent 2',
  'Prenom parent 2',
  'Tel parent 2',
  'Email parent 2',
]

const STUDENTS_COL_WIDTHS = [14, 14, 14, 14, 14, 10, 12, 10, 10, 16, 12, 12, 12, 16, 16, 14, 14, 14, 18, 22, 14, 14, 18, 22]

export function downloadStudentsTemplate(): void {
  const wb = XLSX.utils.book_new()
  const ws = sheetFromRows(
    [
      STUDENTS_HEADER,
      [
        'ALAMI',
        'Anas',
        'علمي',
        'أنس',
        'F241000001',
        '3APIC',
        '3APIC-A',
        'Garcon',
        'Oui',
        'Non',
        'Non',
        'Non',
        'Non',
        '15/03/2013',
        'El Jadida',
        '01/09/2024',
        'Alami',
        'Karim',
        '+212 661-000000',
        'karim.alami@example.com',
        'Bennani',
        'Salma',
        '+212 662-000000',
        'salma.bennani@example.com',
      ],
    ],
    STUDENTS_COL_WIDTHS
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Élèves')
  downloadWorkbook(wb, 'modele-eleves.xlsx')
}

function niveauFromClasseExport(classe: string): string {
  return classe.replace(/-[A-Z]$/, '')
}

function ouiNon(v: boolean | undefined): string {
  return v ? 'Oui' : 'Non'
}

/**
 * Export de la liste des élèves de l'année consultée, avec exactement les colonnes du modèle
 * d'import — pour corriger une seule colonne (ex. Cantine) sans repartir d'un fichier vierge et
 * perdre le reste de la fiche. Le réimport de ce fichier via « Importer Excel » retrouve chaque
 * élève par Code Massar (ou Nom+Classe) et ne modifie que les cellules réellement renseignées
 * (cf. `blankFields` dans `excelImport.ts`) — les cellules laissées vides gardent la valeur déjà
 * enregistrée, aucune perte de données sur un réimport partiel.
 */
export async function downloadStudentsExport(): Promise<void> {
  const yearId = getViewedYearIdSnapshot()
  const [students, identities] = await Promise.all([fetchStudents(yearId), fetchStudentIdentities()])

  const rows: (string | number)[][] = students
    .slice()
    .sort((a, b) => a.classe.localeCompare(b.classe) || a.name.localeCompare(b.name))
    .map((s) => {
      const identity = identities[s.id]
      return [
        identity?.nom ?? '',
        identity?.prenom ?? '',
        identity?.nomAr ?? '',
        identity?.prenomAr ?? '',
        identity?.codeMassar ?? '',
        niveauFromClasseExport(s.classe),
        s.classe,
        s.sexe === 'F' ? 'Fille' : 'Garcon',
        ouiNon(identity?.cantine),
        ouiNon(identity?.gardeApresMidi),
        ouiNon(identity?.gardeMatin),
        ouiNon(identity?.gardeMidi),
        ouiNon(identity?.transport),
        identity?.dateNaissance ?? '',
        identity?.lieuNaissance ?? '',
        identity?.dateEntree ?? '',
        identity?.parent1Nom ?? '',
        identity?.parent1Prenom ?? '',
        identity?.parent1Tel ?? '',
        identity?.parent1Email ?? '',
        identity?.parent2Nom ?? '',
        identity?.parent2Prenom ?? '',
        identity?.parent2Tel ?? '',
        identity?.parent2Email ?? '',
      ]
    })

  const wb = XLSX.utils.book_new()
  const ws = sheetFromRows([STUDENTS_HEADER, ...rows], STUDENTS_COL_WIDTHS)
  XLSX.utils.book_append_sheet(wb, ws, 'Élèves')
  const today = new Date().toISOString().slice(0, 10)
  downloadWorkbook(wb, `eleves-export-${today}.xlsx`)
}

export function downloadTeachersTemplate(): void {
  const wb = XLSX.utils.book_new()
  const ws = sheetFromRows(
    [
      ['Nom', 'Prénom', 'Téléphone', 'E-mail', 'Statut', 'Code professeur'],
      ['TAZI', 'Youssef', '+212 611-223344', 'y.tazi@ecole.ma', 'Permanent', '0001'],
    ],
    [16, 16, 18, 26, 14, 16]
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Enseignants')
  downloadWorkbook(wb, 'modele-enseignants.xlsx')
}

export function downloadGardeRepasTemplate(): void {
  const wb = XLSX.utils.book_new()
  const ws = sheetFromRows(
    [
      ['Code massar', 'Nom et prénom'],
      ['F243066635', 'AAGUIDA Ritaj'],
      ['', 'AARRACHI Khawla'],
    ],
    [18, 28]
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Garde Repas')
  downloadWorkbook(wb, 'modele-garde-repas.xlsx')
}

export function downloadAbsencesTemplate(): void {
  const wb = XLSX.utils.book_new()
  const motif = getAbsencesConfigSnapshot().motifs[0] ?? 'Maladie'
  const ws = sheetFromRows(
    [
      ['Type (Élève/Enseignant)', 'Prénom', 'Nom', 'Classe (si Élève)', 'Date (AAAA-MM-JJ)', 'Type (Absence/Retard)', 'Durée (h)', 'Motif', 'Justifié (Oui/Non)'],
      ['Élève', 'Anas', 'Alami', '3APIC-A', '2026-09-15', 'Absence', 2, motif, 'Oui'],
      ['Enseignant', 'Youssef', 'Tazi', '', '2026-09-16', 'Retard', 0.5, motif, 'Non'],
    ],
    [22, 14, 14, 16, 18, 20, 10, 22, 16]
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Absences & Retards')
  downloadWorkbook(wb, 'modele-absences-retards.xlsx')
}

export function downloadScheduleTemplate(): void {
  const wb = XLSX.utils.book_new()
  const header = ['Seances', 'Matieres', 'Séance de', 'Séance au', 'Code chapitres', 'Couleur du background', 'Code professeur', 'Code salle']
  const classe = getActiveClassNamesSnapshot()[0] ?? '3APIC-A'
  const codeProf = getTeachersSnapshot()[0]?.matricule ?? ''
  const exampleByDay: Record<string, [string, string, string][]> = {
    lundi: [
      [SCHEDULE_SLOTS[0], 'MATHS', codeProf],
      [SCHEDULE_SLOTS[1], 'FR', ''],
    ],
    mardi: [[SCHEDULE_SLOTS[0], 'AR', '']],
    mercredi: [[SCHEDULE_SLOTS[0], 'SVT', '']],
    jeudi: [[SCHEDULE_SLOTS[0], 'ANG', '']],
    vendredi: [[SCHEDULE_SLOTS[0], 'EPS', '']],
  }

  const rows: (string | number)[][] = [header]
  Object.entries(exampleByDay).forEach(([day, sessions]) => {
    rows.push([day, '', '', '', '', '', '', ''])
    sessions.forEach(([creneau, matiere, prof]) => {
      rows.push([creneau, matiere, '', '', '', '', prof, ''])
    })
  })

  const ws = sheetFromRows(rows, [14, 12, 12, 12, 14, 20, 16, 12])
  XLSX.utils.book_append_sheet(wb, ws, 'Emploi du temps')
  downloadWorkbook(wb, `emplois_du_temps_${classe.replace(/-[A-Z]$/, '')}_${classe}.xlsx`)
}

export function downloadNotesTemplate(): void {
  const wb = XLSX.utils.book_new()
  const ws = sheetFromRows(
    [
      ['Prénom', 'Nom', 'Classe', 'Matière', 'Type de contrôle', 'Note /20', 'Période', 'Appréciation', 'Date (AAAA-MM-JJ)'],
      ['Anas', 'Alami', '3APIC-A', 'Mathématiques', 'Contrôle 1', 15.5, 'Trimestre 1', 'Bon travail', '2026-10-05'],
    ],
    [14, 14, 14, 20, 18, 10, 14, 24, 18]
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Notes')
  downloadWorkbook(wb, 'modele-notes-controles.xlsx')
}

export function downloadTransportTemplate(): void {
  const wb = XLSX.utils.book_new()
  const ws = sheetFromRows(
    [
      ['Élève', 'Ligne'],
      ['Alami Anas', 'A'],
    ],
    [28, 10]
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Transport')
  downloadWorkbook(wb, 'modele-transport-affectations.xlsx')
}
