import * as XLSX from 'xlsx'
import type { Student } from '../data/students'
import { fetchStudents, getStudentsSnapshot, insertStudent, updateStudentRow } from '../services/studentsService'
import { STATUT_OPTIONS, type Teacher } from '../data/teachers'
import { getTeachersSnapshot, insertTeacher, updateTeacherRow } from '../services/teachersService'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { getMatieresConfigSnapshot } from '../services/matieresConfigService'
import { getAbsencesConfigSnapshot } from '../services/absencesConfigService'
import type { EventRecord, Evaluation, NoteRow } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentEvents, updateStudentNotes, applyEvaluation } from '../services/studentDetailsService'
import type { TeacherAbsenceRecord } from '../data/teacherExtras'
import { getTeacherExtraSnapshot, replaceTeacherAbsencesDirect } from '../services/teacherExtrasService'
import { makeCourseSlot, SCHEDULE_DAYS, type ClassSchedule } from '../data/classSchedules'
import { replaceClassScheduleWeek } from '../services/classSchedulesService'
import type { StudentIdentity } from '../data/studentIdentity'
import { fetchStudentIdentities, upsertStudentIdentity, getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getSallesSnapshot } from '../services/sallesService'
import { fetchParents, linkParentToStudent } from '../services/parentsService'
import { getViewedYearIdSnapshot } from '../services/viewedYear'

export type ImportType = 'eleves' | 'enseignants' | 'absences' | 'notes' | 'edt' | 'garde_repas'

export interface ParsedRow {
  id: string
  summary: string
  status: 'ok' | 'error'
  error?: string
}

export interface ImportSummary {
  created: number
  updated: number
  parentsLinked?: number
}

export interface ParseResult {
  rows: ParsedRow[]
  commit: () => Promise<ImportSummary>
}

function normHeader(v: unknown): string {
  return (v ?? '').toString().trim().toLowerCase()
}

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((h) => aliases.includes(h))
}

function cellToDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return (v ?? '').toString().trim()
}

function formatDureeLabel(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h && m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}

