import { useMemo, useState } from 'react'
import { GraduationCap, CalendarX, Bus, FileText, LogOut, ChevronDown } from 'lucide-react'
import { useCurrentUserId } from '../services/currentUser'
import { useParentStudentLinks } from '../services/parentsService'
import { useStudents } from '../services/studentsService'
import { useSelectedChildId, setSelectedChildId } from '../services/selectedChild'
import ParentPortalNotes from './ParentPortalNotes'
import ParentPortalAbsences from './ParentPortalAbsences'
import ParentPortalTransport from './ParentPortalTransport'
import ParentPortalCirculaires from './ParentPortalCirculaires'

type PortalTab = 'notes' | 'absences' | 'transport' | 'circulaires'

const TABS: { key: PortalTab; label: string; Icon: typeof GraduationCap }[] = [
  { key: 'notes', label: 'Notes', Icon: GraduationCap },
  { key: 'absences', label: 'Absences', Icon: CalendarX },
  { key: 'transport', label: 'Transport', Icon: Bus },
  { key: 'circulaires', label: 'Circulaires', Icon: FileText },
]

function childInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface ParentPortalAppProps {
  onLogout: () => void
}

export default function ParentPortalApp({ onLogout }: ParentPortalAppProps) {
  const parentId = useCurrentUserId()
  const { data: links = [] } = useParentStudentLinks()
  const { data: students = [] } = useStudents()
  const selectedChildId = useSelectedChildId()
  const [tab, setTab] = useState<PortalTab>('notes')

  const myLinks = useMemo(() => links.filter((l) => l.parentId === parentId), [links, parentId])
  const myChildren = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]))
    return myLinks.map((l) => byId.get(l.studentId)).filter((s): s is NonNullable<typeof s> => !!s)
  }, [myLinks, students])

  if (myChildren.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f3f4f8] px-6 text-center">
        <p className="text-sm font-semibold text-slate-700">Aucun enfant lié à ce compte</p>
        <p className="max-w-sm text-sm text-slate-500">Contactez l'établissement pour rattacher votre/vos enfant(s) à ce compte.</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Déconnexion
        </button>
      </div>
    )
  }

  const activeChild = myChildren.find((c) => c.id === selectedChildId) ?? myChildren[0]

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f4f8] pb-16">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            {childInitials(activeChild.name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{activeChild.name}</p>
            <p className="text-xs text-slate-500">{activeChild.classe}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {myChildren.length > 1 && (
            <div className="relative">
              <select
                value={activeChild.id}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 focus:outline-none"
              >
                {myChildren.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Déconnexion"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {tab === 'notes' && <ParentPortalNotes studentId={activeChild.id} />}
        {tab === 'absences' && <ParentPortalAbsences studentId={activeChild.id} parentId={parentId ?? ''} />}
        {tab === 'transport' && <ParentPortalTransport studentId={activeChild.id} />}
        {tab === 'circulaires' && <ParentPortalCirculaires parentId={parentId ?? ''} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              tab === key ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
