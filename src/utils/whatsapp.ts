import { demandeurLabel, type RendezVousRecord } from '../data/studentDetails'
import { JOUR_LABELS, JOUR_LABELS_AR, type JourSoutien } from '../data/soutien'
import { formatDH, libelleMois } from './clubsFinance'

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

/** `confirmation` : première annonce du soutien aux parents ; `changement` : le jour ou l'heure a changé, ils doivent confirmer à nouveau ;
 * `annulation` : une ou plusieurs séances n'ont pas lieu (aucune réponse à donner). */
export type SoutienMessageKind = 'confirmation' | 'changement' | 'annulation'

export interface SoutienWhatsAppInfo {
  /** Nom du parent destinataire ; vide → « Bonjour, ». */
  parentNom: string
  studentName: string
  /** Nom de l'élève en arabe ; à défaut le nom français est repris dans la version arabe. */
  studentNameAr?: string
  classe: string
  matiere: string
  matiereAr?: string
  jour: JourSoutien
  heureDebut: string
  heureFin: string
  /** AAAA-MM-JJ : prochaine date où la séance a lieu. */
  aPartirDu: string
  /** AAAA-MM-JJ : dernière semaine, absente quand la période est ouverte. */
  jusquAu?: string | null
  enseignant?: string
  salle?: string
  /** L'élève prend normalement le transport du soir. */
  aTransportSoir: boolean
  ligneSoir?: string | null
  /** HH:MM : départ du transport du soir. */
  heureDepart?: string
  /** AAAA-MM-JJ : séances annulées (message d'annulation). */
  datesAnnulees?: string[]
  /** AAAA-MM-JJ : prochaine séance qui a bien lieu, annoncée dans le message d'annulation. */
  prochaine?: string | null
}

