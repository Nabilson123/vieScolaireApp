import { useState, lazy, Suspense } from 'react'
import { FileDown, Download, Printer } from 'lucide-react'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { getStudentIdentitySnapshot, useStudentIdentities } from '../services/studentIdentityService'
import { getStudentExtraSnapshot, useStudentExtras } from '../services/studentDetailsService'
import { getTeachersSnapshot, useTeachers } from '../services/teachersService'
import { getTransportLignesSnapshot, useTransportLignes } from '../services/transportLignesService'
import { getChauffeursSnapshot, useChauffeurs } from '../services/chauffeursService'
import { getAidesMaitressesSnapshot, useAidesMaitresses } from '../services/aidesMaitressesService'
import { getServicesCapaciteSnapshot, useServicesCapacite } from '../services/servicesCapaciteService'
import { getClassOptions } from '../data/students'
import { computeSubjectMoyenne } from '../utils/studentAggregation'
import { resolveStudentTransport } from '../utils/transportStudentResolver'
import { supabase } from '../lib/supabaseClient'
import { getViewedYearIdSnapshot } from '../services/viewedYear'
import { downloadXLSX, type XlsxSheet } from '../utils/xlsxExport'
import { todayFileStamp } from '../components/print/printFileName'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import type { StudentExtra } from '../data/studentDetails'
import { buildExportReport, type ExportReportData, type ExportTransportRow, type ExportCirculaireRow } from '../utils/exportGeneraliseAggregation'

const ExportPrintPreviewModal = lazy(() => import('../components/export-print/ExportPrintPreviewModal'))

const MODULES = [
  { key: 'eleves', label: 'Élèves' },
  { key: 'absences', label: 'Absences & Retards' },
  { key: 'notes', label: 'Notes' },
  { key: 'discipline', label: 'Discipline' },
  { key: 'enseignants', label: 'Enseignants' },
  { key: 'transport', label: 'Transport' },
  { key: 'circulaires', label: 'Circulaires' },
] as const

type ModuleKey = (typeof MODULES)[number]['key']

