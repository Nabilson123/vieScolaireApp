import { useState } from 'react'
import { X, ClipboardCheck, Star, Paperclip } from 'lucide-react'
import { getTeachersSnapshot } from '../services/teachersService'
import { INSPECTEUR_OPTIONS, computeNote, getMention, type InspectionRecord } from '../data/inspections'
import TeacherSearchSelect from './TeacherSearchSelect'

interface NewInspectionModalProps {
  onClose: () => void
  onSubmit: (data: Omit<InspectionRecord, 'id'>) => void
  initial?: InspectionRecord
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const SLIDER_COLORS = ['accent-indigo-600', 'accent-emerald-600', 'accent-amber-500']

export default function NewInspectionModal({ onClose, onSubmit, initial }: NewInspectionModalProps) {
  const isEdit = !!initial

  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [inspecteur, setInspecteur] = useState(initial?.inspecteur ?? INSPECTEUR_OPTIONS[0])
  const [isPP, setIsPP] = useState(initial?.isPP ?? false)
  const [isMaternelle, setIsMaternelle] = useState(initial?.isMaternelle ?? false)
  const [includeFeedback, setIncludeFeedback] = useState(initial?.feedbackParents !== undefined)

  const [clarte, setClarte] = useState(initial?.criteresBase.clarte ?? 3)
  const [tenue, setTenue] = useState(initial?.criteresBase.tenue ?? 3)
  const [innovation, setInnovation] = useState(initial?.criteresBase.innovation ?? 3)

  const [suivi, setSuivi] = useState(initial?.criteresPP?.suivi ?? 3)
  const [relation, setRelation] = useState(initial?.criteresPP?.relation ?? 3)
  const [conseil, setConseil] = useState(initial?.criteresPP?.conseil ?? 3)

  const [eveil, setEveil] = useState(initial?.criteresMaternelle?.eveil ?? 3)
  const [autonomie, setAutonomie] = useState(initial?.criteresMaternelle?.autonomie ?? 3)
  const [relationBienveillante, setRelationBienveillante] = useState(initial?.criteresMaternelle?.relationBienveillante ?? 3)

  const [feedbackParents, setFeedbackParents] = useState(initial?.feedbackParents ?? 3)

  const [rapport, setRapport] = useState(initial?.rapport ?? '')
  const [autoEvaluation, setAutoEvaluation] = useState(initial?.autoEvaluation ?? '')
  const [formationRecommandee, setFormationRecommandee] = useState(initial?.formationRecommandee ?? '')
  const [pieceJointe, setPieceJointe] = useState(initial?.pieceJointe ?? '')

  const values = [clarte, tenue, innovation]
  if (isPP) values.push(suivi, relation, conseil)
  if (isMaternelle) values.push(eveil, autonomie, relationBienveillante)
  if (includeFeedback) values.push(feedbackParents)
  const noteGlobale = computeNote(values)
  const mention = getMention(noteGlobale)

  const canSubmit = teacherId && rapport.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      teacherId,
      date,
      inspecteur,
      isPP,
      isMaternelle,
      criteresBase: { clarte, tenue, innovation },
      criteresPP: isPP ? { suivi, relation, conseil } : undefined,
      criteresMaternelle: isMaternelle ? { eveil, autonomie, relationBienveillante } : undefined,
      feedbackParents: includeFeedback ? feedbackParents : undefined,
      pieceJointe: pieceJointe.trim() || undefined,
      noteGlobale,
      rapport: rapport.trim(),
      autoEvaluation: autoEvaluation.trim() || undefined,
      formationRecommandee: formationRecommandee.trim() || undefined,
      commentaireEnseignant: initial?.commentaireEnseignant,
      planProgres: initial?.planProgres ?? [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ClipboardCheck className="h-5 w-5 text-indigo-500" />
            {isEdit ? "Modifier l'Inspection & le Rapport" : 'Nouvelle Inspection Pédagogique & Rapport'}
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
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Enseignant à évaluer*</label>
            <TeacherSearchSelect teachers={getTeachersSnapshot()} value={teacherId} onChange={setTeacherId} disabled={isEdit} placeholder="Sélectionner un enseignant..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date de l’inspection</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Inspecteur</label>
              <select
                value={inspecteur}
                onChange={(e) => setInspecteur(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {INSPECTEUR_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm font-semibold text-amber-700">
            <input
              type="checkbox"
              checked={isPP}
              onChange={(e) => setIsPP(e.target.checked)}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
            />
            <Star className="h-3.5 w-3.5" />
            Évaluer en tant que Professeur Principal (PP)
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-pink-100 bg-pink-50/60 px-3 py-2.5 text-sm font-semibold text-pink-700">
            <input
              type="checkbox"
              checked={isMaternelle}
              onChange={(e) => setIsMaternelle(e.target.checked)}
              className="h-4 w-4 rounded border-pink-300 text-pink-600 focus:ring-pink-400"
            />
            Évaluer avec la grille Maternelle (Éveil, Autonomie, Bienveillance)
          </label>

          <Slider label="1. Clarté Pédagogique & Structuration" value={clarte} onChange={setClarte} color={SLIDER_COLORS[0]} />
          <Slider label="2. Tenue de Classe & Discipline" value={tenue} onChange={setTenue} color={SLIDER_COLORS[1]} />
          <Slider label="3. Innovation & Outils Pédagogiques" value={innovation} onChange={setInnovation} color={SLIDER_COLORS[2]} />

          {isPP && (
            <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600">
                <Star className="h-3 w-3" />
                Évaluation Rôle Professeur Principal
              </p>
              <Slider label="Suivi & Orientation" value={suivi} onChange={setSuivi} color={SLIDER_COLORS[0]} />
              <Slider label="Relation Familles" value={relation} onChange={setRelation} color={SLIDER_COLORS[1]} />
              <Slider label="Conseil & Projets" value={conseil} onChange={setConseil} color={SLIDER_COLORS[2]} />
            </div>
          )}

          {isMaternelle && (
            <div className="space-y-3 rounded-lg border border-pink-100 bg-pink-50/30 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-pink-600">Grille Maternelle</p>
              <Slider label="Éveil & Motricité" value={eveil} onChange={setEveil} color={SLIDER_COLORS[0]} />
              <Slider label="Autonomie & Hygiène" value={autonomie} onChange={setAutonomie} color={SLIDER_COLORS[1]} />
              <Slider label="Relation Bienveillante" value={relationBienveillante} onChange={setRelationBienveillante} color={SLIDER_COLORS[2]} />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeFeedback}
              onChange={(e) => setIncludeFeedback(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            />
            Inclure un feedback Élèves/Parents (agrégé, simulé)
          </label>
          {includeFeedback && (
            <Slider label="Feedback Élèves/Parents" value={feedbackParents} onChange={setFeedbackParents} color={SLIDER_COLORS[0]} />
          )}

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-700">Note Globale Estimée :</span>
            <span className="rounded-lg bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
              {noteGlobale}/20 ({mention.label})
            </span>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Rapport d’inspection, Synthèse & Remarques Détaillées*
            </label>
            <textarea
              value={rapport}
              onChange={(e) => setRapport(e.target.value)}
              rows={3}
              placeholder="Saisir les points forts, observations pédagogiques, climat de classe, préconisations et avis de l'inspecteur..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Auto-évaluation du professeur (optionnel)</label>
            <textarea
              value={autoEvaluation}
              onChange={(e) => setAutoEvaluation(e.target.value)}
              rows={2}
              placeholder="Commentaire libre du professeur avant l'inspection..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Formation recommandée (optionnel)</label>
              <input
                type="text"
                value={formationRecommandee}
                onChange={(e) => setFormationRecommandee(e.target.value)}
                placeholder="ex: Différenciation pédagogique"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Pièce jointe (optionnel)</label>
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2">
                <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={pieceJointe}
                  onChange={(e) => setPieceJointe(e.target.value)}
                  placeholder="nom_du_fichier.pdf"
                  className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
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
            disabled={!canSubmit}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer l’Évaluation & le Rapport
          </button>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-white">{value}/5</span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-2 w-full cursor-pointer rounded-full ${color}`}
      />
    </div>
  )
}