function minutesDe(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Vrai si la séance se termine après le départ du transport (l'élève qui reste le manque). */
function finApresLeCar(info: SoutienWhatsAppInfo): boolean {
  return !!info.heureDepart && minutesDe(info.heureFin) > minutesDe(info.heureDepart)
}

/** « lundi 12/10 » : un jour de séance et sa date, sans l'année. */
function jourEtDate(jour: JourSoutien, iso: string, ar = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return `${ar ? JOUR_LABELS_AR[jour] : JOUR_LABELS[jour].toLowerCase()} ${m ? `${m[3]}/${m[2]}` : iso}`
}

function buildAnnulationFr(info: SoutienWhatsAppInfo): string {
  const eleve = `*${info.studentName}*${info.classe ? ` (${info.classe})` : ''}`
  const dates = (info.datesAnnulees ?? []).map((d) => `*${jourEtDate(info.jour, d)}*`)
  const lines = [info.parentNom.trim() ? `Bonjour ${info.parentNom.trim()},` : 'Bonjour,', '']
  lines.push(
    dates.length > 1
      ? `Les séances de soutien scolaire en *${info.matiere}* de ${eleve} prévues les ${dates.join(', ')} (de ${info.heureDebut} à ${info.heureFin}) sont annulées.`
      : `La séance de soutien scolaire en *${info.matiere}* de ${eleve} prévue le ${dates[0] ?? ''} (de ${info.heureDebut} à ${info.heureFin}) est annulée.`
  )
  lines.push(
    '',
    info.aTransportSoir
      ? `Votre enfant prendra donc le transport du soir comme d'habitude${info.ligneSoir ? ` (ligne ${info.ligneSoir}${info.heureDepart ? `, départ à ${info.heureDepart}` : ''})` : ''}.`
      : 'Il n\'y a donc pas de soutien ce jour-là.'
  )
  if (info.prochaine) lines.push('', `La prochaine séance a lieu le ${dateCourte(info.prochaine)}.`)
  lines.push(...SIGNATURE)
  return lines.join('\n')
}

function buildAnnulationAr(info: SoutienWhatsAppInfo): string {
  const nom = info.studentNameAr?.trim() || info.studentName
  const eleve = `*${nom}*${info.classe ? ` (${info.classe})` : ''}`
  const matiere = info.matiereAr?.trim() || info.matiere
  const dates = (info.datesAnnulees ?? []).map((d) => `*${jourEtDate(info.jour, d, true)}*`)
  const lines = [info.parentNom.trim() ? `السلام عليكم ${info.parentNom.trim()}،` : 'السلام عليكم،', '']
  lines.push(
    dates.length > 1
      ? `نحيطكم علما بأن حصص الدعم المدرسي في مادة *${matiere}* للتلميذ(ة) ${eleve} المبرمجة أيام ${dates.join('، ')} (من ${info.heureDebut} إلى ${info.heureFin}) ملغاة.`
      : `نحيطكم علما بأن حصة الدعم المدرسي في مادة *${matiere}* للتلميذ(ة) ${eleve} المبرمجة يوم ${dates[0] ?? ''} (من ${info.heureDebut} إلى ${info.heureFin}) ملغاة.`
  )
  lines.push(
    '',
    info.aTransportSoir
      ? `وبالتالي سيستقل التلميذ(ة) حافلة النقل المدرسي مساءً كالمعتاد${info.ligneSoir ? ` (الخط ${info.ligneSoir}${info.heureDepart ? `، الانطلاق على الساعة ${info.heureDepart}` : ''})` : ''}.`
      : 'وبالتالي لا يوجد دعم مدرسي في هذا اليوم.'
  )
  if (info.prochaine) lines.push('', `الحصة المقبلة بتاريخ ${dateCourte(info.prochaine)}.`)
  lines.push(...SIGNATURE_AR)
  return lines.join('\n')
}

function buildSoutienMessageFr(kind: SoutienMessageKind, info: SoutienWhatsAppInfo): string {
  if (kind === 'annulation') return buildAnnulationFr(info)
  const eleve = `*${info.studentName}*${info.classe ? ` (${info.classe})` : ''}`
  const lines = [info.parentNom.trim() ? `Bonjour ${info.parentNom.trim()},` : 'Bonjour,', '']
  if (kind === 'confirmation') {
    lines.push(`Votre enfant ${eleve} est inscrit(e) au soutien scolaire en *${info.matiere}*.`)
  } else {
    lines.push(`Le créneau du soutien scolaire de ${eleve} en *${info.matiere}* a été modifié.`)
  }
  lines.push('', `*${kind === 'changement' ? 'Nouveau créneau' : 'Séance'} :* chaque ${JOUR_LABELS[info.jour].toLowerCase()} de ${info.heureDebut} à ${info.heureFin}`)
  lines.push(`*À partir du :* ${dateCourte(info.aPartirDu)}${info.jusquAu ? ` jusqu'au ${dateCourte(info.jusquAu)}` : ''}`)
  if (info.enseignant) lines.push(`*Enseignant :* ${info.enseignant}`)
  if (info.salle) lines.push(`*Salle :* ${info.salle}`)
  if (info.aTransportSoir) {
    lines.push(
      '',
      `Votre enfant prend le transport du soir${info.ligneSoir ? ` (ligne ${info.ligneSoir}${info.heureDepart ? `, départ à ${info.heureDepart}` : ''})` : ''}.` +
        `${finApresLeCar(info) ? ` Le soutien se termine à ${info.heureFin}, après le départ du transport.` : ''}` +
        ' *S\'il reste au soutien, le transport du soir ne sera pas assuré par le service transport.*'
    )
  }
  if (kind === 'changement') lines.push('', 'Ce changement annule votre réponse précédente : merci de nous confirmer à nouveau.')
  lines.push(
    '',
    info.aTransportSoir
      ? 'Merci de nous répondre à ce message : *RESTE* si votre enfant reste au soutien, ou *TRANSPORT* s\'il prend le transport comme d\'habitude.'
      : 'Merci de nous répondre à ce message : *OUI* si votre enfant reste au soutien, ou *NON* dans le cas contraire.'
  )
  lines.push(...SIGNATURE)
  return lines.join('\n')
}

/** Version arabe du message de soutien. Le nom de l'élève, de l'enseignant et la matière gardent leur écriture saisie
 * (l'arabe est repris des fiches quand il existe) ; seul le texte du modèle est traduit. */
function buildSoutienMessageAr(kind: SoutienMessageKind, info: SoutienWhatsAppInfo): string {
  if (kind === 'annulation') return buildAnnulationAr(info)
  const nom = info.studentNameAr?.trim() || info.studentName
  const eleve = `*${nom}*${info.classe ? ` (${info.classe})` : ''}`
  const matiere = info.matiereAr?.trim() || info.matiere
  const lines = [info.parentNom.trim() ? `السلام عليكم ${info.parentNom.trim()}،` : 'السلام عليكم،', '']
  if (kind === 'confirmation') {
    lines.push(`تم تسجيل التلميذ(ة) ${eleve} في حصص الدعم المدرسي في مادة *${matiere}*.`)
  } else {
    lines.push(`تم تغيير موعد حصة الدعم المدرسي للتلميذ(ة) ${eleve} في مادة *${matiere}*.`)
  }
  lines.push('', `*${kind === 'changement' ? 'الموعد الجديد' : 'الحصة'} :* كل ${JOUR_LABELS_AR[info.jour]} من ${info.heureDebut} إلى ${info.heureFin}`)
  lines.push(`*ابتداءً من :* ${dateCourte(info.aPartirDu)}${info.jusquAu ? ` إلى غاية ${dateCourte(info.jusquAu)}` : ''}`)
  if (info.enseignant) lines.push(`*الأستاذ(ة) :* ${info.enseignant}`)
  if (info.salle) lines.push(`*القاعة :* ${info.salle}`)
  if (info.aTransportSoir) {
    lines.push(
      '',
      `التلميذ(ة) يستفيد من حافلة النقل المدرسي مساءً${info.ligneSoir ? ` (الخط ${info.ligneSoir}${info.heureDepart ? `، الانطلاق على الساعة ${info.heureDepart}` : ''})` : ''}.` +
        `${finApresLeCar(info) ? ` تنتهي الحصة على الساعة ${info.heureFin}، أي بعد انطلاق الحافلة.` : ''}` +
        ' *في حال بقائه في حصة الدعم، لن تتكفل مصلحة النقل المدرسي بنقله مساءً.*'
    )
  }
  if (kind === 'changement') lines.push('', 'هذا التغيير يلغي جوابكم السابق، لذا يرجى تأكيد قراركم من جديد.')
  lines.push(
    '',
    info.aTransportSoir
      ? 'يرجى الرد على هذه الرسالة : *يبقى* إذا كان سيبقى في حصة الدعم، أو *النقل* إذا كان سيستقل الحافلة كالمعتاد.'
      : 'يرجى الرد على هذه الرسالة : *نعم* إذا كان سيبقى في حصة الدعم، أو *لا* في الحالة المعاكسة.'
  )
  lines.push(...SIGNATURE_AR)
  return lines.join('\n')
}

/** Message aux parents sur le soutien scolaire, dans la langue choisie ; « both » met le français puis l'arabe, séparés par un filet. */
export function buildSoutienMessage(kind: SoutienMessageKind, info: SoutienWhatsAppInfo, lang: ReclamationMessageLang = 'fr'): string {
  if (lang === 'ar') return buildSoutienMessageAr(kind, info)
  const fr = buildSoutienMessageFr(kind, info)
  return lang === 'both' ? `${fr}\n\n──────────\n\n${buildSoutienMessageAr(kind, info)}` : fr
}


export interface SoutienTransportLigne {
  ligne: string
  eleves: { name: string; classe: string }[]
}

/**
 * Message en arabe pour l'équipe transport (chauffeur, aide-maîtresse ou groupe) : élèves qui restent au soutien ce soir
 * et ne prendront donc pas le transport, ligne par ligne — pour que le transport n'attende pas un élève qui ne viendra pas.
 */
export function buildSoutienTransportMessage(info: { date: string; lignes: SoutienTransportLigne[] }): string {
  const jour = jourDeSemaineAr(info.date)
  const lignes: string[] = []
  info.lignes.forEach((l) => {
    lignes.push(`خط ${l.ligne} :`)
    l.eleves.forEach((e) => lignes.push(`- ${e.name} (${e.classe})`))
    lignes.push('')
  })
  return [
    'السلام عليكم،',
    '',
    `نحيطكم علما بأن التلاميذ التالية أسماؤهم سيبقون بالمؤسسة يوم ${jour ? `${jour} ` : ''}${formatDateDDMMYYYY(info.date)} لحضور حصة الدعم المدرسي، ولن يستقلوا حافلة النقل هذا المساء :`,
    '',
    ...lignes,
    'شكرا لتفهمكم.',
    'مجموعة مدارس موندريان',
  ].join('\n')
}

function jourDeSemaineAr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const jours: (JourSoutien | null)[] = [null, 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', null]
  const j = jours[d.getDay()]
  return j ? JOUR_LABELS_AR[j] : ''
}

// ───────────────────────── Relance des mensualités des clubs ─────────────────────────

export interface ClubRelanceLigne {
  eleve: string
  club: string
  /** AAAA-MM-01 */
  mois: string
  resteCentimes: number
}

export interface ClubRelanceWhatsAppInfo {
  /** Parent à qui on écrit (vide = formule neutre). */
  parentNom: string
  lignes: ClubRelanceLigne[]
}

const MOIS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر']

function moisAr(mois: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(mois)
  return m ? `${MOIS_AR[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : mois
}

function montantAr(centimes: number): string {
  return formatDH(centimes).replace(/ DH$/, ' درهم')
}

function buildClubRelanceFr(info: ClubRelanceWhatsAppInfo): string {
  const total = info.lignes.reduce((n, l) => n + l.resteCentimes, 0)
  const lines = [info.parentNom.trim() ? `Bonjour ${info.parentNom.trim()},` : 'Bonjour,', '']
  lines.push('Nous revenons vers vous au sujet des clubs de votre enfant. Selon nos registres, les mensualités suivantes restent à régler :', '')
  info.lignes.forEach((l) => lines.push(`- *${l.eleve}* — ${l.club}, ${libelleMois(l.mois)} : ${formatDH(l.resteCentimes)}`))
  lines.push('', `*Total à régler : ${formatDH(total)}*`, '')
  lines.push("Merci de passer régler cette somme auprès de l'administration. Si le paiement a déjà été effectué, merci de nous le signaler afin que nous corrigions nos registres.")
  lines.push(...SIGNATURE)
  return lines.join('\n')
}

function buildClubRelanceAr(info: ClubRelanceWhatsAppInfo): string {
  const total = info.lignes.reduce((n, l) => n + l.resteCentimes, 0)
  const lines = ['السلام عليكم،', '']
  lines.push('نعود إليكم بخصوص أندية ابنكم (ابنتكم). حسب سجلاتنا، الأقساط الشهرية التالية لم تُسدَّد بعد :', '')
  info.lignes.forEach((l) => lines.push(`- *${l.eleve}* — ${l.club}، ${moisAr(l.mois)} : ${montantAr(l.resteCentimes)}`))
  lines.push('', `*المبلغ الإجمالي المستحق : ${montantAr(total)}*`, '')
  lines.push('نرجو منكم المرور إلى الإدارة لتسوية هذا المبلغ. وإذا كان الأداء قد تم بالفعل، نرجو إشعارنا بذلك حتى نصحح سجلاتنا.')
  lines.push(...SIGNATURE_AR)
  return lines.join('\n')
}

/** Relance d'une famille pour ses mensualités de clubs en retard, dans la langue choisie ; « both » met le français puis l'arabe. */
export function buildClubRelanceMessage(info: ClubRelanceWhatsAppInfo, lang: ReclamationMessageLang = 'fr'): string {
  if (lang === 'ar') return buildClubRelanceAr(info)
  const fr = buildClubRelanceFr(info)
  return lang === 'both' ? `${fr}\n\n──────────\n\n${buildClubRelanceAr(info)}` : fr
}
