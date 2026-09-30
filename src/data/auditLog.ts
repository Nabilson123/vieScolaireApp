export interface AuditLogEntry {
  id: string
  tableName: string
  recordId: string
  action: 'insert' | 'update' | 'delete'
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  actorId: string | null
  createdAt: string
}
