import { RECLAMATION_CATEGORIES } from '../data/studentDetails'
import { cleanReclamationText } from './reclamationsLogic'
import { normalizeText, significantTokens } from './textMatch'

export interface IntakeStudent {
  id: string
  name: string
  classe: string
}

export interface IntakeContext {
  students: IntakeStudent[]
  /** Noms complets du personnel enseignant (« Prénom NOM »). */
  teacherNames: string[]
  /** Noms des parents connus d'un élève (fiche identité). */
  parentNamesOf: (studentId: string) => string[]
}

export type Confidence = 'high' | 'low'

export interface IntakeItem {
  category: string
  categoryConfidence: Confidence
  objet: string
  description: string
  concernant: string
  /** `none` = rien trouvé (champ laissé vide). */
  concernantConfidence: Confidence | 'none'
}

export interface IntakeResult {
  items: IntakeItem[]
  /** Élèves dont le nom apparaît dans le message, du plus probable au moins probable. */
  studentCandidates: IntakeStudent[]
  /** Renseigné seulement si un seul élève ressort nettement ; sinon on laisse choisir. */
  studentId: string | null
  parentNom: string
  /** AAAA-MM-JJ trouvé dans le message ou son en-tête WhatsApp. */
  date: string | null
}

// Mots-clés par catégorie, déjà normalisés (sans accents). Un mot-clé est cherché au début d'un mot :
// « harcel » trouve « harcèlement » ; un espace final impose la fin du mot (« bus » ne trouve pas « abus »).
const CATEGORY_KEYWORDS: Record<string, { words: string[]; weight?: number }> = {
  Notes: { words: ['note ', 'notes ', 'moyenne', 'bulletin', 'controle', 'devoir', 'correction', 'bareme'] },
  'Examens / Évaluations': { words: ['examen', 'evaluation', 'epreuve', 'composition', 'surveillance de l examen'] },
  'Absence / Assiduité': { words: ['absence', 'absent', 'retard', 'assiduite', 'justificatif'] },
  Comportement: { words: ['comportement', 'insolen', 'impoli', 'agressi', 'discipline', 'punition', 'sanction', 'frappe', 'bagarre', 'insulte', 'jet', 'bavard', 'viole'] },
  'Harcèlement / Intimidation': { words: ['harcel', 'intimid', 'moqu', 'menace', 'souffre douleur', 'racket', 'persecut'], weight: 2 },
  Cantine: { words: ['cantine', 'repas', 'dejeuner', 'nourriture', 'refectoire', 'plat '] },
  Transport: { words: ['transport', 'bus ', 'chauffeur', 'ramassage', 'navette'] },
  'Infirmerie / Santé': { words: ['infirmerie', 'sante', 'malade', 'blessure', 'blesse', 'medicament', 'allergie', 'fievre', 'douleur'] },
  'Pédagogie / Enseignement': { words: ['pedagog', 'enseignant', 'professeur', 'prof ', 'niveau scolaire', 'programme', 'methode', 'explique'] },
  'Emploi du temps': { words: ['emploi du temps', 'horaire', 'planning'] },
  'Communication / Administration': { words: ['communication', 'administration', 'secretariat', 'injoignable', 'surcharg', 'effectif'] },
  Sécurité: { words: ['securite', 'danger', 'portail', 'accident', 'vol '] },
  'Frais de scolarité / Facturation': { words: ['frais', 'facture', 'paiement', 'scolarite', 'tarif', 'remboursement', 'mensualite'] },
  'Inscription / Admission': { words: ['inscription', 'admission', 'reinscription'] },
  'Activités périscolaires / Sorties': { words: ['sortie', 'activite', 'periscolaire', 'voyage', 'club ', 'sport'] },
  'Uniforme / Tenue vestimentaire': { words: ['uniforme', 'tenue', 'blouse', 'vetement'] },
  'Hygiène / Locaux': { words: ['hygiene', 'toilette', 'sanitaire', 'sale ', 'locaux', 'chauffage', 'climatisation', 'fuite'] },
  'Accueil / Réception': { words: ['accueil', 'reception', 'vigile', 'portier'] },
}

