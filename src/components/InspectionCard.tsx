import { Star, Printer, Eye, Pencil, Trash2, Target, MessageSquare, Paperclip, TrendingUp, TrendingDown, Minus, CalendarDays } from 'lucide-react'
import type { InspectionRecord } from '../data/inspections'
import { getMention } from '../data/inspections'
import type { Teacher } from '../data/teachers'
import { teacherName, initials } from '../data/teachers'

const MENTION_STYLES: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
}

interface InspectionCardProps {
  record: InspectionRecord
  teacher: Teacher
  previous?: InspectionRecord
  onEdit: () => void
  onDelete: () => void
  onApercu: () => void
  onImprimer: () => void
  onOpenPlanProgres: () => void
  onOpenCommentaire: () => void
  isEditable: boolean
}

export default function InspectionCard({
  record,
  teacher,
  previous,
  onEdit,
  onDelete,
  onApercu,
  onImprimer,
  onOpenPlanProgres,
  onOpenCommentaire,
  isEditable,
}: InspectionCardProps) {
  const mention = getMention(record.noteGlobale)
  const delta = previous ? record.noteGlobale - previous.noteGlobale : null

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
            {initials(teacherName(teacher))}
          </span>
          <div>
            <p className="text-base font-bold text-slate-900">{teacherName(teacher)}</p>
            <p className="text-xs text-slate-500">{teacher.matieres.join(', ')}</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${MENTION_STYLES[mention.color]}`}>
            {mention.label}
          </span>
          {record.isPP && (
            <span className="mt-1 flex items-center justify-end gap-1 text-[11px] font-bold text-amber-500">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              PROF PRINCIPAL
            </span>
          )}
          <p className="mt-0.5 text-xl font-bold text-slate-900">{record.noteGlobale}/20</p>
        </div>
      </div>

      {delta !== null && (
        <div
          className={`mb-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            delta > 0 ? 'bg-emerald-50 text-emerald-600' : delta < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {delta > 0 ? `+${delta}` : delta} pt{Math.abs(delta) > 1 ? 's' : ''} vs dernière inspection ({previous!.noteGlobale}/20)
        </div>
      )}

      <Bar label="Clarté Pédagogique" value={record.criteresBase.clarte} color="bg-indigo-500" />
      <Bar label="Tenue de classe & Discipline" value={record.criteresBase.tenue} color="bg-emerald-500" />
      <Bar label="Innovation & Outils" value={record.criteresBase.innovation} color="bg-amber-500" />

      {record.criteresPP && (
        <>
          <p className="mb-2 mt-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-500">
            <Star className="h-3 w-3" />
            Évaluation Rôle Professeur Principal
          </p>
          <Bar label="Suivi & Orientation" value={record.criteresPP.suivi} color="bg-indigo-500" />
          <Bar label="Relation Familles" value={record.criteresPP.relation} color="bg-emerald-500" />
          <Bar label="Conseil & Projets" value={record.criteresPP.conseil} color="bg-amber-500" />
        </>
      )}

      {record.criteresMaternelle && (
        <>
          <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-pink-500">Grille Maternelle</p>
          <Bar label="Éveil & Motricité" value={record.criteresMaternelle.eveil} color="bg-indigo-500" />
          <Bar label="Autonomie & Hygiène" value={record.criteresMaternelle.autonomie} color="bg-emerald-500" />
          <Bar label="Relation Bienveillante" value={record.criteresMaternelle.relationBienveillante} color="bg-amber-500" />
        </>
      )}

      {record.feedbackParents !== undefined && (
        <Bar label="Feedback Élèves/Parents" value={record.feedbackParents} color="bg-sky-500" />
      )}

      {record.pieceJointe && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
          <Paperclip className="h-3 w-3" />
          {record.pieceJointe}
        </span>
      )}

      <div className="mt-3 border-t border-slate-50 pt-3">
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <MessageSquare className="h-3 w-3" />
          Synthèse du rapport
        </p>
        <p className="border-l-2 border-slate-200 pl-3 text-sm italic text-slate-600">« {record.rapport} »</p>
        {record.autoEvaluation && (
          <p className="mt-2 border-l-2 border-indigo-200 pl-3 text-xs italic text-indigo-500">
            Auto-évaluation du prof : « {record.autoEvaluation} »
          </p>
        )}
        {record.formationRecommandee && (
          <p className="mt-2 text-xs text-slate-500">
            Formation recommandée : <span className="font-semibold text-slate-700">{record.formationRecommandee}</span>
          </p>
        )}
        {record.commentaireEnseignant && (
          <p className="mt-2 border-l-2 border-emerald-200 pl-3 text-xs italic text-emerald-600">
            Réaction de l’enseignant : « {record.commentaireEnseignant} »
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onImprimer}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimer Bilan (PDF)
        </button>
        <button
          type="button"
          onClick={onApercu}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
        >
          <Eye className="h-3.5 w-3.5" />
          Aperçu
        </button>
        <button
          type="button"
          onClick={onOpenPlanProgres}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Target className="h-3.5 w-3.5" />
          Plan de Progrès ({record.planProgres.length})
        </button>
        <button
          type="button"
          onClick={onOpenCommentaire}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Commentaire Prof
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {record.date} · {record.inspecteur}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={!isEditable}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil className="h-3 w-3" />
            Éditer
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!isEditable}
            className="flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <span>{value}/5</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  )
}
