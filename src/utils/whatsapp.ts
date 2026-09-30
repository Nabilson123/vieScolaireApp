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