// Services cités sans nom de personne : proposés avec une confiance faible.
const SERVICE_KEYWORDS: { words: string[]; label: string }[] = [
  { words: ['cantine', 'refectoire'], label: 'Personnel de la cantine' },
  { words: ['chauffeur', 'bus ', 'transport', 'ramassage'], label: 'Service de transport' },
  { words: ['secretariat', 'administration', 'direction'], label: 'Administration' },
  { words: ['vigile', 'surveillant', 'accueil'], label: 'Surveillance / Accueil' },
]

/** Nombre d'occurrences des mots-clés, cherchés au début d'un mot du texte normalisé (voir CATEGORY_KEYWORDS) :
 * un mot répété (« le bus … du bus ») pèse davantage qu'un mot cité une fois. */
function countHits(normalizedText: string, words: string[]): number {
  const padded = ` ${normalizedText} `
  let hits = 0
  for (const w of words) {
    const needle = ` ${w}`
    let from = padded.indexOf(needle)
    while (from !== -1) {
      hits += 1
      from = padded.indexOf(needle, from + needle.length)
    }
  }
  return hits
}

export function suggestCategory(text: string): { category: string; confidence: Confidence } {
  const normalized = normalizeText(text)
  const scored = RECLAMATION_CATEGORIES.map((category) => {
    const entry = CATEGORY_KEYWORDS[category]
    return { category, score: entry ? countHits(normalized, entry.words) * (entry.weight ?? 1) : 0 }
  }).sort((a, b) => b.score - a.score)
  const [best, second] = scored
  if (!best || best.score === 0) return { category: 'Autre', confidence: 'low' }
  return { category: best.category, confidence: best.score >= 2 && best.score > (second?.score ?? 0) ? 'high' : 'low' }
}

function wordSet(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter(Boolean))
}

/** Enseignant dont le nom complet figure dans le texte (confiance haute) ; à défaut, un nom de famille
 * unique cité seul (confiance faible). */
function matchTeacher(text: string, teacherNames: string[]): { name: string; confidence: Confidence } | null {
  const words = wordSet(text)
  const full = teacherNames.filter((n) => {
    const tokens = significantTokens(n)
    return tokens.length >= 2 && tokens.every((t) => words.has(t))
  })
  if (full.length === 1) return { name: full[0], confidence: 'high' }
  if (full.length > 1) return { name: full.sort((a, b) => b.length - a.length)[0], confidence: 'low' }
  // Nom de famille seul : le dernier mot significatif du nom, sans ambiguïté entre enseignants.
  const byLast = teacherNames.filter((n) => {
    const tokens = significantTokens(n)
    const last = tokens[tokens.length - 1]
    return !!last && last.length >= 4 && words.has(last)
  })
  if (byLast.length === 1) return { name: byLast[0], confidence: 'low' }
  return null
}

function matchService(text: string): string | null {
  const normalized = normalizeText(text)
  return SERVICE_KEYWORDS.find((s) => countHits(normalized, s.words) > 0)?.label ?? null
}

function matchStudents(text: string, students: IntakeStudent[]): { candidates: IntakeStudent[]; selected: IntakeStudent | null } {
  const words = wordSet(text)
  const scored = students
    .map((student) => {
      const tokens = significantTokens(student.name)
      const matched = tokens.filter((t) => words.has(t)).length
      return { student, tokens: tokens.length, matched, score: tokens.length === 0 ? 0 : matched / tokens.length }
    })
    // Deux mots du nom au moins (un prénom seul est trop courant), sauf pour un nom d'un seul mot.
    .filter((s) => s.matched >= 2 || (s.tokens === 1 && s.matched === 1))
    .sort((a, b) => b.score - a.score || b.matched - a.matched)
  const candidates = scored.slice(0, 5).map((s) => s.student)
  const [best, second] = scored
  const selected = best && best.score === 1 && (!second || second.score < 1) ? best.student : null
  return { candidates, selected }
}

