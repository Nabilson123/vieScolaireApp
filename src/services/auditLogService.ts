import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { AuditLogEntry } from '../data/auditLog'
import { getCurrentUserIdSnapshot } from './currentUser'

interface AuditLogRow {
  id: string
  table_name: string
  record_id: string
  action: 'insert' | 'update' | 'delete'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  actor_id: string | null
  created_at: string
}

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action,
    oldData: row.old_data,
    newData: row.new_data,
    actorId: row.actor_id,
    createdAt: row.created_at,
  }
}

export interface LogAuditInput {
  tableName: string
  recordId: string
  action: 'insert' | 'update' | 'delete'
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
}

/**
 * Fonction plate hors-React (même convention que enqueueNotification) : n'importe quel service
 * peut journaliser une écriture sensible sans dépendre d'un hook React. Ne bloque jamais l'action
 * réelle : si aucun acteur n'est résolu (session pas encore hydratée) ou si l'insert échoue, on
 * avale l'erreur silencieusement plutôt que de faire échouer la mutation métier pour un souci de
 * journalisation.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  const actorId = getCurrentUserIdSnapshot()
  if (!actorId) return
  try {
    await supabase.from('audit_log').insert({
      table_name: input.tableName,
      record_id: input.recordId,
      action: input.action,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
      actor_id: actorId,
    })
  } catch {
    // journalisation best-effort — ne doit jamais remonter à l'appelant.
  }
}

const QUERY_KEY = ['auditLog']

async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, table_name, record_id, action, old_data, new_data, actor_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data as AuditLogRow[]).map(rowToEntry)
}

export function useAuditLog(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAuditLog, enabled })
  if (query.data) cachedEntries = query.data
  return query
}

let cachedEntries: AuditLogEntry[] = []

export function getAuditLogSnapshot(): AuditLogEntry[] {
  return cachedEntries
}
