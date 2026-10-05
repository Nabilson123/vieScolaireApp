import { useState } from 'react'
import { X, MessageSquareWarning, Plus, Trash2, ClipboardPaste } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { RECLAMATION_CATEGORIES } from '../data/studentDetails'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { cleanReclamationText, formatDateFR, todayLocalISO } from '../utils/reclamationsLogic'
import { findSimilarReclamations, type SimilarReclamation } from '../utils/reclamationsDoublons'
import { parseParentMessage, type IntakeContext, type IntakeResult, type IntakeStudent } from '../utils/reclamationsIntake'

const AUTRE_SENTINEL = '__AUTRE__'

interface ReclamationItem {
  category: string
  objet: string
  description: string
  concernantSelect: string
  concernantAutre: string
}

function makeEmptyItem(): ReclamationItem {
  return { category: RECLAMATION_CATEGORIES[0], objet: '', description: '', concernantSelect: '', concernantAutre: '' }
}

interface NewReclamationModalProps {
  onClose: () => void
  onSubmit: (payload: {
    studentId: string
    parentNom: string
    date: string
    items: { category: string; objet: string; description: string; concernant: string }[]
  }) => void
}

export default function NewReclamationModal({ onClose, onSubmit }: NewReclamationModalProps) {
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const staffNames = getTeachersSnapshot()
    .map((t) => teacherName(t))
    .sort((a, b) => a.localeCompare(b))

  const [classe, setClasse] = useState(realClasses[0])
  const [studentId, setStudentId] = useState('')
  const [parentSelect, setParentSelect] = useState('')
  const [parentAutre, setParentAutre] = useState('')
  const [date, setDate] = useState(todayLocalISO())
  const [items, setItems] = useState<ReclamationItem[]>([makeEmptyItem()])

  // --- Saisie par collage : le message du parent est analysé localement, puis chaque champ proposé reste
  // modifiable ; ce qui est incertain est surligné en orange. ---
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [candidates, setCandidates] = useState<IntakeStudent[]>([])
  const [pendingParent, setPendingParent] = useState('')
  const [analysisNote, setAnalysisNote] = useState<string | null>(null)
  const [lowFlags, setLowFlags] = useState<{ student: boolean; items: { category: boolean; concernant: boolean }[] }>({ student: false, items: [] })

  // Avertissement de doublon : réclamations proches déjà enregistrées pour l'élève. Il ne s'affiche qu'une fois
  // l'objet commencé (la catégorie est toujours pré-remplie), et n'empêche jamais d'enregistrer.
  const existingReclamations = studentId ? getStudentExtraSnapshot(studentId).reclamations : []
  const similarOf = (item: ReclamationItem): SimilarReclamation[] =>
    item.objet.trim().length >= 3 ? findSimilarReclamations(existingReclamations, { category: item.category, objet: item.objet }).slice(0, 2) : []

  const parentLabelsOf = (id: string) => {
    const i = getStudentIdentitySnapshot(id)
    return [`${i.parent1Prenom} ${i.parent1Nom}`.trim(), `${i.parent2Prenom} ${i.parent2Nom}`.trim()].filter(Boolean)
  }

  const applyStudent = (student: IntakeStudent, parentSuggestion: string) => {
    setClasse(student.classe)
    setStudentId(student.id)
    setCandidates([])
    const known = parentLabelsOf(student.id)
    if (parentSuggestion && known.includes(parentSuggestion)) {
      setParentSelect(parentSuggestion)
      setParentAutre('')
    } else if (parentSuggestion) {
      setParentSelect(AUTRE_SENTINEL)
      setParentAutre(parentSuggestion)
    } else {
      setParentSelect('')
      setParentAutre('')
    }
    setLowFlags((prev) => ({ ...prev, student: false }))
  }

  const handleAnalyse = () => {
    if (!pasteText.trim()) return
    const ctx: IntakeContext = {
      students: getStudentsSnapshot().map((st) => ({ id: st.id, name: st.name, classe: st.classe })),
      teacherNames: staffNames,
      parentNamesOf: parentLabelsOf,
    }
    const result: IntakeResult = parseParentMessage(pasteText, ctx)
    setItems(
      result.items.length > 0
        ? result.items.map((it) => ({
            category: it.category,
            objet: it.objet,
            description: it.description,
            concernantSelect: !it.concernant ? '' : staffNames.includes(it.concernant) ? it.concernant : AUTRE_SENTINEL,
            concernantAutre: it.concernant && !staffNames.includes(it.concernant) ? it.concernant : '',
          }))
        : [makeEmptyItem()]
    )
    if (result.date) setDate(result.date)
    const selected = result.studentId ? result.studentCandidates.find((c) => c.id === result.studentId) : undefined
    if (selected) {
      applyStudent(selected, result.parentNom)
      setPendingParent('')
    } else {
      setStudentId('')
      setParentSelect('')
      setParentAutre('')
      setCandidates(result.studentCandidates)
      setPendingParent(result.parentNom)
    }
    setLowFlags({
      student: !selected,
      items: result.items.map((it) => ({ category: it.categoryConfidence === 'low', concernant: it.concernantConfidence === 'low' })),
    })
    const n = result.items.length
    const studentNote = selected
      ? 'Élève reconnu.'
      : result.studentCandidates.length > 0
        ? 'Plusieurs élèves possibles : choisissez-en un.'
        : 'Aucun élève reconnu : choisissez-le dans la liste.'
    setAnalysisNote(`${n} réclamation${n > 1 ? 's' : ''} proposée${n > 1 ? 's' : ''}. ${studentNote} Vérifiez les champs avant d'enregistrer — ceux surlignés en orange sont incertains.`)
  }

  const flagClass = (flag?: boolean) => (flag ? ' border-amber-400 bg-amber-50/60 ring-1 ring-amber-300' : '')

  const elevesDeLaClasse = getStudentsSnapshot().filter((s) => s.classe === classe)

  const identity = studentId ? getStudentIdentitySnapshot(studentId) : null
  const parentOptions = identity
    ? [
        { key: 'parent1', label: `${identity.parent1Prenom} ${identity.parent1Nom}`.trim() },
        { key: 'parent2', label: `${identity.parent2Prenom} ${identity.parent2Nom}`.trim() },
      ].filter((p) => p.label)
    : []
  const parentNom = parentSelect === AUTRE_SENTINEL ? parentAutre.trim() : parentSelect

  const updateItem = (index: number, patch: Partial<ReclamationItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  const addItem = () => setItems((prev) => [...prev, makeEmptyItem()])
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index))

  const isValid = !!studentId && items.every((it) => it.objet.trim() && it.description.trim())

  const handleSubmit = () => {
    if (!isValid) return
    onSubmit({
      studentId,
      parentNom,
      date,
      items: items.map((it) => ({
        category: it.category,
        objet: it.objet.trim(),
        description: it.description.trim(),
        concernant: it.concernantSelect === AUTRE_SENTINEL ? it.concernantAutre.trim() : it.concernantSelect,
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageSquareWarning className="h-5 w-5 text-rose-500" />
            Nouvelle Réclamation
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3">
            <button
              type="button"
              onClick={() => setPasteOpen((v) => !v)}
              className="flex w-full items-center gap-2 text-left text-sm font-semibold text-indigo-700"
            >
              <ClipboardPaste className="h-4 w-4" />
              Coller le message du parent
              <span className="ml-auto text-xs font-normal text-indigo-400">{pasteOpen ? 'Masquer' : 'Remplir automatiquement'}</span>
            </button>
            {pasteOpen && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={4}
                  placeholder="Collez ici le message reçu (WhatsApp, e-mail...). L'analyse se fait sur cet appareil, rien n'est envoyé ailleurs."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAnalyse}
                  disabled={!pasteText.trim()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Analyser le message
                </button>
              </div>
            )}
            {analysisNote && <p className="mt-2 text-xs text-slate-600">{analysisNote}</p>}
            {candidates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyStudent(c, pendingParent)}
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    {c.name} · {c.classe}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classe</label>
              <select
                value={classe}
                onChange={(e) => {
                  setClasse(e.target.value)
                  setStudentId('')
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {realClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élève concerné</label>
              <select
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value)
                  setParentSelect('')
                  setParentAutre('')
                  setLowFlags((prev) => ({ ...prev, student: false }))
                }}
                className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none${flagClass(lowFlags.student)}`}
              >
                <option value="">Sélectionner...</option>
                {elevesDeLaClasse.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Parent réclamant</label>
              <select
                value={parentSelect}
                onChange={(e) => {
                  setParentSelect(e.target.value)
                  if (e.target.value !== AUTRE_SENTINEL) setParentAutre('')
                }}
                disabled={!studentId}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{studentId ? 'Sélectionner...' : "Choisissez d'abord un élève"}</option>
                {parentOptions.map((p) => (
                  <option key={p.key} value={p.label}>
                    {p.label}
                  </option>
                ))}
                <option value={AUTRE_SENTINEL}>Autre / Non renseigné...</option>
              </select>
              {parentSelect === AUTRE_SENTINEL && (
                <input
                  type="text"
                  value={parentAutre}
                  onChange={(e) => setParentAutre(e.target.value)}
                  placeholder="ex : Tuteur légal, Grand-mère..."
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs text-slate-500">
              Un même appel peut porter sur plusieurs sujets distincts — ajoutez une réclamation par sujet.
            </p>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Réclamation {idx + 1}</p>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Catégorie</label>
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(idx, { category: e.target.value })}
                        className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none${flagClass(lowFlags.items[idx]?.category)}`}
                      >
                        {RECLAMATION_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Objet</label>
                      <input
                        type="text"
                        value={item.objet}
                        onChange={(e) => updateItem(idx, { objet: e.target.value })}
                        placeholder="ex : Contestation note de Contrôle 1..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                      />
                    </div>

                    {similarOf(item).length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <p className="font-semibold">Une réclamation proche existe déjà pour cet élève</p>
                        <ul className="mt-1 space-y-0.5">
                          {similarOf(item).map((s) => (
                            <li key={s.reclamation.id}>
                              « {cleanReclamationText(s.reclamation.objet)} » — reçue le {formatDateFR(s.reclamation.date)}, {s.reclamation.statut.toLowerCase()}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-amber-700">Vérifiez qu'il ne s'agit pas du même sujet. Vous pouvez enregistrer quand même.</p>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
                      <textarea
                        value={item.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        rows={3}
                        placeholder="Détail de la réclamation formulée par les parents..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Concernant</label>
                      <select
                        value={item.concernantSelect}
                        onChange={(e) => {
                          updateItem(idx, { concernantSelect: e.target.value, concernantAutre: e.target.value === AUTRE_SENTINEL ? item.concernantAutre : '' })
                        }}
                        className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none${flagClass(lowFlags.items[idx]?.concernant)}`}
                      >
                        <option value="">Sélectionner...</option>
                        {staffNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value={AUTRE_SENTINEL}>Autre / Personnel non-enseignant...</option>
                      </select>
                      {item.concernantSelect === AUTRE_SENTINEL && (
                        <input
                          type="text"
                          value={item.concernantAutre}
                          onChange={(e) => updateItem(idx, { concernantAutre: e.target.value })}
                          placeholder="ex : Personnel cantine, Surveillant, Direction..."
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50/50"
            >
              <Plus className="h-4 w-4" />
              Ajouter une réclamation
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {items.length > 1 ? `Enregistrer (${items.length})` : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
