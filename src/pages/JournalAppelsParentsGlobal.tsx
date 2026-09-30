import { useState } from 'react'
import { PhoneCall } from 'lucide-react'
import { useAppelsParentsHistory } from '../services/appelsParentsService'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { getClassOptions } from '../data/students'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function JournalAppelsParentsGlobal() {
  useStudents()
  const { data: appels = [] } = useAppelsParentsHistory()
  const [classe, setClasse] = useState('Toutes les classes')
  const [search, setSearch] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')

  const rows = appels.map((a) => {
    const student = getStudentsSnapshot().find((s) => s.id === a.studentId)
    return { ...a, studentName: student?.name ?? 'Élève inconnu', classe: student?.classe ?? '—' }
  })

  const filtered = rows.filter((r) => {
    if (classe !== 'Toutes les classes' && r.classe !== classe) return false
    if (dateStart && r.date < dateStart) return false
    if (dateEnd && r.date > dateEnd) return false
    const q = search.toLowerCase()
    if (
      q &&
      !r.studentName.toLowerCase().includes(q) &&
      !r.markedBy.toLowerCase().includes(q) &&
      !r.parentAppele.toLowerCase().includes(q) &&
      !(r.note ?? '').toLowerCase().includes(q)
    )
      return false
    return true
  })

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Journal d'Appels aux Parents
          <PhoneCall className="h-6 w-6 text-slate-800" />
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Historique des appels passés aux parents suite à une absence, un retard ou un incident disciplinaire.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Rechercher</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Élève, appelé par, note..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Classe</label>
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Toutes les classes</option>
            {realClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Du</label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Au</label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
        </div>
        <p className="ml-auto text-xs text-slate-400">
          {filtered.length} appel{filtered.length > 1 ? 's' : ''}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucun appel enregistré pour ces filtres.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Élève</th>
                <th className="px-4 py-2.5 font-semibold">Classe</th>
                <th className="px-4 py-2.5 font-semibold">Appelé le</th>
                <th className="px-4 py-2.5 font-semibold">Parent joint</th>
                <th className="px-4 py-2.5 font-semibold">Appelé par</th>
                <th className="px-4 py-2.5 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{r.studentName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.classe}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(r.markedAt)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.parentAppele || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.markedBy || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