function isBlankRow(raw: unknown[]): boolean {
  return !raw || raw.every((c) => c === '' || c == null)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(v: unknown): { email: string; invalid: boolean } {
  const raw = (v ?? '').toString().trim()
  if (!raw) return { email: '', invalid: false }
  return EMAIL_RE.test(raw) ? { email: raw, invalid: false } : { email: '', invalid: true }
}

function niveauFromClasse(classe: string): string {
  return classe.replace(/-[A-Z]$/, '')
}

function isUpperWord(w: string): boolean {
  return /[A-ZÀ-Ý]/.test(w) && w === w.toLocaleUpperCase('fr-FR')
}

/**
 * Sépare une cellule combinée « NOM Prénom » (convention Massar observée sur un vrai export de
 * l'école : nom de famille en tête, en majuscules) en ses deux parties — utilisé en repli quand le
 * fichier importé n'a pas de colonnes Nom/Prénom séparées. `splitIndex` (nombre de mots consommés
 * par le nom) permet de découper une colonne arabe parallèle au même endroit (cf. splitParallel).
 */
function splitNomPrenom(full: string): { nom: string; prenom: string; splitIndex: number } {
  const words = full.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (words.length === 0) return { nom: '', prenom: '', splitIndex: 0 }
  if (words.length === 1) return { nom: words[0], prenom: '', splitIndex: 1 }
  let i = 0
  while (i < words.length && isUpperWord(words[i])) i++
  if (i === 0 || i === words.length) i = words.length - 1 // pas de casse distinctive : dernier mot = prénom
  return { nom: words.slice(0, i).join(' '), prenom: words.slice(i).join(' '), splitIndex: i }
}

/** Applique la même césure (en nombre de mots) que la colonne latine à sa contrepartie arabe — pas
 * de casse en arabe pour la détecter soi-même, mais le même ordre nom-puis-prénom s'applique. */
function splitParallel(full: string, splitIndex: number): { nom: string; prenom: string } {
  const words = full.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (words.length === 0) return { nom: '', prenom: '' }
  if (words.length === 1) return { nom: words[0], prenom: '' }
  const idx = Math.min(Math.max(splitIndex, 1), words.length - 1)
  return { nom: words.slice(0, idx).join(' '), prenom: words.slice(idx).join(' ') }
}

/** Une classe du fichier sans lettre de section (ex. « 1APIC », « Ps ») est résolue vers l'unique
 * classe active de ce niveau quand elle existe sans ambiguïté — cas réel d'un export Massar sur un
 * niveau n'ayant qu'une seule section (collège, petite section). */
function resolveClasse(raw: string, activeClasses: string[]): string | null {
  if (activeClasses.includes(raw)) return raw
  const niveau = raw.trim().toUpperCase()
  if (!niveau) return null
  const matches = activeClasses.filter((c) => niveauFromClasse(c).toUpperCase() === niveau)
  return matches.length === 1 ? matches[0] : null
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function readSheetAoa(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
}

// ---------- Élèves ----------

function parseOuiNon(v: unknown): boolean {
  return normHeader(v).startsWith('oui')
}

/** Cellule vide (ou colonne absente du fichier, `idx === -1` -> `raw[-1] === undefined`). */
function isBlankCell(v: unknown): boolean {
  return !(v ?? '').toString().trim()
}

interface AcceptedEleve {
  prenom: string
  nom: string
  classe: string
  sexe: 'M' | 'F'
  identity: StudentIdentity
  // Champs dont la cellule source était vide sur cette ligne — à la réinscription d'un élève déjà
  // connu, ces champs gardent leur valeur déjà enregistrée plutôt que d'être écrasés à vide/false,
  // pour permettre un réimport partiel (ex. ne corriger que la colonne Cantine) sans perdre le
  // reste de la fiche.
  blankFields: (keyof StudentIdentity)[]
}

function copyField<K extends keyof StudentIdentity>(target: StudentIdentity, source: StudentIdentity, key: K): void {
  target[key] = source[key]
}

function parseEleves(aoa: unknown[][]): ParseResult {
  const header = (aoa[0] ?? []).map(normHeader)
  const nomIdx = findColumn(header, ['nom'])
  const prenomIdx = findColumn(header, ['prenom', 'prénom'])
  const nomPrenomIdx = findColumn(header, ['nom et prenom', 'nom et prénom', 'nom complet'])
  const nomArIdx = findColumn(header, ['nom (ar)'])
  const prenomArIdx = findColumn(header, ['prenom (ar)', 'prénom (ar)'])
  const nomPrenomArIdx = findColumn(header, ['nom et prenom (ar)', 'nom et prénom (ar)'])
  const codeMassarIdx = findColumn(header, ['code massar'])
  const classeIdx = findColumn(header, ['classe'])
  const genreIdx = findColumn(header, ['genre', 'sexe (m/f)', 'sexe'])
  const cantineIdx = findColumn(header, ['cantine'])
  const gardeApresMidiIdx = findColumn(header, ['garde apres midi', 'garde après midi'])
  const gardeMatinIdx = findColumn(header, ['garde matin'])
  const gardeMidiIdx = findColumn(header, ['garde midi'])
  // Repli : certains exports (ex. Massar) n'ont qu'une seule colonne "Garde" (Oui/Non) au lieu des
  // 3 créneaux détaillés — "Oui" y coche alors les 3 créneaux à la fois, faute de détail plus fin.
  const gardeUniqueIdx = findColumn(header, ['garde'])
  const transportIdx = findColumn(header, ['transport'])
  const dateNaissanceIdx = findColumn(header, ['date de naissance'])
  const lieuNaissanceIdx = findColumn(header, ['lieu de naissance'])
  const dateEntreeIdx = findColumn(header, ["date d'entree", "date d'entrée"])
  const parent1NomIdx = findColumn(header, ['nom parent 1'])
  const parent1PrenomIdx = findColumn(header, ['prenom parent 1', 'prénom parent 1'])
  const parent1NomPrenomIdx = findColumn(header, ['nom et prenom parent 1', 'nom et prénom parent 1'])
  const parent1TelIdx = findColumn(header, ['tel parent 1', 'tél parent 1', 'téléphone parent 1'])
  const parent1EmailIdx = findColumn(header, ['email parent 1', 'e-mail parent 1'])
  const parent2NomIdx = findColumn(header, ['nom parent 2'])
  const parent2PrenomIdx = findColumn(header, ['prenom parent 2', 'prénom parent 2'])
  const parent2NomPrenomIdx = findColumn(header, ['nom et prenom parent 2', 'nom et prénom parent 2'])
  const parent2TelIdx = findColumn(header, ['tel parent 2', 'tél parent 2', 'téléphone parent 2'])
  const parent2EmailIdx = findColumn(header, ['email parent 2', 'e-mail parent 2'])
  const activeClasses = getActiveClassNamesSnapshot()

  const accepted: AcceptedEleve[] = []
  const rows: ParsedRow[] = []

  aoa.slice(1).forEach((raw, i) => {
    if (isBlankRow(raw)) return
    const id = `el-${i}`
    let nom = (raw[nomIdx] ?? '').toString().trim()
    let prenom = (raw[prenomIdx] ?? '').toString().trim()
    let splitIndex = 0
    if ((!nom || !prenom) && nomPrenomIdx !== -1) {
      const split = splitNomPrenom((raw[nomPrenomIdx] ?? '').toString())
      nom = split.nom
      prenom = split.prenom
      splitIndex = split.splitIndex
    }
    const classeRaw = (raw[classeIdx] ?? '').toString().trim()
    const classe = resolveClasse(classeRaw, activeClasses) ?? classeRaw
    const genreRaw = normHeader(raw[genreIdx])
    const sexe: 'M' | 'F' = genreRaw.startsWith('f') ? 'F' : 'M'
    const label = `${prenom} ${nom}`.trim() || `Ligne ${i + 2}`

    if (!prenom || !nom) {
      rows.push({ id, summary: `Ligne ${i + 2}`, status: 'error', error: 'Prénom et nom obligatoires.' })
      return
    }
    if (!classe || !activeClasses.includes(classe)) {
      rows.push({ id, summary: `${label} — ${classeRaw || '(vide)'}`, status: 'error', error: `Classe inconnue : « ${classeRaw || '(vide)'} ». Vérifiez le Référentiel.` })
      return
    }

    let nomAr = (raw[nomArIdx] ?? '').toString().trim()
    let prenomAr = (raw[prenomArIdx] ?? '').toString().trim()
    if (!nomAr && !prenomAr && nomPrenomArIdx !== -1) {
      const splitAr = splitParallel((raw[nomPrenomArIdx] ?? '').toString(), splitIndex || 1)
      nomAr = splitAr.nom
      prenomAr = splitAr.prenom
    }
    let parent1Nom = (raw[parent1NomIdx] ?? '').toString().trim()
    let parent1Prenom = (raw[parent1PrenomIdx] ?? '').toString().trim()
    if ((!parent1Nom || !parent1Prenom) && parent1NomPrenomIdx !== -1) {
      const splitP1 = splitNomPrenom((raw[parent1NomPrenomIdx] ?? '').toString())
      parent1Nom = splitP1.nom
      parent1Prenom = splitP1.prenom
    }
    let parent2Nom = (raw[parent2NomIdx] ?? '').toString().trim()
    let parent2Prenom = (raw[parent2PrenomIdx] ?? '').toString().trim()
    if ((!parent2Nom || !parent2Prenom) && parent2NomPrenomIdx !== -1) {
      const splitP2 = splitNomPrenom((raw[parent2NomPrenomIdx] ?? '').toString())
      parent2Nom = splitP2.nom
      parent2Prenom = splitP2.prenom
    }

    const identity: StudentIdentity = {
      prenom,
      nom,
      nomAr,
      prenomAr,
      codeMassar: (raw[codeMassarIdx] ?? '').toString().trim(),
      cantine: parseOuiNon(raw[cantineIdx]),
      gardeApresMidi: gardeApresMidiIdx !== -1 ? parseOuiNon(raw[gardeApresMidiIdx]) : parseOuiNon(raw[gardeUniqueIdx]),
      gardeMatin: gardeMatinIdx !== -1 ? parseOuiNon(raw[gardeMatinIdx]) : parseOuiNon(raw[gardeUniqueIdx]),
      gardeMidi: gardeMidiIdx !== -1 ? parseOuiNon(raw[gardeMidiIdx]) : parseOuiNon(raw[gardeUniqueIdx]),
      transport: parseOuiNon(raw[transportIdx]),
      dateNaissance: cellToDateStr(raw[dateNaissanceIdx]),
      lieuNaissance: (raw[lieuNaissanceIdx] ?? '').toString().trim(),
      dateEntree: cellToDateStr(raw[dateEntreeIdx]),
      parent1Nom,
      parent1Prenom,
      parent1Tel: (raw[parent1TelIdx] ?? '').toString().trim(),
      parent1Email: '',
      parent2Nom,
      parent2Prenom,
      parent2Tel: (raw[parent2TelIdx] ?? '').toString().trim(),
      parent2Email: '',
      transportLigne: null,
      transportLigneSoir: null,
      transportSortie17h: false,
      transportMotifException: null,
      transportMotifAutre: null,
    }

    const email1 = normalizeEmail(raw[parent1EmailIdx])
    const email2 = normalizeEmail(raw[parent2EmailIdx])
    identity.parent1Email = email1.email
    identity.parent2Email = email2.email
    const emailWarnings = [email1.invalid && 'email parent 1 invalide', email2.invalid && 'email parent 2 invalide'].filter(Boolean) as string[]

    const blankFields: (keyof StudentIdentity)[] = []
    if (isBlankCell(raw[nomArIdx]) && isBlankCell(raw[nomPrenomArIdx])) blankFields.push('nomAr')
    if (isBlankCell(raw[prenomArIdx]) && isBlankCell(raw[nomPrenomArIdx])) blankFields.push('prenomAr')
    if (isBlankCell(raw[codeMassarIdx])) blankFields.push('codeMassar')
    if (isBlankCell(raw[cantineIdx])) blankFields.push('cantine')
    if (gardeApresMidiIdx !== -1 ? isBlankCell(raw[gardeApresMidiIdx]) : isBlankCell(raw[gardeUniqueIdx])) blankFields.push('gardeApresMidi')
    if (gardeMatinIdx !== -1 ? isBlankCell(raw[gardeMatinIdx]) : isBlankCell(raw[gardeUniqueIdx])) blankFields.push('gardeMatin')
    if (gardeMidiIdx !== -1 ? isBlankCell(raw[gardeMidiIdx]) : isBlankCell(raw[gardeUniqueIdx])) blankFields.push('gardeMidi')
    if (isBlankCell(raw[transportIdx])) blankFields.push('transport')
    if (isBlankCell(raw[dateNaissanceIdx])) blankFields.push('dateNaissance')
    if (isBlankCell(raw[lieuNaissanceIdx])) blankFields.push('lieuNaissance')
    if (isBlankCell(raw[dateEntreeIdx])) blankFields.push('dateEntree')
    if (isBlankCell(raw[parent1NomIdx]) && isBlankCell(raw[parent1NomPrenomIdx])) blankFields.push('parent1Nom')
    if (isBlankCell(raw[parent1PrenomIdx]) && isBlankCell(raw[parent1NomPrenomIdx])) blankFields.push('parent1Prenom')
    if (isBlankCell(raw[parent1TelIdx])) blankFields.push('parent1Tel')
    if (isBlankCell(raw[parent2NomIdx]) && isBlankCell(raw[parent2NomPrenomIdx])) blankFields.push('parent2Nom')
    if (isBlankCell(raw[parent2PrenomIdx]) && isBlankCell(raw[parent2NomPrenomIdx])) blankFields.push('parent2Prenom')
    if (isBlankCell(raw[parent2TelIdx])) blankFields.push('parent2Tel')

    accepted.push({ prenom, nom, classe, sexe, identity, blankFields })
    const summarySuffix = emailWarnings.length ? ` — ⚠ ${emailWarnings.join(', ')}` : ''
    rows.push({ id, summary: `${label} — ${classe}${identity.codeMassar ? ` · ${identity.codeMassar}` : ''}${summarySuffix}`, status: 'ok' })
  })

  return {
    rows,
    commit: async () => {
      let created = 0
      let updated = 0
      let parentsLinked = 0
      // Résolu au fil du commit : évite de relier deux fois le même parent quand deux élèves de ce
      // lot (fratrie) partagent le même email.
      const resolvedParentIds = new Map<string, string>()
      const importedInBatch: Student[] = []
      const identityBatch: Record<string, StudentIdentity> = {}

      // Relecture fraîche en base plutôt que via les caches client (getStudentsSnapshot() /
      // findStudentIdByCodeMassarSnapshot() / findParentByEmailSnapshot()) : ces caches ne se
      // peuplent que si une autre page a déjà monté leur hook dans cette session — un import lancé
      // sans y être jamais passé les trouvait vides et recréait des doublons silencieux au lieu de
      // mettre à jour (incident réel constaté sur cet import).
      const yearId = getViewedYearIdSnapshot()
      const [existingStudents, existingIdentities, existingParents] = await Promise.all([fetchStudents(yearId), fetchStudentIdentities(), fetchParents()])
      const existingIdentityByStudentId = new Map(Object.entries(existingIdentities))
      // `existingIdentities` (fetchStudentIdentities()) n'est PAS scopé par année — un même Code
      // Massar existe légitimement sur plusieurs lignes `student_identities` (une par année de
      // réinscription, cf. dossier_id/findDossierIdByCodeMassar dans studentsService.ts). Sans ce
      // filtre, la table codeMassar->studentId peut pointer vers l'id d'une ANNÉE PRÉCÉDENTE, absent
      // du `pool` scopé à l'année en cours — l'élève « introuvable » était alors recréé en double au
      // lieu d'être mis à jour (incident réel constaté sur cet import : 82 doublons).
      const currentYearStudentIds = new Set(existingStudents.map((s) => s.id))
      const existingStudentIdByCodeMassar = new Map(
        Object.entries(existingIdentities)
          .filter(([studentId, identity]) => identity.codeMassar && currentYearStudentIds.has(studentId))
          .map(([studentId, identity]) => [identity.codeMassar, studentId])
      )
      const existingParentIdByEmail = new Map(existingParents.map((p) => [p.email.toLowerCase(), p.id]))

      for (const { prenom, nom, classe, sexe, identity, blankFields } of accepted) {
        const fullName = `${prenom} ${nom}`.trim()
        const pool = [...existingStudents, ...importedInBatch]
        const matchedByCode = identity.codeMassar
          ? (Object.keys(identityBatch).find((id) => identityBatch[id].codeMassar === identity.codeMassar) ??
            existingStudentIdByCodeMassar.get(identity.codeMassar))
          : undefined
        // Filet de sécurité : si le rapprochement par code ne retrouve personne dans le pool de
        // cette année (ne devrait plus arriver avec le scoping ci-dessus, mais coûte peu à garder),
        // on retombe sur Nom+Classe plutôt que de conclure trop vite à un nouvel élève.
        // Dernier repli : Nom seul (sans Code Massar dans le fichier ET classe différente de celle
        // déjà enregistrée, ex. élève changé de classe entre deux réinscriptions) — seulement si ce
        // nom est sans ambiguïté dans le pool de cette année, sinon on risquerait de fusionner deux
        // élèves homonymes différents. La classe est alors mise à jour comme une correction normale.
        const nameMatches = pool.filter((s) => s.name.toLowerCase() === fullName.toLowerCase())
        const existing =
          (matchedByCode ? pool.find((s) => s.id === matchedByCode) : undefined) ??
          nameMatches.find((s) => s.classe === classe) ??
          (nameMatches.length === 1 ? nameMatches[0] : undefined)

        let studentId: string
        if (existing) {
          studentId = existing.id
          await updateStudentRow(studentId, { name: fullName, sexe, classe })
          updated += 1
          // L'affectation transport (ligne, exception 17h) est gérée uniquement depuis le module
          // Transport, absente du fichier Excel — on la reporte pour ne pas l'effacer à la réinscription.
          const previous = existingIdentityByStudentId.get(studentId) ?? identityBatch[studentId]
          if (previous) {
            identity.transportLigne = previous.transportLigne
            identity.transportLigneSoir = previous.transportLigneSoir
            identity.transportSortie17h = previous.transportSortie17h
            identity.transportMotifException = previous.transportMotifException
            identity.transportMotifAutre = previous.transportMotifAutre
            // Une cellule email vide sur ce réimport ne doit pas désactiver un email déjà connu.
            if (!identity.parent1Email) identity.parent1Email = previous.parent1Email
            if (!identity.parent2Email) identity.parent2Email = previous.parent2Email
            // Toute autre colonne laissée vide sur cette ligne (ex. réimport partiel qui ne corrige
            // que « Cantine ») garde la valeur déjà enregistrée au lieu d'être écrasée à vide/false.
            blankFields.forEach((field) => copyField(identity, previous, field))
          }
        } else {
          const newStudentData = {
            name: fullName,
            sexe,
            classe,
            absencesHeures: '0h',
            absencesFois: 0,
            retardsMin: '0h',
            retardsFois: 0,
            totalHeures: '0h',
            taux: 100,
          }
          studentId = await insertStudent(newStudentData, identity.codeMassar)
          importedInBatch.push({ id: studentId, ...newStudentData })
          created += 1
        }
        identityBatch[studentId] = identity
        await upsertStudentIdentity(studentId, identity)

        for (const [email, relation] of [
          [identity.parent1Email, 'Parent 1'],
          [identity.parent2Email, 'Parent 2'],
        ] as [string, string][]) {
          if (!email) continue
          const key = email.toLowerCase()
          // L'import Excel ne crée jamais de nouveau compte parent — seuls les parents déjà
          // inscrits (email déjà connu) sont liés à l'élève importé. Inviter reste une action
          // volontaire, faite un par un depuis « Comptes Parents ».
          const parentId = resolvedParentIds.get(key) ?? existingParentIdByEmail.get(key)
          if (!parentId) continue
          resolvedParentIds.set(key, parentId)
          await linkParentToStudent({ parentId, studentId, relation })
          parentsLinked += 1
        }
      }
      return { created, updated, parentsLinked }
    },
  }
}

// ---------- Enseignants ----------

interface AcceptedEnseignant {
  prenom: string
  nom: string
  telephoneMobile: string
  email: string
  statut: Teacher['statut']
  matricule: string
}

function parseEnseignants(aoa: unknown[][]): ParseResult {
  const header = (aoa[0] ?? []).map(normHeader)
  const nomIdx = findColumn(header, ['nom'])
  const prenomIdx = findColumn(header, ['prénom', 'prenom'])
  const telIdx = findColumn(header, ['téléphone', 'telephone', 'téléphone mobile', 'telephone mobile'])
  const emailIdx = findColumn(header, ['e-mail', 'email'])
  const statutIdx = findColumn(header, ['statut'])
  const matriculeIdx = findColumn(header, ['code professeur', 'matricule'])

  const accepted: AcceptedEnseignant[] = []
  const rows: ParsedRow[] = []

  aoa.slice(1).forEach((raw, i) => {
    if (isBlankRow(raw)) return
    const id = `ens-${i}`
    const nom = (raw[nomIdx] ?? '').toString().trim()
    const prenom = (raw[prenomIdx] ?? '').toString().trim()
    const telephoneMobile = (raw[telIdx] ?? '').toString().trim()
    const email = (raw[emailIdx] ?? '').toString().trim()
    const statutRaw = (raw[statutIdx] ?? '').toString().trim()
    const matricule = (raw[matriculeIdx] ?? '').toString().trim()
    const label = `${prenom} ${nom}`.trim() || `Ligne ${i + 2}`

    if (!prenom || !nom) {
      rows.push({ id, summary: `Ligne ${i + 2}`, status: 'error', error: 'Prénom et nom obligatoires.' })
      return
    }
    let statut: Teacher['statut'] = 'Permanent'
    if (statutRaw) {
      const canonicalStatut = STATUT_OPTIONS.find((s) => s.toLowerCase() === statutRaw.toLowerCase())
      if (!canonicalStatut) {
        rows.push({ id, summary: `${label} — ${statutRaw}`, status: 'error', error: `Statut inconnu : « ${statutRaw} ». Attendu : ${STATUT_OPTIONS.join(', ')}.` })
        return
      }
      statut = canonicalStatut
    }

    accepted.push({ prenom, nom, telephoneMobile, email, statut, matricule })
    rows.push({ id, summary: `${label} — ${statut}${matricule ? ` · ${matricule}` : ''}`, status: 'ok' })
  })

  return {
    rows,
    commit: async () => {
      let created = 0
      let updated = 0
      const importedInBatch: Teacher[] = []
      for (const { prenom, nom, telephoneMobile, email, statut, matricule } of accepted) {
        const pool = [...getTeachersSnapshot(), ...importedInBatch]
        const existing = matricule
          ? pool.find((t) => t.matricule === matricule)
          : pool.find((t) => t.prenom.toLowerCase() === prenom.toLowerCase() && t.nom.toLowerCase() === nom.toLowerCase())
        if (existing) {
          await updateTeacherRow(existing.id, {
            prenom,
            nom,
            telephoneMobile: telephoneMobile || existing.telephoneMobile,
            telephoneDomicile: existing.telephoneDomicile,
            email: email || existing.email,
            matricule: matricule || existing.matricule,
            plateforme: existing.plateforme,
            idMeeting: existing.idMeeting,
            lienVisio: existing.lienVisio,
            statut,
            type: existing.type,
            niveaux: existing.niveaux,
            matieres: existing.matieres,
            classes: existing.classes,
          })
          updated += 1
        } else {
          const newTeacherData = {
            prenom,
            nom,
            email: email || `${prenom.toLowerCase()}.${nom.toLowerCase().replace(/\s+/g, '')}@ecole.ma`,
            telephoneMobile,
            telephoneDomicile: '',
            matricule: matricule || `T-IMP-${Date.now().toString(36).slice(-4)}`,
            plateforme: '',
            idMeeting: '',
            lienVisio: '',
            statut,
            type: 'Principal' as const,
            niveaux: [] as string[],
            matieres: [] as string[],
            classes: [] as string[],
          }
          const newId = await insertTeacher(newTeacherData)
          importedInBatch.push({ id: newId, ...newTeacherData })
          created += 1
        }
      }
      return { created, updated }
    },
  }
}

// ---------- Absences & Retards ----------

type AbsenceAccepted =
  | { kind: 'eleve'; studentId: string; date: string; type: 'ABSENCE' | 'RETARD'; duree: number; motif: string; justified: boolean }
  | { kind: 'enseignant'; teacherId: string; date: string; type: 'ABSENCE' | 'RETARD'; classe: string; duree: number; motif: string; justified: boolean }

function parseAbsences(aoa: unknown[][]): ParseResult {
  const header = (aoa[0] ?? []).map(normHeader)
  const typeIdx = findColumn(header, ['type (élève/enseignant)', 'type (eleve/enseignant)', 'type'])
  const prenomIdx = findColumn(header, ['prénom', 'prenom'])
  const nomIdx = findColumn(header, ['nom'])
  const classeIdx = findColumn(header, ['classe (si élève)', 'classe (si eleve)', 'classe'])
  const dateIdx = findColumn(header, ['date (aaaa-mm-jj)', 'date'])
  const eventTypeIdx = findColumn(header, ['type (absence/retard)', 'type événement (absence/retard)', 'type evenement'])
  const dureeIdx = findColumn(header, ['durée (h)', 'duree (h)', 'durée', 'duree'])
  const motifIdx = findColumn(header, ['motif'])
  const justifieIdx = findColumn(header, ['justifié (oui/non)', 'justifie (oui/non)', 'justifié', 'justifie'])

  const motifsConfig = getAbsencesConfigSnapshot().motifs
  const accepted: AbsenceAccepted[] = []
  const rows: ParsedRow[] = []

  aoa.slice(1).forEach((raw, i) => {
    if (isBlankRow(raw)) return
    const id = `abs-${i}`
    const typeRaw = normHeader(raw[typeIdx])
    const isEleve = typeRaw.startsWith('él') || typeRaw.startsWith('el')
    const isEnseignant = typeRaw.startsWith('ens')
    const prenom = (raw[prenomIdx] ?? '').toString().trim()
    const nom = (raw[nomIdx] ?? '').toString().trim()
    const classe = (raw[classeIdx] ?? '').toString().trim()
    const date = cellToDateStr(raw[dateIdx])
    const eventTypeRaw = normHeader(raw[eventTypeIdx])
    const type: 'ABSENCE' | 'RETARD' = eventTypeRaw.startsWith('ret') ? 'RETARD' : 'ABSENCE'
    const dureeNum = parseFloat((raw[dureeIdx] ?? '0').toString().replace(',', '.'))
    const motifRaw = (raw[motifIdx] ?? '').toString().trim()
    const justifieRaw = normHeader(raw[justifieIdx])
    const justified = justifieRaw.startsWith('oui')
    const label = `${prenom} ${nom}`.trim() || `Ligne ${i + 2}`

    if (!isEleve && !isEnseignant) {
      rows.push({ id, summary: label, status: 'error', error: `Type inconnu : « ${(raw[typeIdx] ?? '').toString()} ». Attendu Élève ou Enseignant.` })
      return
    }
    if (!prenom || !nom) {
      rows.push({ id, summary: `Ligne ${i + 2}`, status: 'error', error: 'Prénom et nom obligatoires.' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      rows.push({ id, summary: label, status: 'error', error: `Date invalide : « ${date} ». Format attendu AAAA-MM-JJ.` })
      return
    }
    if (!dureeNum || dureeNum <= 0) {
      rows.push({ id, summary: label, status: 'error', error: 'Durée invalide.' })
      return
    }
    const canonicalMotif = motifsConfig.find((m) => m.toLowerCase() === motifRaw.toLowerCase())
    if (!canonicalMotif) {
      rows.push({ id, summary: `${label} — ${motifRaw || '(vide)'}`, status: 'error', error: `Motif inconnu : « ${motifRaw || '(vide)'} ». Configurez-le dans Référentiel > Absences.` })
      return
    }

    if (isEleve) {
      if (!classe) {
        rows.push({ id, summary: label, status: 'error', error: 'Classe obligatoire pour un élève.' })
        return
      }
      const student = getStudentsSnapshot().find((s) => s.name.toLowerCase() === label.toLowerCase() && s.classe === classe)
      if (!student) {
        rows.push({ id, summary: `${label} — ${classe}`, status: 'error', error: `Élève introuvable dans « ${classe} ».` })
        return
      }
      accepted.push({ kind: 'eleve', studentId: student.id, date, type, duree: dureeNum, motif: canonicalMotif, justified })
      rows.push({ id, summary: `${label} (${classe}) — ${type === 'ABSENCE' ? 'Absence' : 'Retard'} ${formatDureeLabel(dureeNum)} le ${date}`, status: 'ok' })
    } else {
      const teacher = getTeachersSnapshot().find((t) => t.prenom.toLowerCase() === prenom.toLowerCase() && t.nom.toLowerCase() === nom.toLowerCase())
      if (!teacher) {
        rows.push({ id, summary: label, status: 'error', error: 'Enseignant introuvable.' })
        return
      }
      accepted.push({ kind: 'enseignant', teacherId: teacher.id, date, type, classe, duree: dureeNum, motif: canonicalMotif, justified })
      rows.push({ id, summary: `${label} — ${type === 'ABSENCE' ? 'Absence' : 'Retard'} ${formatDureeLabel(dureeNum)} le ${date}`, status: 'ok' })
    }
  })

  return {
    rows,
    commit: async () => {
      let created = 0
      const newTeacherAbsencesById = new Map<string, TeacherAbsenceRecord[]>()
      const newStudentEventsById = new Map<string, EventRecord[]>()
      accepted.forEach((a) => {
        if (a.kind === 'eleve') {
          const list = newStudentEventsById.get(a.studentId) ?? []
          list.push({
            date: a.date,
            type: a.type,
            justified: a.justified,
            subject: 'Général',
            subjectColor: 'blue',
            duree: formatDureeLabel(a.duree),
            motif: a.motif,
          })
          newStudentEventsById.set(a.studentId, list)
        } else {
          const list = newTeacherAbsencesById.get(a.teacherId) ?? []
          list.push({ date: a.date, type: a.type, justified: a.justified, classe: a.classe, duree: a.duree, motif: a.motif })
          newTeacherAbsencesById.set(a.teacherId, list)
        }
        created += 1
      })
      for (const [teacherId, newAbsences] of newTeacherAbsencesById) {
        const extra = getTeacherExtraSnapshot(teacherId)
        await replaceTeacherAbsencesDirect(teacherId, [...extra.absences, ...newAbsences])
      }
      for (const [studentId, newEvents] of newStudentEventsById) {
        const existing = getStudentExtraSnapshot(studentId).events
        await updateStudentEvents(studentId, [...existing, ...newEvents])
      }
      return { created, updated: 0 }
    },
  }
}

// ---------- Notes / Contrôles ----------

function parseNotes(aoa: unknown[][]): ParseResult {
  const header = (aoa[0] ?? []).map(normHeader)
  const prenomIdx = findColumn(header, ['prénom', 'prenom'])
  const nomIdx = findColumn(header, ['nom'])
  const classeIdx = findColumn(header, ['classe'])
  const matiereIdx = findColumn(header, ['matière', 'matiere'])
  const typeIdx = findColumn(header, ['type de contrôle', 'type de controle'])
  const noteIdx = findColumn(header, ['note /20', 'note'])
  const periodeIdx = findColumn(header, ['période', 'periode'])
  const appreciationIdx = findColumn(header, ['appréciation', 'appreciation'])
  const dateIdx = findColumn(header, ['date (aaaa-mm-jj)', 'date'])

  const validMatieres = getMatieresConfigSnapshot()
  const accepted: { studentId: string; matiere: string; coef: number; evaluation: Evaluation }[] = []
  const rows: ParsedRow[] = []

  aoa.slice(1).forEach((raw, i) => {
    if (isBlankRow(raw)) return
    const id = `note-${i}`
    const prenom = (raw[prenomIdx] ?? '').toString().trim()
    const nom = (raw[nomIdx] ?? '').toString().trim()
    const classe = (raw[classeIdx] ?? '').toString().trim()
    const matiereRaw = (raw[matiereIdx] ?? '').toString().trim()
    const typeControle = (raw[typeIdx] ?? '').toString().trim() || 'Contrôle'
    const noteNum = parseFloat((raw[noteIdx] ?? '').toString().replace(',', '.'))
    const periode = (raw[periodeIdx] ?? '').toString().trim()
    const appreciation = (raw[appreciationIdx] ?? '').toString().trim()
    const date = cellToDateStr(raw[dateIdx]) || new Date().toISOString().slice(0, 10)
    const label = `${prenom} ${nom}`.trim() || `Ligne ${i + 2}`

    if (!prenom || !nom || !classe) {
      rows.push({ id, summary: `Ligne ${i + 2}`, status: 'error', error: 'Prénom, nom et classe obligatoires.' })
      return
    }
    const matiereConfig = validMatieres.find((m) => m.nom.toLowerCase() === matiereRaw.toLowerCase())
    if (!matiereConfig) {
      rows.push({ id, summary: `${label} — ${matiereRaw || '(vide)'}`, status: 'error', error: `Matière inconnue : « ${matiereRaw || '(vide)'} ». Vérifiez le Référentiel.` })
      return
    }
    if (Number.isNaN(noteNum) || noteNum < 0 || noteNum > 20) {
      rows.push({ id, summary: label, status: 'error', error: `Note invalide : « ${(raw[noteIdx] ?? '').toString()} ». Attendu un nombre entre 0 et 20.` })
      return
    }
    const student = getStudentsSnapshot().find((s) => s.name.toLowerCase() === label.toLowerCase() && s.classe === classe)
    if (!student) {
      rows.push({ id, summary: `${label} — ${classe}`, status: 'error', error: `Élève introuvable dans « ${classe} ».` })
      return
    }
    const niveau = niveauFromClasse(classe)
    const coef = matiereConfig.parNiveau[niveau]?.coefficient ?? 1
    accepted.push({
      studentId: student.id,
      matiere: matiereConfig.nom,
      coef,
      evaluation: { type: typeControle, value: noteNum, coef, date, author: 'Import Excel', appreciation: appreciation || undefined },
    })
    rows.push({ id, summary: `${label} — ${matiereConfig.nom} : ${noteNum}/20 (${typeControle}${periode ? `, ${periode}` : ''})`, status: 'ok' })
  })

  return {
    rows,
    commit: async () => {
      let created = 0
      const notesByStudent = new Map<string, NoteRow[]>()
      accepted.forEach((a) => {
        const current = notesByStudent.get(a.studentId) ?? getStudentExtraSnapshot(a.studentId).notes
        notesByStudent.set(a.studentId, applyEvaluation(current, a.matiere, a.coef, a.evaluation))
        created += 1
      })
      for (const [studentId, notes] of notesByStudent) {
        await updateStudentNotes(studentId, notes)
      }
      return { created, updated: 0 }
    },
  }
}

// ---------- Emplois du Temps (1 fichier = 1 classe, jours en sections de lignes) ----------

const DAY_KEYS: Record<string, string> = {
  lundi: 'LUNDI',
  mardi: 'MARDI',
  mercredi: 'MERCREDI',
  jeudi: 'JEUDI',
  vendredi: 'VENDREDI',
  samedi: 'SAMEDI',
  dimanche: 'DIMANCHE',
}

function detectClasseFromFilename(fileName: string, activeClasses: string[]): string | undefined {
  const base = fileName.replace(/\.(xlsx|xls)$/i, '')
  const tokens = base.split(/[_\s]+/)
  for (let take = 1; take <= 2 && take <= tokens.length; take++) {
    const candidate = tokens.slice(-take).join('-').replace(/-{2,}/g, '-')
    const match = activeClasses.find((c) => c.toLowerCase() === candidate.toLowerCase())
    if (match) return match
  }
  const lastToken = tokens[tokens.length - 1] ?? ''
  const direct = activeClasses.find((c) => c.toLowerCase() === lastToken.toLowerCase())
  if (direct) return direct
  return activeClasses.find((c) => base.toLowerCase().includes(c.toLowerCase()))
}

function parseEdt(workbook: XLSX.WorkBook, fileName: string): ParseResult {
  const activeClasses = getActiveClassNamesSnapshot()
  const classe = detectClasseFromFilename(fileName, activeClasses)

  if (!classe) {
    return {
      rows: [
        {
          id: 'edt-nofile',
          summary: fileName,
          status: 'error',
          error:
            "Impossible de déterminer la classe depuis le nom du fichier. Le nom doit se terminer par le nom exact d'une classe active (ex : « emplois_du_temps_3APIC_3APIC-A.xlsx »).",
        },
      ],
      commit: async () => ({ created: 0, updated: 0 }),
    }
  }

  const rows: ParsedRow[] = []
  let rowSeq = 0

  const aoa = readSheetAoa(workbook, workbook.SheetNames[0])
  const header = (aoa[0] ?? []).map(normHeader)
  const seancesIdx = findColumn(header, ['seances', 'séances'])
  const matieresIdx = findColumn(header, ['matieres', 'matières'])
  const codeProfIdx = findColumn(header, ['code professeur'])
  const codeSalleIdx = findColumn(header, ['code salle'])

  const matieresConfig = getMatieresConfigSnapshot()
  const salles = getSallesSnapshot()

  const week: ClassSchedule = {}
  SCHEDULE_DAYS.forEach((d) => {
    week[d] = []
  })

  let currentDay: string | null = null

  aoa.slice(1).forEach((raw) => {
    if (isBlankRow(raw)) return
    const firstCell = (raw[seancesIdx] ?? '').toString().trim().toLowerCase()

    if (DAY_KEYS[firstCell]) {
      currentDay = DAY_KEYS[firstCell]
      return
    }

    const timeMatch = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(firstCell)
    if (!timeMatch) return
    if (!currentDay || !SCHEDULE_DAYS.includes(currentDay)) return

    const [, start, end] = timeMatch
    const hours = (timeToMin(end) - timeToMin(start)) / 60
    const matiereCode = (raw[matieresIdx] ?? '').toString().trim()
    const codeProf = (raw[codeProfIdx] ?? '').toString().trim()
    const codeSalle = (raw[codeSalleIdx] ?? '').toString().trim()
    const id = `edt-${rowSeq++}`
    const day = currentDay

    if (!matiereCode) {
      rows.push({ id, summary: `${day} ${start}-${end}`, status: 'error', error: 'Matière manquante.' })
      return
    }
    const matiere =
      matieresConfig.find((m) => m.code.toLowerCase() === matiereCode.toLowerCase()) ??
      matieresConfig.find((m) => m.nom.toLowerCase() === matiereCode.toLowerCase())
    if (!matiere) {
      rows.push({ id, summary: `${day} ${start}-${end} — ${matiereCode}`, status: 'error', error: `Matière inconnue : « ${matiereCode} ». Vérifiez les codes dans le Référentiel.` })
      return
    }

    let teacherId = ''
    let teacherLabel = 'non assigné'
    if (codeProf) {
      const teacher = getTeachersSnapshot().find((t) => t.matricule === codeProf)
      if (!teacher) {
        rows.push({ id, summary: `${day} ${start}-${end} — ${matiere.nom}`, status: 'error', error: `Code professeur inconnu : « ${codeProf} ».` })
        return
      }
      teacherId = teacher.id
      teacherLabel = `${teacher.prenom} ${teacher.nom}`
    }

    let salleId: string | undefined
    if (codeSalle) {
      const salle = salles.find((s) => s.code === codeSalle || s.id === codeSalle || s.nom.toLowerCase() === codeSalle.toLowerCase())
      if (salle) salleId = salle.id
    }

    week[day] = [...week[day], makeCourseSlot(matiere.nom, teacherId, start, end, hours, salleId)]
    rows.push({ id, summary: `${day} ${start}-${end} : ${matiere.nom} (${teacherLabel})`, status: 'ok' })
  })

  return {
    rows,
    commit: async () => {
      // replaceClassScheduleWeek recale automatiquement Niveaux/Matières/Classes des profs concernés
      // sur ce nouvel emploi du temps.
      await replaceClassScheduleWeek(classe, week)
      return { created: 0, updated: 1 }
    },
  }
}

// ---------- Garde Repas ----------

interface AcceptedGardeRepas {
  studentId: string
  fullName: string
}

/**
 * Simple liste « qui a la garde repas » (Code Massar + Nom, aucune classe) — active Garde midi ET
 * Cantine (même règle établie manuellement cette session : garde repas ⟹ cantine) pour chaque élève
 * retrouvé dans l'année consultée. N'importe jamais de nouvel élève (liste de bascule, pas un
 * registre d'identité complet) et ne désactive jamais un élève absent du fichier — décision
 * explicite : un nom mal orthographié dans le fichier ne doit jamais couper la garde repas de
 * quelqu'un qui l'a déjà.
 */
function parseGardeRepas(aoa: unknown[][]): ParseResult {
  const header = (aoa[0] ?? []).map(normHeader)
  const nomIdx = findColumn(header, ['nom'])
  const prenomIdx = findColumn(header, ['prenom', 'prénom'])
  const nomPrenomIdx = findColumn(header, ['nom et prenom', 'nom et prénom', 'nom complet'])
  const codeMassarIdx = findColumn(header, ['code massar'])

  const currentStudents = getStudentsSnapshot()
  const codeMassarToId = new Map<string, string>()
  const nameToStudents = new Map<string, Student[]>()
  currentStudents.forEach((s) => {
    const code = getStudentIdentitySnapshot(s.id).codeMassar
    if (code) codeMassarToId.set(code, s.id)
    const key = s.name.toLowerCase()
    nameToStudents.set(key, [...(nameToStudents.get(key) ?? []), s])
  })

  const accepted: AcceptedGardeRepas[] = []
  const rows: ParsedRow[] = []

  aoa.slice(1).forEach((raw, i) => {
    if (isBlankRow(raw)) return
    const id = `gr-${i}`
    let nom = (raw[nomIdx] ?? '').toString().trim()
    let prenom = (raw[prenomIdx] ?? '').toString().trim()
    if ((!nom || !prenom) && nomPrenomIdx !== -1) {
      const split = splitNomPrenom((raw[nomPrenomIdx] ?? '').toString())
      nom = split.nom
      prenom = split.prenom
    }
    const fullName = `${prenom} ${nom}`.trim()
    const codeMassar = (raw[codeMassarIdx] ?? '').toString().trim()
    const label = fullName || `Ligne ${i + 2}`

    if (!fullName) {
      rows.push({ id, summary: `Ligne ${i + 2}`, status: 'error', error: 'Nom obligatoire.' })
      return
    }

    const nameMatches = nameToStudents.get(fullName.toLowerCase()) ?? []
    const matched = (codeMassar ? codeMassarToId.get(codeMassar) : undefined) ?? (nameMatches.length === 1 ? nameMatches[0].id : undefined)

    if (!matched) {
      const error =
        nameMatches.length > 1
          ? `Plusieurs élèves portent ce nom (${nameMatches.map((s) => s.classe).join(', ')}) — ajoutez le Code Massar pour lever l'ambiguïté.`
          : "Élève introuvable dans le registre de l'année consultée."
      rows.push({ id, summary: label, status: 'error', error })
      return
    }

    accepted.push({ studentId: matched, fullName })
    const already = getStudentIdentitySnapshot(matched)
    const summary = already.gardeMidi && already.cantine ? `${label} — déjà activé` : `${label} — sera activé (Garde midi + Cantine)`
    rows.push({ id, summary, status: 'ok' })
  })

  return {
    rows,
    commit: async () => {
      let updated = 0
      const [existingStudents, existingIdentities] = await Promise.all([fetchStudents(getViewedYearIdSnapshot()), fetchStudentIdentities()])
      const currentYearStudentIds = new Set(existingStudents.map((s) => s.id))
      for (const { studentId } of accepted) {
        if (!currentYearStudentIds.has(studentId)) continue
        const previous = existingIdentities[studentId]
        if (!previous || (previous.gardeMidi && previous.cantine)) continue
        await upsertStudentIdentity(studentId, { ...previous, gardeMidi: true, cantine: true })
        updated += 1
      }
      return { created: 0, updated }
    },
  }
}

// ---------- Dispatcher ----------

export async function parseImportFile(file: File, type: ImportType): Promise<ParseResult> {
  const buf = await file.arrayBuffer()
  const workbook = XLSX.read(buf, { type: 'array', cellDates: true })

  if (type === 'edt') return parseEdt(workbook, file.name)

  const aoa = readSheetAoa(workbook, workbook.SheetNames[0])
  switch (type) {
    case 'eleves':
      return parseEleves(aoa)
    case 'enseignants':
      return parseEnseignants(aoa)
    case 'absences':
      return parseAbsences(aoa)
    case 'notes':
      return parseNotes(aoa)
    case 'garde_repas':
      return parseGardeRepas(aoa)
  }
}
