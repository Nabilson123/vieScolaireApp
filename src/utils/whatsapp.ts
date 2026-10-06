import { demandeurLabel, type RendezVousRecord } from '../data/studentDetails'

const MOROCCO_COUNTRY_CODE = '212'

/** Convertit un numéro marocain local (ex: "0655-456041") au format international attendu par WhatsApp (ex: "212655456041"). */
export function toWhatsAppPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith(MOROCCO_COUNTRY_CODE)) return digits
  if (digits.startsWith('0')) return MOROCCO_COUNTRY_CODE + digits.slice(1)
  return MOROCCO_COUNTRY_CODE + digits
}

/** Construit un lien wa.me qui ouvre WhatsApp avec `message` pré-rempli vers `phone`, ou null si le numéro est vide/invalide. */
export function buildWhatsAppLink(phone: string, message: string): string | null {
  const waPhone = toWhatsAppPhone(phone)
  if (!waPhone) return null
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
}

interface RemplacementWhatsAppInfo {
  teacherName: string
  date: string
  creneau: string
  classe: string
  matiere: string
  consignes?: string
}

function formatDateFR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export function buildRemplacementMessage(info: RemplacementWhatsAppInfo): string {
  const lines = [
    `Bonjour Prof. ${info.teacherName},`,
    '',
    'Vous avez été affecté(e) pour un remplacement :',
    `📅 Date : ${formatDateFR(info.date)}`,
    `🕐 Créneau : ${info.creneau}`,
    `🏫 Classe : ${info.classe}`,
    `📚 Matière : ${info.matiere}`,
  ]
  if (info.consignes) lines.push(`📝 Consignes : ${info.consignes}`)
  lines.push('', 'Merci de confirmer votre disponibilité.', 'Groupe Scolaire Mondrian')
  return lines.join('\n')
}

interface SurveillanceWhatsAppInfo {
  teacherName: string
  date: string
  creneau: string
  classe: string
  matiere: string
  salle: string
  consignes?: string
}

export function buildSurveillanceMessage(info: SurveillanceWhatsAppInfo): string {
  const lines = [
    `Bonjour Prof. ${info.teacherName},`,
    '',
    'Vous avez été affecté(e) comme surveillant(e) pour un examen :',
    `📅 Date : ${formatDateFR(info.date)}`,
    `🕐 Créneau : ${info.creneau}`,
    `🏫 Classe : ${info.classe}`,
    `📚 Matière : ${info.matiere}`,
    `🚪 Salle : ${info.salle}`,
  ]
  if (info.consignes) lines.push(`📝 Consignes : ${info.consignes}`)
  lines.push('', 'Merci de confirmer votre disponibilité.', 'Groupe Scolaire Mondrian')
  return lines.join('\n')
}

interface SurveillanceCreneauInfo {
  date: string
  creneau: string
  classe: string
  matiere: string
  salle: string
}

interface SurveillanceRecapWhatsAppInfo {
  teacherName: string
  creneaux: SurveillanceCreneauInfo[]
}

/** Un seul message récapitulant TOUS les créneaux de surveillance d'un prof pour la période d'examens,
 * plutôt qu'un message séparé par créneau — plus rapide à envoyer et plus clair à recevoir. */
export function buildSurveillanceRecapMessage(info: SurveillanceRecapWhatsAppInfo): string {
  const n = info.creneaux.length
  const lines = [
    `Bonjour Prof. ${info.teacherName},`,
    '',
    `Voici vos ${n} créneau${n > 1 ? 'x' : ''} de surveillance pour la période d'examens :`,
    '',
  ]
  info.creneaux.forEach((c, i) => {
    lines.push(`${i + 1}. 📅 ${formatDateFR(c.date)} — 🕐 ${c.creneau}`)
    lines.push(`   🏫 ${c.classe} · 📚 ${c.matiere} · 🚪 ${c.salle}`)
  })
  lines.push('', 'Merci de confirmer votre disponibilité pour chacun de ces créneaux.', 'Groupe Scolaire Mondrian')
  return lines.join('\n')
}

