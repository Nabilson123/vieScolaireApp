import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Student } from '../data/students'
import { searchStudents } from '../utils/studentSearch'

interface StudentSearchSelectProps {
  students: Student[]
  /** Identifiant de l'élève choisi ('' = aucun). */
  value: string
  onChange: (studentId: string) => void
  /** Classe de référence : ses élèves sont proposés d'emblée ; la recherche, elle, couvre toutes les classes. */
  classe?: string
  placeholder?: string
  disabled?: boolean
}

const inputClass =
  'w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50'

/** Menu de sélection d'un élève avec recherche : on tape une partie du nom (ou de la classe) et la liste se réduit. */
export default function StudentSearchSelect({ students, value, onChange, classe, placeholder = 'Rechercher un élève...', disabled }: StudentSearchSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = students.find((s) => s.id === value)
  const results = useMemo(() => searchStudents(students, query, { preferredClasse: classe }), [students, query, classe])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
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
        className={inputClass}
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

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            {query.trim()
              ? `${results.length} élève${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''} (toutes classes)`
              : classe
                ? `Élèves de ${classe} — tapez pour chercher dans toutes les classes`
                : 'Tapez un nom ou une classe'}
          </p>
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400">Aucun élève trouvé.</p>
          ) : (
            <ul ref={listRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
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
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${s.classe === classe ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                    {s.classe}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
