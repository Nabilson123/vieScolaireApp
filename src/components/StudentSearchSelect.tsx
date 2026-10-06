import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import type { Student } from '../data/students'
import { searchStudents } from '../utils/studentSearch'

interface StudentSearchSelectProps {
  students: Student[]
  /** Identifiant de l'élève choisi ('' = aucun). */
  value: string
  onChange: (studentId: string) => void
  /** Classe de référence : ses élèves sont proposés d'emblée ; la recherche, elle, couvre toutes les classes fournies. */
  classe?: string
  /** Texte affiché quand aucun élève n'est choisi (ex. « — Non désigné — », « Tous les élèves »). */
  placeholder?: string
  disabled?: boolean
  /** `sm` pour les barres de filtres et les tableaux. */
  size?: 'md' | 'sm'
  /** Classes ajoutées au champ (ex. un liseré d'alerte). */
  inputClassName?: string
}

const SIZE_CLASS = {
  md: 'py-2 pl-9 pr-8 text-sm',
  sm: 'py-1.5 pl-8 pr-7 text-sm',
} as const

const LIST_MAX_HEIGHT = 224
const HEADER_HEIGHT = 28
const DROPDOWN_MIN_WIDTH = 260

interface Anchor {
  left: number
  top: number
  bottom: number
  width: number
}

/** Menu de sélection d'un élève avec recherche : on tape une partie du nom (ou de la classe) et la liste se réduit.
 * La liste s'affiche au-dessus du reste de la page (portail), donc elle n'est jamais coupée par une fenêtre défilante ni un tableau. */
export default function StudentSearchSelect({
  students,
  value,
  onChange,
  classe,
  placeholder = 'Rechercher un élève...',
  disabled,
  size = 'md',
  inputClassName = '',
}: StudentSearchSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = students.find((s) => s.id === value)
  const results = useMemo(() => searchStudents(students, query, { preferredClasse: classe }), [students, query, classe])

  const updateAnchor = () => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setAnchor({ left: r.left, top: r.top, bottom: r.bottom, width: r.width })
  }

  // La liste suit le champ quand la page ou la fenêtre défile.
  useLayoutEffect(() => {
    if (!open) return
    updateAnchor()
    window.addEventListener('scroll', updateAnchor, true)
    window.addEventListener('resize', updateAnchor)
    return () => {
      window.removeEventListener('scroll', updateAnchor, true)
      window.removeEventListener('resize', updateAnchor)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // L'élément en surbrillance reste visible quand on parcourt la liste au clavier.
  useEffect(() => {
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open])

  const choose = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && results[highlighted]) {
        e.preventDefault()
        choose(results[highlighted].id)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation()
        setOpen(false)
      }
    }
  }

  // Sous le champ s'il y a la place, sinon au-dessus.
  const placement = (() => {
    if (!anchor) return null
    const below = window.innerHeight - anchor.bottom - 8
    const above = anchor.top - 8
    const needed = LIST_MAX_HEIGHT + HEADER_HEIGHT
    const openUp = below < Math.min(needed, 200) && above > below
    const width = Math.max(anchor.width, DROPDOWN_MIN_WIDTH)
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))
    return openUp
      ? { left, width, bottom: window.innerHeight - anchor.top + 4, listMax: Math.min(LIST_MAX_HEIGHT, above - HEADER_HEIGHT) }
      : { left, width, top: anchor.bottom + 4, listMax: Math.min(LIST_MAX_HEIGHT, below - HEADER_HEIGHT) }
  })()

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={disabled}
        value={open ? query : (selected?.name ?? '')}
        placeholder={open && selected ? selected.name : placeholder}
        onFocus={() => {
          setOpen(true)
          setQuery('')
          setHighlighted(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlighted(0)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={`w-full rounded-lg border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${SIZE_CLASS[size]} ${inputClassName}`}
      />
      {selected && !disabled && (
        <button
          type="button"
          aria-label="Effacer l'élève"
          onClick={() => {
            onChange('')
            setQuery('')
          }}
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open &&
        placement &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', left: placement.left, width: placement.width, top: 'top' in placement ? placement.top : undefined, bottom: 'bottom' in placement ? placement.bottom : undefined }}
            className="z-[100] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
              {query.trim()
                ? `${results.length} élève${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}${results.length > 0 && students.some((s) => s.classe !== classe) ? ' (toutes classes)' : ''}`
                : classe
                  ? `Élèves de ${classe} — tapez pour chercher dans toutes les classes`
                  : 'Tapez un nom ou une classe'}
            </p>
            {results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-400">Aucun élève trouvé.</p>
            ) : (
              <ul ref={listRef} role="listbox" style={{ maxHeight: placement.listMax }} className="overflow-y-auto py-1">
                {results.map((s, i) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={s.id === value}
                    // mousedown (pas click) : le champ ne doit pas perdre le focus avant que le choix soit pris en compte.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      choose(s.id)
                    }}
                    onMouseEnter={() => setHighlighted(i)}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm ${
                      i === highlighted ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                    } ${s.id === value ? 'font-semibold' : ''}`}
                  >
                    <span className="truncate">{s.name}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        !classe || s.classe === classe ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {s.classe}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