interface SortieAnticipeeTransportInfo {
  studentName: string
  sexe: 'M' | 'F'
  classe: string
  ligneSoirNom: string | null
  heure: string
  date: string
}

function formatDateDDMMYYYY(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Message en arabe pour le groupe/chauffeur/aide-maîtresse de la ligne du soir d'un élève sorti de
 * façon anticipée — accord au féminin/masculin selon `sexe`, à envoyer pour que le transport
 * n'attende pas inutilement un élève qui ne prendra pas le bus ce soir. */
export function buildSortieAnticipeeTransportMessage(info: SortieAnticipeeTransportInfo): string {
  const ligne = info.ligneSoirNom ? `خط ${info.ligneSoirNom}` : 'خط النقل المخصص له'
  const eleve = info.sexe === 'F' ? 'التلميذة' : 'التلميذ'
  const verbeGhadara = info.sexe === 'F' ? 'غادرت' : 'غادر'
  const verbeLan = info.sexe === 'F' ? 'لن تستقل' : 'لن يستقل'
  return [
    'السلام عليكم،',
    '',
    `نحيطكم علما بأن ${eleve} ${info.studentName} (القسم: ${info.classe}) ${verbeGhadara} المؤسسة اليوم ${formatDateDDMMYYYY(info.date)} على الساعة ${info.heure} في إطار خروج استثنائي، و${verbeLan} حافلة ${ligne} هذا المساء.`,
    '',
    'شكرا لتفهمكم.',
    'مجموعة مدارس موندريان',
  ].join('\n')
}

/** Message en arabe pour informer le transport qu'un élève, déclaré sorti de façon anticipée, est
 * finalement revenu à l'école et reprendra le bus normalement ce soir. */
export function buildRetourSortieAnticipeeTransportMessage(info: SortieAnticipeeTransportInfo): string {
  const ligne = info.ligneSoirNom ? `خط ${info.ligneSoirNom}` : 'خط النقل المخصص له'
  const eleve = info.sexe === 'F' ? 'التلميذة' : 'التلميذ'
  const verbeAda = info.sexe === 'F' ? 'عادت' : 'عاد'
  const verbeSa = info.sexe === 'F' ? 'وستستقل' : 'وسيستقل'
  return [
    'السلام عليكم،',
    '',
    `نحيطكم علما بأن ${eleve} ${info.studentName} (القسم: ${info.classe}) ${verbeAda} إلى المؤسسة اليوم ${formatDateDDMMYYYY(info.date)} على الساعة ${info.heure}، ${verbeSa} حافلة ${ligne} كالمعتاد هذا المساء.`,
    '',
    'شكرا لتفهمكم.',
    'مجموعة مدارس موندريان',
  ].join('\n')
}

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

interface RdvWhatsAppInfo {
  studentName: string
  classe: string
  record: Pick<RendezVousRecord, 'date' | 'heure' | 'duree' | 'motif' | 'enseignants' | 'demandeur' | 'animateur'>
}

/** Récapitulatif d'un rendez-vous parent à coller dans WhatsApp (gras via *…*) : élève, date,
 * demandeur, enseignants concernés, sujet, animateur. Les lignes sans valeur (demandeur, animateur)
 * sont omises plutôt que laissées vides. */
export function buildRdvMessage({ studentName, classe, record: r }: RdvWhatsAppInfo): string {
  const d = new Date(`${r.date}T00:00:00`)
  const dateLongue = Number.isNaN(d.getTime())
    ? r.date
    : `${JOURS_FR[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const lines = ['*Rendez-vous parent*', `*Élève :* ${studentName}${classe ? ` (${classe})` : ''}`, `*Date :* ${dateLongue} à ${r.heure} (${r.duree} min)`]
  const demandeur = demandeurLabel(r.demandeur)
  if (demandeur) lines.push(`*Demandé par :* ${demandeur}`)
  lines.push(
    r.enseignants.length > 0
      ? `*${r.enseignants.length > 1 ? 'Enseignants concernés' : 'Enseignant concerné'} :* ${r.enseignants.join(', ')}`
      : '*Enseignant concerné :* aucun (rencontre avec l’administration)'
  )
  lines.push(`*Sujet :* ${r.motif}`)
  if (r.animateur) lines.push(`*Animé par :* ${r.animateur}`)
  return lines.join('\n')
}

const SCHEDULE_DAY_LABELS: Record<string, string> = { LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi', JEUDI: 'Jeudi', VENDREDI: 'Vendredi' }

interface ScheduleSlotWhatsAppInfo {
  start: string
  end: string
  subject: string
  classe: string
}

/** Emploi du temps hebdomadaire d'un prof, formaté pour WhatsApp — un jour par section, jours sans
 * cours explicitement marqués plutôt qu'omis (pour qu'un jour vide ne passe pas pour un oubli). */
export function buildTeacherScheduleMessage(teacherName: string, scheduleByDay: Record<string, ScheduleSlotWhatsAppInfo[]>): string {
  const lines = [`Bonjour Prof. ${teacherName},`, '', 'Voici votre emploi du temps :']
  Object.keys(SCHEDULE_DAY_LABELS).forEach((day) => {
    const slots = scheduleByDay[day] ?? []
    lines.push('', `📅 ${SCHEDULE_DAY_LABELS[day]}`)
    if (slots.length === 0) {
      lines.push('   Aucun cours')
    } else {
      slots.forEach((s) => lines.push(`   🕐 ${s.start}-${s.end} — ${s.subject} (${s.classe})`))
    }
  })
  lines.push('', 'Groupe Scolaire Mondrian')
  return lines.join('\n')
}

export type ReclamationMessageKind = 'accuse' | 'prise_en_charge' | 'resolution' | 'relance'

export interface ReclamationWhatsAppInfo {
  /** Nom du parent réclamant ; vide → « Bonjour, ». */
  parentNom: string
  studentName: string
  classe: string
  categorie: string
  /** Objet (plusieurs objets : les joindre avant l'appel). */
  objet: string
  /** AAAA-MM-JJ de réception. */
  date: string
  responsable?: string
  /** AAAA-MM-JJ : date à laquelle l'établissement s'engage à revenir vers la famille. */
  echeance?: string
  resolution?: string
  /** Jours accordés pour résoudre (selon le niveau de la réclamation) ; 3 par défaut. */
  delaiJours?: number
}

/** « 24 heures », « 72 heures », « 5 jours » : le délai annoncé à la famille. */
export function delaiLabel(jours: number): string {
  if (jours <= 1) return '24 heures'
  if (jours === 3) return '72 heures'
  return `${jours} jours`
}

/** Phrase d'action adaptée à la catégorie : dit à la famille ce que l'établissement fait réellement. */
const ACTION_PAR_CATEGORIE: Record<string, string> = {
  Notes: "Nous échangeons avec l'enseignant concerné.",
  'Examens / Évaluations': "Nous échangeons avec l'enseignant concerné.",
  'Pédagogie / Enseignement': "Nous échangeons avec l'enseignant concerné.",
  'Absence / Assiduité': "Nous vérifions le dossier d'assiduité de votre enfant.",
  Comportement: "Nous menons les vérifications nécessaires auprès de l'équipe éducative.",
  'Harcèlement / Intimidation': "Nous menons les vérifications nécessaires auprès de l'équipe éducative, en toute confidentialité.",
  Cantine: "Nous échangeons avec l'équipe de la cantine.",
  Transport: 'Nous contactons le service de transport scolaire.',
  'Infirmerie / Santé': "Nous échangeons avec l'infirmerie.",
  Sécurité: 'Nous examinons la situation avec la Direction.',
  'Frais de scolarité / Facturation': 'Nous consultons le service administratif et financier.',
  'Inscription / Admission': 'Nous consultons le service administratif.',
  'Hygiène / Locaux': "Nous transmettons la demande à l'équipe de maintenance.",
}

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function reclamationIntro(info: ReclamationWhatsAppInfo): string[] {
  const hello = info.parentNom.trim() ? `Bonjour ${info.parentNom.trim()},` : 'Bonjour,'
  return [hello, '']
}

const SIGNATURE = ['', 'Cordialement,', 'Direction de la Vie Scolaire — Groupe Scolaire Mondrian']

/** Réponse à copier ou ouvrir dans WhatsApp quand une réclamation parent est reçue, prise en charge ou
 * résolue (gras via *…*, sans emoji — même convention que `buildRdvMessage`). */
function buildReclamationMessageFr(kind: ReclamationMessageKind, info: ReclamationWhatsAppInfo): string {
  const eleve = `${info.studentName}${info.classe ? ` (${info.classe})` : ''}`
  const lines = reclamationIntro(info)
  if (kind === 'accuse') {
    lines.push(
      `Nous avons bien reçu votre réclamation du ${dateCourte(info.date)} concernant ${eleve} : *${info.objet}*.`,
      '',
      `Elle a été transmise à la Direction de la Vie Scolaire et sera traitée sous ${delaiLabel(info.delaiJours ?? 3)}.`
    )
  } else if (kind === 'prise_en_charge') {
    lines.push(
      `Votre réclamation du ${dateCourte(info.date)} concernant ${eleve} (*${info.objet}*) est prise en charge${info.responsable ? ` par ${info.responsable}` : ''}.`
    )
    const action = ACTION_PAR_CATEGORIE[info.categorie]
    if (action) lines.push('', action)
    if (info.echeance) lines.push('', `Nous reviendrons vers vous au plus tard le ${dateCourte(info.echeance)}.`)
  } else if (kind === 'relance') {
    lines.push(
      `Nous revenons vers vous au sujet de votre réclamation du ${dateCourte(info.date)} concernant ${eleve} (*${info.objet}*), pour laquelle une réponse vous a été apportée.`,
      '',
      'La réponse de l\'établissement vous a-t-elle convenu ? Si un point reste à clarifier, répondez simplement à ce message.',
      '',
      'Nous restons à votre disposition.'
    )
  } else {
    lines.push(
      `Suite à votre réclamation du ${dateCourte(info.date)} concernant ${eleve} (*${info.objet}*), voici la réponse de l'établissement :`,
      '',
      info.resolution?.trim() || '(réponse à compléter)',
      '',
      'Nous restons à votre disposition pour tout complément.'
    )
  }
  lines.push(...SIGNATURE)
  return lines.join('\n')
}

