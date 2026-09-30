import type { Student } from '../data/students'
import type { StudentExtra } from '../data/studentDetails'
import type { Teacher } from '../data/teachers'
import { NIVEAUX } from '../data/referentiel'
import { moyenneScaleForClasse } from './alertEngine'
import { computeSubjectMoyenne, computeMoyenneGenerale } from './studentAggregation'
import { isWithinPeriod } from './period'

export type ExportModuleKey = 'eleves' | 'absences' | 'notes' | 'discipline' | 'enseignants' | 'transport' | 'circulaires'

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const ALERT = 'oklch(0.5 0.19 25)'
const ALERT_BG = 'oklch(0.96 0.09 25)'
const ZEBRA_A = 'oklch(0.99 0.003 90)'
const ZEBRA_B = 'oklch(0.985 0.003 90)'
const zebra = (i: number) => (i % 2 ? ZEBRA_B : ZEBRA_A)

// Ordre pédagogique (PS → 3APIC) déjà défini une seule fois pour toute l'appli — pas de doublon ici.
function classRank(classe: string): number {
  const niveau = classe.split('-')[0]
  const i = NIVEAUX.indexOf(niveau)
  return (i === -1 ? 99 : i) * 10 + (classe.endsWith('-B') ? 1 : 0)
}
function byClasse<T extends (string | number)[]>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => classRank(String(a[1])) - classRank(String(b[1])) || String(a[0]).localeCompare(String(b[0]), 'fr', { sensitivity: 'base' })
  )
}

// Seuils "critiques" du handoff design — fixes, volontairement indépendants du seuil configurable
// dans Paramètres (celui-ci pilote l'alerte Dashboard ; l'Export Généralisé a sa propre règle,
// marquée "à implémenter exactement" dans le handoff).
const SEUIL_MOYENNE_20 = 12
function seuilMoyenneFor(classe: string): number {
  const bareme = moyenneScaleForClasse(classe) ?? 20
  return (SEUIL_MOYENNE_20 * bareme) / 20
}
function seuilNoteIsoleeFor(classe: string): number {
  return (moyenneScaleForClasse(classe) ?? 20) === 20 ? 8 : 4
}

export interface ExportKpi {
  label: string
  value: string
  detail: string
  color: string
}

export interface ExportSommaireRow {
  num: number
  name: string
  color: string
  soft: string
  count: string
  page: number
}

export interface ExportAlertRow {
  nom: string
  classe: string
  taux: string
  absRet: string
  moy: string
  disc: string
  bg: string
  tauxColor: string
  absColor: string
  moyColor: string
  discColor: string
}

export interface ExportSectionHeader {
  label: string
  align: 'left' | 'center' | 'right'
}

export interface ExportSectionCell {
  v: string
  align: string
  bg: string
  weight: number
  color: string
  wrap: string
  span: string
}

export interface ExportSectionPage {
  sectionNum: number
  sectionName: string
  color: string
  soft: string
  cols: string
  headers: ExportSectionHeader[]
  cells: ExportSectionCell[]
  hasRows: boolean
  emptyMsg: string
  suite: string
  rangeLabel: string
}

export interface ExportReportData {
  kpis: ExportKpi[]
  sommaire: ExportSommaireRow[]
  alertes: ExportAlertRow[]
  showAlertes: boolean
  nbParfait: number
  resteLabel: string
  sectionPages: ExportSectionPage[]
}

interface SectionConfig {
  key: ExportModuleKey
  num: number
  name: string
  color: string
  soft: string
  rowsPerPage: number
  cols: string
  headers: string[]
  aligns: ('left' | 'center' | 'right')[]
  rows: (string | number)[][]
  groupBy?: number
  flag: (row: (string | number)[]) => boolean
  dim?: (row: (string | number)[]) => boolean
  wrap?: string
  emptyMsg?: string
}

export interface ExportTransportRow {
  nom: string
  classe: string
  ligneMatin: string
  chauffeurMatin: string
  ligneSoir: string
  sortie: string
}

export interface ExportCirculaireRow {
  titre: string
  cible: string
  publieLe: string
  destinataires: number
  lues: number
  taux: string
}

