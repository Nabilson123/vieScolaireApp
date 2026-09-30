import { useMemo, useState } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuditLog } from '../services/auditLogService'
import { useProfiles } from '../services/profilesService'
import type { AuditLogEntry } from '../data/auditLog'

const ACTION_LABELS: Record<AuditLogEntry['action'], string> = {
  insert: 'Création',
  update: 'Modification',
  delete: 'Suppression',
}

const ACTION_COLORS: Record<AuditLogEntry['action'], string> = {
  insert: 'bg-emerald-50 text-emerald-600',
  update: 'bg-amber-50 text-amber-600',
  delete: 'bg-rose-50 text-rose-600',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function diffFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): { key: string; before: unknown; after: unknown }[] {
  const keys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])
  const rows: { key: string; before: unknown; after: unknown }[] = []
  keys.forEach((key) => {
    const before = oldData?.[key]
    const after = newData?.[key]
    if (JSON.stringify(before) !== JSON.stringify(after)) rows.push({ key, before, after })
  })
  return rows
}

function EntryRow({ entry, actorName }: { entry: AuditLogEntry; actorName: string }) {
  const [expanded, setExpanded] = useState(false)
  const diff = useMemo(() => diffFields(entry.oldData, entry.newData), [entry])

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_COLORS[entry.action]}`}>{ACTION_LABELS[entry.action]}</span>
          <span className="text-sm font-semibold text-slate-800">{entry.tableName}</span>
          <span className="text-xs text-slate-400">#{entry.recordId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{actorName}</span>
          <span>{formatDateTime(entry.createdAt)}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          {diff.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun champ modifié détecté.</p>
          ) : (
            <div className="space-y-1.5">
              {diff.map((d) => (
                <div key={d.key} className="grid grid-cols-[140px_1fr_auto_1fr] items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-600">{d.key}</span>
                  <span className="truncate text-rose-500 line-through">{formatValue(d.before)}</span>
                  <span className="text-slate-300">→</span>
                  <span className="truncate text-emerald-600">{formatValue(d.after)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function JournalAuditGlobal() {
  const { data: entries = [] } = useAuditLog()
  const { data: profiles = [] } = useProfiles()
  const [table, setTable] = useState('')
  const [actor, setActor] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  const tableOptions = useMemo(() => Array.from(new Set(entries.map((e) => e.tableName))).sort(), [entries])
  const actorName = (actorId: string | null) => {
    if (!actorId) return 'Système'
    return profiles.find((p) => p.id === actorId)?.nomComplet || 'Utilisateur supprimé'
  }

  const filtered = entries.filter((e) => {
    if (table && e.tableName !== table) return false
    if (actor && e.actorId !== actor) return false
    const day = e.createdAt.slice(0, 10)
    if (dateStart && day < dateStart) return false
    if (dateEnd && day > dateEnd) return false
    return true
  })

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Journal d'Audit
          <History className="h-6 w-6 text-slate-800" />
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Historique des écritures staff sur les données sensibles (élèves, comptes parents, profils & permissions, circulaires).
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Table</label>
          <select value={table} onChange={(e) => setTable(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
            <option value="">Toutes</option>
            {tableOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Acteur</label>
          <select value={actor} onChange={(e) => setActor(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
            <option value="">Tous</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nomComplet}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Du</label>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Au</label>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none" />
        </div>
        <p className="ml-auto text-xs text-slate-400">{filtered.length} entrée{filtered.length > 1 ? 's' : ''}</p>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucune entrée pour ces filtres.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <EntryRow key={entry.id} entry={entry} actorName={actorName(entry.actorId)} />
          ))}
        </div>
      )}
    </div>
  )
}