/** Langue du message à la famille : français, arabe, ou les deux à la suite. */
export type ReclamationMessageLang = 'fr' | 'ar' | 'both'

/** « 24 ساعة », « 72 ساعة », « 5 أيام » : le délai annoncé à la famille, en arabe. */
export function delaiLabelAr(jours: number): string {
  if (jours <= 1) return '24 ساعة'
  if (jours === 3) return '72 ساعة'
  if (jours === 2) return 'يومان'
  return jours >= 11 ? `${jours} يومًا` : `${jours} أيام`
}

/** Même rôle que ACTION_PAR_CATEGORIE, en arabe. */
const ACTION_PAR_CATEGORIE_AR: Record<string, string> = {
  Notes: 'نتواصل مع الأستاذ(ة) المعني(ة).',
  'Examens / Évaluations': 'نتواصل مع الأستاذ(ة) المعني(ة).',
  'Pédagogie / Enseignement': 'نتواصل مع الأستاذ(ة) المعني(ة).',
  'Absence / Assiduité': 'نراجع سجل غياب التلميذ(ة).',
  Comportement: 'نجري التحريات اللازمة لدى الطاقم التربوي.',
  'Harcèlement / Intimidation': 'نجري التحريات اللازمة لدى الطاقم التربوي في سرية تامة.',
  Cantine: 'نتواصل مع مسؤولي المطعم المدرسي.',
  Transport: 'نتواصل مع مصلحة النقل المدرسي.',
  'Infirmerie / Santé': 'نتواصل مع مصلحة التمريض بالمؤسسة.',
  Sécurité: 'ندرس الوضعية مع إدارة المؤسسة.',
  'Frais de scolarité / Facturation': 'نستشير المصلحة الإدارية والمالية.',
  'Inscription / Admission': 'نستشير المصلحة الإدارية.',
  'Hygiène / Locaux': 'نحيل الطلب إلى فريق الصيانة.',
}