export interface ExportBuildInput {
  students: Student[]
  extrasById: Record<string, StudentExtra>
  teachers: Teacher[]
  transportRows: ExportTransportRow[]
  circulaireRows: ExportCirculaireRow[]
  selectedModules: Set<ExportModuleKey>
  dateStart: string
  dateEnd: string
}

function fmtDuree(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h${m ? m : ''}`
}

export function buildExportReport(input: ExportBuildInput): ExportReportData {
  const { students, extrasById, teachers, transportRows, circulaireRows, selectedModules, dateStart, dateEnd } = input
  const has = (k: ExportModuleKey) => selectedModules.has(k)

  // ---------- Sections (une par module coché) ----------
  const sections: SectionConfig[] = []

  if (has('eleves')) {
    sections.push({
      key: 'eleves',
      num: 0,
      name: 'Élèves',
      color: 'oklch(0.5 0.15 264)',
      soft: 'oklch(0.94 0.03 264)',
      rowsPerPage: 46,
      cols: '1fr 70px 74px 40px 78px 40px 86px 74px',
      headers: ['Élève', 'Classe', 'Absences', 'Nb', 'Retards', 'Nb', 'H. manquées', 'Présence'],
      aligns: ['left', 'left', 'center', 'center', 'center', 'center', 'center', 'center'],
      rows: byClasse(
        students.map(
          (s) =>
            [s.name, s.classe, s.absencesHeures, s.absencesFois, s.retardsMin, s.retardsFois, s.totalHeures, `${s.taux.toFixed(1)}%`] as (
              | string
              | number
            )[]
        )
      ),
      flag: (r) => r[7] !== '100.0%',
      groupBy: 1,
    })
  }

  if (has('absences')) {
    const rows: (string | number)[][] = []
    students.forEach((s) => {
      ;(extrasById[s.id]?.events ?? []).forEach((e) => {
        if (!isWithinPeriod(e.date, dateStart, dateEnd)) return
        rows.push([s.name, s.classe, e.date, e.type === 'ABSENCE' ? 'Absence' : 'Retard', e.duree, e.motif || '—', e.justified ? 'Oui' : 'Non'])
      })
    })
    sections.push({
      key: 'absences',
      num: 0,
      name: 'Absences & Retards',
      color: 'oklch(0.6 0.19 25)',
      soft: 'oklch(0.96 0.06 25)',
      rowsPerPage: 44,
      cols: '1fr 78px 92px 74px 76px 84px 60px',
      headers: ['Élève', 'Classe', 'Date', 'Type', 'Durée', 'Motif', 'Justifié'],
      aligns: ['left', 'left', 'center', 'center', 'center', 'left', 'center'],
      rows,
      flag: (r) => r[3] === 'Absence',
    })
  }

  // Notes : tableau croisé — une ligne par élève (pas une par évaluation), une colonne par matière.
  let notesRowsByEleve: { nom: string; classe: string; moyenneGenerale: number | null }[] = []
  if (has('notes')) {
    const matieres: string[] = []
    const coefs: Record<string, number> = {}
    const withNotes = students.filter((s) => (extrasById[s.id]?.notes ?? []).length > 0)
    withNotes.forEach((s) => {
      ;(extrasById[s.id]?.notes ?? []).forEach((n) => {
        if (!matieres.includes(n.subject)) matieres.push(n.subject)
        coefs[n.subject] = n.coef
      })
    })
    const rows = byClasse(
      withNotes.map((s) => {
        const notes = extrasById[s.id]?.notes ?? []
        const bareme = moyenneScaleForClasse(s.classe) ?? 20
        const moyGen = computeMoyenneGenerale(notes)
        notesRowsByEleve.push({ nom: s.name, classe: s.classe, moyenneGenerale: moyGen })
        return [
          s.name,
          s.classe,
          `/${bareme}`,
          ...matieres.map((m) => {
            const row = notes.find((n) => n.subject === m)
            const moy = row ? computeSubjectMoyenne(row) : null
            return moy !== null ? moy.toFixed(2) : '—'
          }),
          moyGen !== null ? moyGen.toFixed(2) : '—',
        ] as (string | number)[]
      })
    )
    sections.push({
      key: 'notes',
      num: 0,
      name: 'Notes',
      color: 'oklch(0.65 0.12 180)',
      soft: 'oklch(0.94 0.03 180)',
      rowsPerPage: 34,
      cols: `1fr 78px 70px ${matieres.map(() => '92px').join(' ')} 104px`,
      headers: ['Élève', 'Classe', 'Barème', ...matieres.map((m) => `${m} (×${coefs[m]})`), 'Moy. générale'],
      aligns: ['left', 'left', 'center', ...matieres.map((): 'center' => 'center'), 'center'],
      rows,
      groupBy: 1,
      flag: (r) => {
        const v = parseFloat(String(r[r.length - 1]))
        return !isNaN(v) && v < seuilMoyenneFor(String(r[1]))
      },
    })
  }

  if (has('discipline')) {
    const rows: (string | number)[][] = []
    students.forEach((s) => {
      ;(extrasById[s.id]?.discipline ?? []).forEach((d) => {
        if (!isWithinPeriod(d.date, dateStart, dateEnd)) return
        rows.push([s.name, s.classe, d.date, d.title, d.points, d.author])
      })
    })
    sections.push({
      key: 'discipline',
      num: 0,
      name: 'Discipline',
      color: 'oklch(0.6 0.1 300)',
      soft: 'oklch(0.94 0.03 300)',
      rowsPerPage: 40,
      cols: '1fr 74px 92px 1.1fr 56px 130px',
      headers: ['Élève', 'Classe', 'Date', 'Titre', 'Points', 'Auteur'],
      aligns: ['left', 'left', 'center', 'left', 'center', 'left'],
      rows,
      flag: () => true,
    })
  }

  if (has('enseignants')) {
    sections.push({
      key: 'enseignants',
      num: 0,
      name: 'Enseignants',
      color: 'oklch(0.55 0.16 150)',
      soft: 'oklch(0.94 0.04 150)',
      rowsPerPage: 30,
      cols: '128px 58px 90px 1fr 1.15fr 98px',
      headers: ['Prénom Nom', 'Matricule', 'Statut', 'Matières', 'Classes', 'Téléphone'],
      aligns: ['left', 'center', 'center', 'left', 'left', 'left'],
      rows: teachers.map((t) => [`${t.prenom} ${t.nom}`, t.matricule, t.statut, t.matieres.join(', '), t.classes.join(', '), t.telephoneMobile]),
      flag: (r) => r[2] === 'Vacataire',
      wrap: 'normal',
    })
  }

  if (has('transport')) {
    sections.push({
      key: 'transport',
      num: 0,
      name: 'Transport',
      color: 'oklch(0.68 0.16 45)',
      soft: 'oklch(0.95 0.05 45)',
      rowsPerPage: 46,
      cols: '1fr 78px 86px 104px 80px 80px',
      headers: ['Élève', 'Classe', 'Ligne matin', 'Chauffeur matin', 'Ligne soir', 'Sortie soir'],
      aligns: ['left', 'left', 'center', 'center', 'center', 'center'],
      rows: byClasse(
        transportRows.map((r) => [r.nom, r.classe, r.ligneMatin, r.chauffeurMatin, r.ligneSoir, r.sortie] as (string | number)[])
      ),
      flag: () => false,
      dim: (r) => r[2] === '—',
      groupBy: 1,
    })
  }

  if (has('circulaires')) {
    sections.push({
      key: 'circulaires',
      num: 0,
      name: 'Circulaires',
      color: 'oklch(0.5 0.01 260)',
      soft: 'oklch(0.95 0.005 264)',
      rowsPerPage: 40,
      cols: '1.4fr 98px 98px 98px 78px 78px',
      headers: ['Titre', 'Cible', 'Publiée le', 'Destinataires', 'Lues', 'Taux'],
      aligns: ['left', 'left', 'center', 'center', 'center', 'center'],
      rows: circulaireRows.map((c) => [c.titre, c.cible, c.publieLe, c.destinataires, c.lues, c.taux]),
      flag: () => false,
      emptyMsg: 'Aucune circulaire publiée sur la période — rien à exporter pour ce module.',
    })
  }

  sections.forEach((s, i) => {
    s.num = i + 1
  })

  // ---------- Pagination par section : coût réel (1/ligne + 1/bandeau de groupe répété) ----------
  const sectionPages: ExportSectionPage[] = []
  sections.forEach((sec) => {
    const headers: ExportSectionHeader[] = sec.headers.map((label, i) => ({ label, align: sec.aligns[i] }))
    const chunks: { rows: (string | number)[][]; from: number }[] = []
    if (sec.groupBy == null) {
      for (let i = 0; i < sec.rows.length; i += sec.rowsPerPage) chunks.push({ rows: sec.rows.slice(i, i + sec.rowsPerPage), from: i })
    } else {
      let current: (string | number)[][] = []
      let from = 0
      let used = 0
      let lastGroup: string | number | null = null
      sec.rows.forEach((r, i) => {
        const g = r[sec.groupBy!]
        const cost = 1 + (g !== lastGroup ? 1 : 0)
        if (current.length && used + cost > sec.rowsPerPage) {
          chunks.push({ rows: current, from })
          current = []
          from = i
          used = 2
          lastGroup = g
        } else {
          used += cost
          lastGroup = g
        }
        current.push(r)
      })
      if (current.length) chunks.push({ rows: current, from })
    }
    if (chunks.length === 0) chunks.push({ rows: [], from: 0 })

    chunks.forEach((chunk, ci) => {
      const cells: ExportSectionCell[] = []
      let lastGroup: string | number | null = null
      chunk.rows.forEach((r, ri) => {
        if (sec.groupBy != null && r[sec.groupBy] !== lastGroup) {
          lastGroup = r[sec.groupBy]
          const n = sec.rows.filter((x) => x[sec.groupBy!] === lastGroup).length
          cells.push({
            v: `${lastGroup} — ${n} élève${n > 1 ? 's' : ''}`,
            span: '1 / -1',
            bg: sec.soft,
            align: 'left',
            weight: 700,
            color: sec.color,
            wrap: 'nowrap',
          })
        }
        const flagged = sec.flag(r)
        const dimmed = sec.dim ? sec.dim(r) : false
        const bg = flagged ? ALERT_BG : zebra(ri)
        r.forEach((v, i) => {
          cells.push({
            v: v === '' || v == null ? '—' : String(v),
            align: sec.aligns[i],
            bg,
            weight: i === 0 ? (dimmed ? 400 : 600) : 400,
            color: dimmed ? 'oklch(0.68 0.01 260)' : flagged && (i === 0 || i >= r.length - 2) ? ALERT : INK,
            wrap: sec.wrap || 'nowrap',
            span: 'auto',
          })
        })
      })
      sectionPages.push({
        sectionNum: sec.num,
        sectionName: sec.name,
        color: sec.color,
        soft: sec.soft,
        cols: sec.cols,
        headers,
        cells,
        hasRows: chunk.rows.length > 0,
        emptyMsg: sec.emptyMsg || 'Aucune donnée pour ce module.',
        suite: ci > 0 ? '(suite)' : '',
        rangeLabel: sec.rows.length ? `${chunk.from + 1}–${chunk.from + chunk.rows.length} sur ${sec.rows.length}` : '',
      })
    })
  })

  // ---------- Sommaire (page cible = position dans le document, page de garde = page 1) ----------
  const sommaire: ExportSommaireRow[] = sections.map((sec) => {
    const firstPageIdx = sectionPages.findIndex((p) => p.sectionNum === sec.num)
    const n = sec.rows.length
    return {
      num: sec.num,
      name: sec.name,
      color: sec.color,
      soft: sec.soft,
      count: n ? `${n} ligne${n > 1 ? 's' : ''}` : 'vide',
      page: firstPageIdx >= 0 ? firstPageIdx + 2 : 1,
    }
  })

  // ---------- Alertes croisées — uniquement les critères dont le module source est coché ----------
  const moyByNom = new Map(notesRowsByEleve.map((r) => [r.nom, r.moyenneGenerale]))
  const noteBasseByNom = new Map<string, string[]>()
  if (has('notes')) {
    students.forEach((s) => {
      ;(extrasById[s.id]?.notes ?? []).forEach((row) => {
        const v = computeSubjectMoyenne(row)
        if (v === null) return
        if (v < seuilNoteIsoleeFor(s.classe)) {
          const list = noteBasseByNom.get(s.name) ?? []
          list.push(`${row.subject} ${v.toFixed(1)}`)
          noteBasseByNom.set(s.name, list)
        }
      })
    })
  }
  const discByNom = new Map<string, { n: number; pts: number }>()
  if (has('discipline')) {
    students.forEach((s) => {
      ;(extrasById[s.id]?.discipline ?? []).forEach((d) => {
        const agg = discByNom.get(s.name) ?? { n: 0, pts: 0 }
        agg.n += 1
        agg.pts += d.points
        discByNom.set(s.name, agg)
      })
    })
  }

  const alertesRaw = has('eleves')
    ? students.map((e) => {
        const moy = has('notes') ? moyByNom.get(e.name) : undefined
        const disc = discByNom.get(e.name)
        const aPresence = e.taux < 100
        const noteBasse = noteBasseByNom.get(e.name)
        const aNotes = has('notes') && ((moy != null && moy < seuilMoyenneFor(e.classe)) || !!noteBasse)
        const aDisc = has('discipline') && !!disc
        return { e, moy, disc, noteBasse, aPresence, aNotes, aDisc, nb: (aPresence ? 1 : 0) + (aNotes ? 1 : 0) + (aDisc ? 1 : 0) }
      })
        .filter((a) => a.nb > 0)
        .sort((a, b) => b.nb - a.nb || a.e.taux - b.e.taux)
    : []

  const alertes: ExportAlertRow[] = alertesRaw.map((a, i) => ({
    nom: a.e.name,
    classe: a.e.classe,
    taux: `${a.e.taux.toFixed(1)}%`,
    absRet: `${a.e.absencesFois} / ${a.e.retardsFois}`,
    moy: a.moy != null ? `${a.moy.toFixed(1)} / ${moyenneScaleForClasse(a.e.classe) ?? 20}` : '—',
    disc: a.disc ? `${a.disc.n} · ${a.disc.pts}pt${Math.abs(a.disc.pts) > 1 ? 's' : ''}` : '—',
    bg: a.nb >= 2 || a.e.taux < 90 ? ALERT_BG : zebra(i),
    tauxColor: a.aPresence ? ALERT : MUTED,
    absColor: a.aPresence ? INK : MUTED,
    moyColor: a.aNotes ? ALERT : a.moy != null ? INK : MUTED,
    discColor: a.aDisc ? ALERT : MUTED,
  }))
  const nbParfait = has('eleves') ? students.length - alertesRaw.length : 0
  const resteLabel = has('eleves')
    ? `Les ${nbParfait} autres élèves ne déclenchent aucune alerte. Seuils appliqués selon le barème de la classe : moyenne sous 12/20 au collège, sous 6/10 au primaire ; note isolée sous 8/20 ou 4/10 ; tout incident disciplinaire.`
    : ''

  // ---------- KPIs (un par module dont la donnée source est cochée) ----------
  const kpis: ExportKpi[] = []
  if (has('eleves')) {
    kpis.push({ label: 'Élèves exportés', value: String(students.length), detail: 'Sur le périmètre sélectionné', color: INK })
    const tauxMoyen = students.length ? (students.reduce((s, e) => s + e.taux, 0) / students.length).toFixed(1) + '%' : '—'
    kpis.push({ label: 'Taux de présence moyen', value: tauxMoyen, detail: `${alertesRaw.length} élève(s) à signaler`, color: 'oklch(0.5 0.15 264)' })
  }
  if (has('absences')) {
    let totalMin = 0
    let count = 0
    students.forEach((s) => {
      ;(extrasById[s.id]?.events ?? []).forEach((e) => {
        if (!isWithinPeriod(e.date, dateStart, dateEnd)) return
        count += 1
        const m = /(?:(\d+)h)?\s*(?:(\d+)min)?/.exec(e.duree || '')
        totalMin += (parseInt(m?.[1] || '0', 10) || 0) * 60 + (parseInt(m?.[2] || '0', 10) || 0)
      })
    })
    kpis.push({ label: 'Heures manquées', value: fmtDuree(totalMin), detail: `${count} événement(s)`, color: 'oklch(0.6 0.19 25)' })
  }
  if (has('discipline')) {
    const count = students.reduce((sum, s) => sum + (extrasById[s.id]?.discipline ?? []).length, 0)
    const concerned = discByNom.size
    kpis.push({ label: 'Incidents disciplinaires', value: String(count), detail: `${concerned} élève(s) concerné(s)`, color: 'oklch(0.6 0.1 300)' })
  }

  return { kpis, sommaire, alertes, showAlertes: has('eleves'), nbParfait, resteLabel, sectionPages }
}
