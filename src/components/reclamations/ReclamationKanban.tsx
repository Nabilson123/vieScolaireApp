import { useState, type ReactNode } from 'react'
import { GripVertical } from 'lucide-react'
import type { ReclamationRecord } from '../../data/studentDetails'

type Statut = ReclamationRecord['statut']

const COLUMNS: { statut: Statut; title: string; dot: string; header: string }[] = [
  { statut: 'En attente', title: 'En attente', dot: 'bg-slate-400', header: 'text-slate-600' },
  { statut: 'En cours', title: 'En cours', dot: 'bg-amber-500', header: 'text-amber-700' },
  { statut: 'Résolue', title: 'Résolues', dot: 'bg-emerald-500', header: 'text-emerald-700' },
]

interface ReclamationKanbanProps<T> {
  items: T[]
  getKey: (item: T) => string
  getStatut: (item: T) => Statut
  renderCard: (item: T) => ReactNode
  /** Glisser-déposer actif (année éditable et droit de modification). */
  canDrag: boolean
  /** Une carte a été déposée sur une autre colonne. */
  onDropTo: (item: T, target: Statut) => void
}

/**
 * Colonnes En attente / En cours / Résolues en glisser-déposer natif HTML5 (même mécanisme que le Kanban
 * du Helpdesk). Seule la poignée est déplaçable : rendre la carte entière « draggable » empêcherait de
 * sélectionner le texte du champ de résolution. Les boutons de chaque carte restent le chemin clavier et
 * tactile pour changer d'état.
 */
export default function ReclamationKanban<T>({ items, getKey, getStatut, renderCard, canDrag, onDropTo }: ReclamationKanbanProps<T>) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overStatut, setOverStatut] = useState<Statut | null>(null)

  const reset = () => {
    setDragKey(null)
    setOverStatut(null)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const columnItems = items.filter((i) => getStatut(i) === col.statut)
        const isOver = overStatut === col.statut && canDrag
        return (
          <div
            key={col.statut}
            onDragOver={(e) => {
              if (!canDrag || !dragKey) return
              e.preventDefault()
              setOverStatut(col.statut)
            }}
            onDragLeave={() => setOverStatut((prev) => (prev === col.statut ? null : prev))}
            onDrop={(e) => {
              e.preventDefault()
              const item = items.find((i) => getKey(i) === dragKey)
              if (item && getStatut(item) !== col.statut) onDropTo(item, col.statut)
              reset()
            }}
            className={`rounded-2xl border p-3 transition-colors ${isOver ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-100 bg-slate-50/40'}`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className={`flex items-center gap-2 text-sm font-bold ${col.header}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                {col.title}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 shadow-sm">{columnItems.length}</span>
            </div>
            <div className="space-y-3">
              {columnItems.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Aucune réclamation.</p>
              ) : (
                columnItems.map((item) => (
                  <div key={getKey(item)} className={`relative ${dragKey === getKey(item) ? 'opacity-50' : ''}`}>
                    {canDrag && (
                      <div
                        draggable
                        title="Glisser vers une autre colonne"
                        onDragStart={(e) => {
                          const card = e.currentTarget.parentElement
                          if (card) e.dataTransfer.setDragImage(card, 24, 24)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', getKey(item))
                          setDragKey(getKey(item))
                        }}
                        onDragEnd={reset}
                        className="absolute left-1/2 top-1 z-10 flex h-4 w-10 -translate-x-1/2 cursor-grab items-center justify-center rounded-full bg-white/80 text-slate-300 shadow-sm hover:text-slate-500 active:cursor-grabbing"
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </div>
                    )}
                    {renderCard(item)}
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