const WHATSAPP_HEADER = /^\s*\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?\]?\s*[-–]?\s*([^:\n]{1,60}):\s*/
const DATE_IN_TEXT = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/

function toISODate(d: string, m: string, y: string): string | null {
  const year = y.length === 2 ? 2000 + Number(y) : Number(y)
  const month = Number(m)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Retire les en-têtes d'export WhatsApp (« [05/10/2026 09:12] Nom : … » ou « 05/10/2026, 09:12 - Nom : … »),
 * en gardant la date du premier message et le nom de son auteur. */
function stripWhatsAppHeaders(raw: string): { text: string; date: string | null; sender: string } {
  let date: string | null = null
  let sender = ''
  const lines = raw.replace(/\r/g, '').split('\n').map((line) => {
    const m = WHATSAPP_HEADER.exec(line)
    if (!m) return line
    if (!date) date = toISODate(m[1], m[2], m[3])
    if (!sender) sender = m[4].trim()
    return line.slice(m[0].length)
  })
  return { text: lines.join('\n'), date, sender }
}

function looksLikePhone(s: string): boolean {
  return /^[+\d\s()-]{6,}$/.test(s)
}

const LABEL_SPLIT = /(?:^|\n)[ \t]*(?:objet|sujet)[ \t]*:[ \t]*/i

function firstSentence(text: string): string {
  const line = text.split('\n').find((l) => l.trim()) ?? ''
  const sentence = line.split(/(?<=[.!?])\s/)[0].trim()
  return sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}…` : sentence
}

/**
 * Analyse un message de parent collé (WhatsApp, e-mail, texte d'assistant IA) et propose les champs d'une
 * ou plusieurs réclamations : objet, description, catégorie, enseignant ou service concerné, élève, parent,
 * date. Règles locales et déterministes — aucune donnée ne quitte l'appli. Tout est une **proposition** à
 * relire : `…Confidence: 'low'` signale ce qu'il faut vérifier, et un élève ambigu n'est jamais choisi seul.
 */
export function parseParentMessage(raw: string, ctx: IntakeContext): IntakeResult {
  const { text: noHeaders, date: headerDate, sender } = stripWhatsAppHeaders(raw)
  const text = noHeaders.replace(/\*\*|__|`/g, '').trim()

  const chunks = text.split(LABEL_SPLIT)
  const hasLabels = chunks.length > 1
  const preamble = hasLabels ? chunks[0] : ''
  const bodies = hasLabels ? chunks.slice(1).filter((c) => c.trim()) : [text]

  const students = matchStudents(text, ctx.students)
  const studentId = students.selected?.id ?? null

  const items: IntakeItem[] = bodies.map((body) => {
    const clean = cleanReclamationText(body)
    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean)
    const objet = hasLabels ? lines[0] ?? '' : firstSentence(clean)
    const description = hasLabels ? (lines.slice(1).join('\n') || objet) : clean
    const scope = `${preamble}\n${body}`
    const category = suggestCategory(scope)
    const teacher = matchTeacher(scope, ctx.teacherNames)
    const service = teacher ? null : matchService(scope)
    return {
      category: category.category,
      categoryConfidence: category.confidence,
      objet,
      description,
      concernant: teacher?.name ?? service ?? '',
      concernantConfidence: teacher ? teacher.confidence : service ? 'low' : 'none',
    }
  })

  let parentNom = ''
  if (studentId) {
    const words = wordSet(text)
    parentNom =
      ctx.parentNamesOf(studentId).find((n) => {
        const tokens = significantTokens(n)
        return tokens.length > 0 && tokens.every((t) => words.has(t))
      }) ?? ''
  }
  if (!parentNom && sender && !looksLikePhone(sender)) parentNom = sender

  const inText = DATE_IN_TEXT.exec(text)
  const date = headerDate ?? (inText ? toISODate(inText[1], inText[2], inText[3]) : null)

  return { items, studentCandidates: students.candidates, studentId, parentNom, date }
}