const SIGNATURE_AR = ['', 'مع أطيب التحيات،', 'إدارة الحياة المدرسية — مجموعة مدارس موندريان']

/** Version arabe du message à la famille. L'objet, le nom de l'élève et la solution saisie par l'équipe restent
 * tels qu'ils ont été écrits : seul le texte du modèle est traduit (aucune traduction automatique). */
function buildReclamationMessageAr(kind: ReclamationMessageKind, info: ReclamationWhatsAppInfo): string {
  const eleve = `${info.studentName}${info.classe ? ` (${info.classe})` : ''}`
  const lines = [info.parentNom.trim() ? `السلام عليكم ${info.parentNom.trim()}،` : 'السلام عليكم،', '']
  if (kind === 'accuse') {
    lines.push(
      `لقد توصلنا بشكايتكم بتاريخ ${dateCourte(info.date)} بخصوص التلميذ(ة) ${eleve} : *${info.objet}*.`,
      '',
      `تمت إحالتها إلى إدارة الحياة المدرسية وسيتم معالجتها في أجل أقصاه ${delaiLabelAr(info.delaiJours ?? 3)}.`
    )
  } else if (kind === 'prise_en_charge') {
    lines.push(`شكايتكم بتاريخ ${dateCourte(info.date)} بخصوص التلميذ(ة) ${eleve} (*${info.objet}*) قيد المعالجة${info.responsable ? ` من طرف ${info.responsable}` : ''}.`)
    const action = ACTION_PAR_CATEGORIE_AR[info.categorie]
    if (action) lines.push('', action)
    if (info.echeance) lines.push('', `سنعود إليكم في أجل أقصاه ${dateCourte(info.echeance)}.`)
  } else if (kind === 'relance') {
    lines.push(
      `نعود إليكم بخصوص شكايتكم بتاريخ ${dateCourte(info.date)} بخصوص التلميذ(ة) ${eleve} (*${info.objet}*)، التي سبق أن تلقيتم جوابًا بشأنها.`,
      '',
      'هل كان جواب المؤسسة مناسبًا لكم؟ إذا بقيت نقطة تحتاج إلى توضيح، يرجى الرد على هذه الرسالة.',
      '',
      'نبقى رهن إشارتكم.'
    )
  } else {
    lines.push(
      `على إثر شكايتكم بتاريخ ${dateCourte(info.date)} بخصوص التلميذ(ة) ${eleve} (*${info.objet}*)، إليكم جواب المؤسسة :`,
      '',
      info.resolution?.trim() || '(الجواب قيد الإعداد)',
      '',
      'نبقى رهن إشارتكم لأي توضيح إضافي.'
    )
  }
  lines.push(...SIGNATURE_AR)
  return lines.join('\n')
}

/** Message à la famille dans la langue choisie ; « both » met le français puis l'arabe, séparés par un filet. */
export function buildReclamationMessage(kind: ReclamationMessageKind, info: ReclamationWhatsAppInfo, lang: ReclamationMessageLang = 'fr'): string {
  if (lang === 'ar') return buildReclamationMessageAr(kind, info)
  const fr = buildReclamationMessageFr(kind, info)
  return lang === 'both' ? `${fr}\n\n──────────\n\n${buildReclamationMessageAr(kind, info)}` : fr
}

