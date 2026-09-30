import { supabase } from '../lib/supabaseClient'
import { getCurrentUserIdSnapshot } from './currentUser'

export interface EnqueueNotificationInput {
  studentId: string
  templateCode: 'absence' | 'retard' | 'incident_disciplinaire'
  variables: { eleve: string; classe: string; date: string; motif: string }
}

interface LinkedParentRow {
  parents: { id: string; email: string } | null
}

/**
 * Enfile une notification "pending" par parent lié à l'élève — pas de vérification des préférences
 * ici (canal souhaité, plage "ne pas déranger") : ce filtrage se fait au moment de l'envoi réel
 * (futur pipeline, non implémenté dans ce chantier), pas à l'enfilement. Si l'élève n'a aucun parent
 * lié, ne fait rien silencieusement (cas normal tant que tous les comptes parents ne sont pas créés).
 *
 * Interroge parent_students/parents directement (pas les snapshots hors-React de parentsService) :
 * ces caches ne sont peuplés que si un écran qui monte useParents()/useParentStudentLinks() a déjà
 * été visité dans la session — jamais garanti depuis un déclencheur comme SignalerAbsenceModal.
 */
export async function enqueueNotification(input: EnqueueNotificationInput): Promise<void> {
  const { data: links, error: linksError } = await supabase
    .from('parent_students')
    .select('parents(id, email)')
    .eq('student_id', input.studentId)
    .returns<LinkedParentRow[]>()
  if (linksError) throw linksError
  if (!links || links.length === 0) return

  const { data: template, error: templateError } = await supabase
    .from('message_templates')
    .select('sujet, corps, canal, actif')
    .eq('code', input.templateCode)
    .single()
  if (templateError) throw templateError
  if (!template.actif) return

  const render = (text: string) =>
    text
      .replaceAll('{{eleve}}', input.variables.eleve)
      .replaceAll('{{classe}}', input.variables.classe)
      .replaceAll('{{date}}', input.variables.date)
      .replaceAll('{{motif}}', input.variables.motif || '—')

  const createdBy = getCurrentUserIdSnapshot()

  const rows = links
    .map((link) => link.parents)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((parent) => ({
      parent_id: parent.id,
      student_id: input.studentId,
      template_code: input.templateCode,
      canal: template.canal,
      destinataire: parent.email,
      rendered_subject: render(template.sujet),
      rendered_body: render(template.corps),
      created_by: createdBy,
    }))

  if (rows.length === 0) return
  const { error } = await supabase.from('notification_queue').insert(rows)
  if (error) throw error
}