function inPeriod(date: string, start: string, end: string): boolean {
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

async function buildCirculairesSheet(): Promise<XlsxSheet> {
  const yearId = getViewedYearIdSnapshot()
  const headers = ['Titre', 'Cible', 'Publiée le', 'Destinataires', 'Lues', 'Taux']
  const { data: circulaires, error } = await supabase.from('circulaires').select('id, titre, cible_type, cible_niveau, cible_classe, publie_at').eq('annee_scolaire_id', yearId)
  if (error) throw error
  const ids = (circulaires ?? []).map((c) => c.id as string)
  if (ids.length === 0) return { name: 'Circulaires', headers, rows: [] }
  const { data: lectures, error: lecturesError } = await supabase.from('circulaire_lectures').select('circulaire_id, read_at').in('circulaire_id', ids)
  if (lecturesError) throw lecturesError
  const rows = (circulaires ?? []).map((c) => {
    const mine = (lectures ?? []).filter((l) => l.circulaire_id === c.id)
    const lues = mine.filter((l) => !!l.read_at).length
    const cible = c.cible_type === 'etablissement' ? 'Établissement' : c.cible_type === 'niveau' ? `Niveau ${c.cible_niveau}` : c.cible_type === 'classe' ? `Classe ${c.cible_classe}` : 'Élèves sélectionnés'
    const taux = mine.length > 0 ? `${Math.round((lues / mine.length) * 100)}%` : '—'
    return [c.titre as string, cible, new Date(c.publie_at as string).toLocaleDateString('fr-FR'), mine.length, lues, taux]
  })
  return { name: 'Circulaires', headers, rows }
}

export default function ExportGlobal() {
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'exportGeneral').canEdit
  useStudents()
  useStudentIdentities()
  useStudentExtras()
  useTeachers()
  useTransportLignes()
  useChauffeurs()
  useAidesMaitresses()
  useServicesCapacite()

  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set())
  const [classe, setClasse] = useState('Toutes les classes')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)
  const [printReport, setPrintReport] = useState<ExportReportData | null>(null)

  const toggle = (key: ModuleKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const studentsInScope = () => getStudentsSnapshot().filter((s) => classe === 'Toutes les classes' || s.classe === classe)

  const buildSheets = async (): Promise<XlsxSheet[]> => {
    const sheets: XlsxSheet[] = []

    if (selected.has('eleves')) {
      const rows = studentsInScope().map((s) => [s.name, s.classe, s.absencesHeures, s.absencesFois, s.retardsMin, s.retardsFois, s.totalHeures, `${s.taux.toFixed(1)}%`])
      sheets.push({ name: 'Élèves', headers: ['Élève', 'Classe', 'Absences', 'Nb. Absences', 'Retards', 'Nb. Retards', 'Total Heures Manquées', 'Taux de Présence'], rows })
    }

    if (selected.has('absences')) {
      const rows: (string | number)[][] = []
      studentsInScope().forEach((s) => {
        getStudentExtraSnapshot(s.id).events.forEach((e) => {
          if (!inPeriod(e.date, dateStart, dateEnd)) return
          rows.push([s.name, s.classe, e.date, e.type === 'ABSENCE' ? 'Absence' : 'Retard', e.duree, e.motif, e.justified ? 'Oui' : 'Non'])
        })
      })
      sheets.push({ name: 'Absences & Retards', headers: ['Élève', 'Classe', 'Date', 'Type', 'Durée', 'Motif', 'Justifié'], rows })
    }

    if (selected.has('notes')) {
      const rows: (string | number)[][] = []
      studentsInScope().forEach((s) => {
        getStudentExtraSnapshot(s.id).notes.forEach((n) => {
          const moyenne = computeSubjectMoyenne(n)
          rows.push([s.name, s.classe, n.subject, n.coef, moyenne !== null ? moyenne.toFixed(2) : '—', n.classeAverage.toFixed(2)])
        })
      })
      sheets.push({ name: 'Notes', headers: ['Élève', 'Classe', 'Matière', 'Coefficient', 'Moyenne élève', 'Moyenne classe'], rows })
    }

    if (selected.has('discipline')) {
      const rows: (string | number)[][] = []
      studentsInScope().forEach((s) => {
        getStudentExtraSnapshot(s.id).discipline.forEach((d) => {
          if (!inPeriod(d.date, dateStart, dateEnd)) return
          rows.push([s.name, s.classe, d.date, d.title, d.points, d.sanction ?? '', d.author])
        })
      })
      sheets.push({ name: 'Discipline', headers: ['Élève', 'Classe', 'Date', 'Titre', 'Points', 'Sanction', 'Auteur'], rows })
    }

    if (selected.has('enseignants')) {
      const rows = getTeachersSnapshot().map((t) => [t.prenom, t.nom, t.matricule, t.statut, t.matieres.join(', '), t.classes.join(', '), t.telephoneMobile, t.email])
      sheets.push({ name: 'Enseignants', headers: ['Prénom', 'Nom', 'Matricule', 'Statut', 'Matières', 'Classes', 'Téléphone', 'Email'], rows })
    }

    if (selected.has('transport')) {
      const lignes = getTransportLignesSnapshot()
      const chauffeurs = getChauffeursSnapshot()
      const aides = getAidesMaitressesSnapshot()
      const capacite = getServicesCapaciteSnapshot() ?? undefined
      const rows: (string | number)[][] = []
      studentsInScope().forEach((s) => {
        const identity = getStudentIdentitySnapshot(s.id)
        if (!identity.transport) return
        const info = resolveStudentTransport(s, identity, lignes, chauffeurs, aides, capacite)
        rows.push([
          s.name,
          s.classe,
          info.ligneMatinNom ?? '—',
          info.chauffeurMatin ? info.chauffeurMatin.nom : '—',
          info.ligneSoirNom ?? '—',
          info.soirDepart ?? '—',
        ])
      })
      sheets.push({ name: 'Transport', headers: ['Élève', 'Classe', 'Ligne matin', 'Chauffeur matin', 'Ligne soir', 'Sortie soir'], rows })
    }

    if (selected.has('circulaires')) {
      sheets.push(await buildCirculairesSheet())
    }

    return sheets
  }

  const handleExportXlsx = async () => {
    setBusy('xlsx')
    try {
      const sheets = await buildSheets()
      downloadXLSX(`export-generalise_${todayFileStamp()}.xlsx`, sheets)
    } finally {
      setBusy(null)
    }
  }

  const handleExportPdf = async () => {
    setBusy('pdf')
    try {
      const students = studentsInScope()
      const extrasById: Record<string, StudentExtra> = {}
      students.forEach((s) => {
        extrasById[s.id] = getStudentExtraSnapshot(s.id)
      })

      const teachers = selected.has('enseignants') ? getTeachersSnapshot() : []

      let transportRows: ExportTransportRow[] = []
      if (selected.has('transport')) {
        const lignes = getTransportLignesSnapshot()
        const chauffeurs = getChauffeursSnapshot()
        const aides = getAidesMaitressesSnapshot()
        const capacite = getServicesCapaciteSnapshot() ?? undefined
        transportRows = students
          .map((s) => {
            const identity = getStudentIdentitySnapshot(s.id)
            if (!identity.transport) return null
            const info = resolveStudentTransport(s, identity, lignes, chauffeurs, aides, capacite)
            return {
              nom: s.name,
              classe: s.classe,
              ligneMatin: info.ligneMatinNom ?? '—',
              chauffeurMatin: info.chauffeurMatin ? info.chauffeurMatin.nom : '—',
              ligneSoir: info.ligneSoirNom ?? '—',
              sortie: info.soirDepart ?? '—',
            }
          })
          .filter((r): r is ExportTransportRow => r !== null)
      }

      let circulaireRows: ExportCirculaireRow[] = []
      if (selected.has('circulaires')) {
        const sheet = await buildCirculairesSheet()
        circulaireRows = sheet.rows.map((r) => ({
          titre: String(r[0]),
          cible: String(r[1]),
          publieLe: String(r[2]),
          destinataires: Number(r[3]),
          lues: Number(r[4]),
          taux: String(r[5]),
        }))
      }

      const report = buildExportReport({
        students,
        extrasById,
        teachers,
        transportRows,
        circulaireRows,
        selectedModules: selected,
        dateStart,
        dateEnd,
      })
      setPrintReport(report)
    } finally {
      setBusy(null)
    }
  }

  const filterSubtitle = `${classe}${dateStart || dateEnd ? ` · ${dateStart || '…'} → ${dateEnd || '…'}` : ''}`

  return (
    <div className="mx-auto max-w-[900px] p-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Export Généralisé
          <FileDown className="h-6 w-6 text-slate-800" />
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Sélectionnez un ou plusieurs modules à exporter, avec les mêmes filtres classe/période — un seul fichier Excel (un onglet par module), ou un rapport PDF.
        </p>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">Modules à exporter</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MODULES.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selected.has(m.key)} onChange={() => toggle(m.key)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">Filtres (appliqués aux modules concernés)</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Classe</label>
            <select value={classe} onChange={(e) => setClasse(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
              <option>Toutes les classes</option>
              {realClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Période — Du</label>
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Au</label>
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExportXlsx}
          disabled={!canEdit || selected.size === 0 || busy !== null}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {busy === 'xlsx' ? 'Génération...' : `Exporter en Excel (${selected.size})`}
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={!canEdit || selected.size === 0 || busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          {busy === 'pdf' ? 'Génération...' : 'Rapport PDF'}
        </button>
      </div>

      {printReport && (
        <Suspense fallback={null}>
          <ExportPrintPreviewModal report={printReport} subtitle={filterSubtitle} onClose={() => setPrintReport(null)} />
        </Suspense>
      )}
    </div>
  )
}
