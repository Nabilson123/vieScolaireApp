import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { ReclamationNote, ReclamationRecord } from '../../data/studentDetails'
import { teacherName } from '../../data/teachers'
import { getTeachersSnapshot } from '../../services/teachersService'
import { useReclamationActions } from '../../hooks/useReclamationActions'
import { findTeacherFor } from './bridges'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Notes réservées à l'équipe : mémoire interne du traitement, et version de l'enseignant cité. Elles ne sont
 * jamais incluses dans un message au parent ni dans le rapport imprimé — c'est dit explicitement à l'écran.
 */
export default function NotesSection({ reclamation, studentId, isEditable }: { reclamation: ReclamationRecord; studentId: string; isEditable: boolean }) {
  const actions = useReclamationActions()
  const teachers = getTeachersSnapshot()
  const matched = findTeacherFor(reclamation.enseignant, teachers)
  const [type, setType] = useState<ReclamationNote['type']>('interne')
  const [enseignant, setEnseignant] = useState(matched ? teacherName(matched) : '')
  const [texte, setTexte] = useState('')
  const [saving, setSaving] = useState(false)

  const notes = [...(reclamation.notes ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1))
  const canSubmit = isEditable && !saving && texte.trim().length > 0 && (type === 'interne' || enseignant.trim().length > 0)

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    const updated = await actions.ajouterNote(studentId, reclamation.id, { type, texte, enseignant: type === 'enseignant' ? enseignant : undefined })
    setSaving(false)
    if (updated) setTexte('')
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-bold text-slate-800">Notes de l'équipe</h3>
      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Lock className="h-3 w-3" />
        Visibles par l'équipe uniquement — jamais envoyées au parent ni imprimées.
      </p>

      {notes.length > 0 && (
        <ul className="mb-3 space-y-2">
          {notes.map((n, i) => (
            <li key={`${n.at}-${i}`} className="rounded-lg border border-yellow-100 bg-yellow-50/60 p-2.5">
              <p className="mb-0.5 text-[11px] font-bold text-yellow-800">{n.type === 'enseignant' ? `Avis de ${n.enseignant ?? "l'enseignant"}` : 'Note interne'}</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{n.texte}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {formatWhen(n.at)}
                {n.auteur ? ` · ${n.auteur}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {isEditable && (
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReclamationNote['type'])}
              aria-label="Type de note"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="interne">Note interne</option>
              <option value="enseignant">Avis de l'enseignant</option>
            </select>
            {type === 'enseignant' && (
              <select
                value={enseignant}
                onChange={(e) => setEnseignant(e.target.value)}
                aria-label="Enseignant"
                className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Quel enseignant ?</option>
                {teachers
                  .map((t) => teacherName(t))
                  .sort((a, b) => a.localeCompare(b))
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={2}
            placeholder={type === 'enseignant' ? "Ce que l'enseignant répond à propos des faits rapportés…" : 'Ce que l’équipe doit savoir sur ce dossier…'}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ajouter la note
            </button>
          </div>
        </div>
      )}
      {actions.error && <p className="mt-2 text-xs text-rose-600">{actions.error}</p>}
    </div>
  )
}
