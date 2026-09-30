import type { InspectionRecord } from '../../data/inspections'
import { getMention } from '../../data/inspections'
import type { Teacher } from '../../data/teachers'
import { teacherName } from '../../data/teachers'
import { getTeacherExtraSnapshot } from '../../services/teacherExtrasService'
import { formatHeures } from '../../utils/teacherAggregation'

interface PrintableInspectionBilanProps {
  record: InspectionRecord
  teacher: Teacher
}

const MENTION_TEXT_COLOR: Record<string, string> = {
  emerald: 'text-emerald-600',
  sky: 'text-sky-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
}

function appreciation(value: number): string {
  if (value >= 5) return 'Excellente maîtrise'
  if (value >= 4) return 'Très bonne maîtrise'
  if (value >= 3) return 'Maîtrise satisfaisante'
  if (value >= 2) return 'À renforcer'
  if (value >= 1) return 'Insuffisant'
  return 'Non observé'
}

interface CriteriaRow {
  label: string
  score: number
}

export default function PrintableInspectionBilan({ record, teacher }: PrintableInspectionBilanProps) {
  const mention = getMention(record.noteGlobale)

  const rows: CriteriaRow[] = [
    { label: 'Clarté Pédagogique & Structuration', score: record.criteresBase.clarte },
    { label: 'Tenue de Classe & Climat Scolaire', score: record.criteresBase.tenue },
    { label: 'Innovation & Outils Pédagogiques', score: record.criteresBase.innovation },
  ]
  if (record.criteresPP) {
    rows.push(
      { label: 'Suivi & Orientation (Rôle PP)', score: record.criteresPP.suivi },
      { label: 'Relation Familles (Rôle PP)', score: record.criteresPP.relation },
      { label: 'Conseil & Projets (Rôle PP)', score: record.criteresPP.conseil }
    )
  }
  if (record.criteresMaternelle) {
    rows.push(
      { label: 'Éveil & Motricité (Maternelle)', score: record.criteresMaternelle.eveil },
      { label: 'Autonomie & Hygiène (Maternelle)', score: record.criteresMaternelle.autonomie },
      { label: 'Relation Bienveillante (Maternelle)', score: record.criteresMaternelle.relationBienveillante }
    )
  }
  if (record.feedbackParents !== undefined) {
    rows.push({ label: 'Feedback Élèves/Parents', score: record.feedbackParents })
  }

  const statutSpecifique = [record.isPP && 'Professeur Principal', record.isMaternelle && 'Grille Maternelle'].filter(Boolean).join(' · ') || '—'

  const teacherExtra = getTeacherExtraSnapshot(teacher.id)
  const totalAbsenceHeures = teacherExtra.absences.reduce((sum, a) => sum + a.duree, 0)
  const remplacementsCount = teacherExtra.remplacements.length

  return (
    <div id="printable-inspection-bilan" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-3 flex items-start justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold uppercase text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[10px] text-slate-500">Direction des Études & de la Pédagogie</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Bilan d’Inspection N°</p>
          <p className="text-sm font-bold text-indigo-600">{record.id}</p>
        </div>
      </header>

      <div className="mb-4 rounded-lg bg-slate-50 py-3 text-center">
        <p className="text-sm font-bold uppercase text-slate-900">Fiche de Bilan Individuel de l’Enseignant</p>
        <p className="text-[10px] text-slate-500">Évaluation Pédagogique & Rapport de Direction</p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Enseignant Inspecté</p>
          <p className="text-sm font-bold text-slate-900">{teacherName(teacher)}</p>
          <p className="text-indigo-500">{teacher.matieres.join(', ')}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Inspecteur / Évaluateur</p>
          <p className="text-sm font-bold text-slate-900">{record.inspecteur}</p>
          <p className="text-slate-500">Date : {record.date}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between border-y border-slate-200 py-2 text-xs">
        <span>
          Statut Spécifique : <span className="font-semibold text-slate-700">{statutSpecifique}</span>
        </span>
        <span>
          Évaluation Globale :{' '}
          <span className={`rounded-full bg-slate-100 px-2 py-0.5 font-bold ${MENTION_TEXT_COLOR[mention.color]}`}>
            {mention.label} ({record.noteGlobale}/20)
          </span>
        </span>
      </div>

      <p className="mb-4 text-[10px] text-slate-500">
        Assiduité (historique) : <span className="font-semibold text-slate-700">{formatHeures(totalAbsenceHeures)} d’absences</span> ·{' '}
        <span className="font-semibold text-slate-700">
          {remplacementsCount} remplacement{remplacementsCount > 1 ? 's' : ''} effectué{remplacementsCount > 1 ? 's' : ''}
        </span>
      </p>

      <h2 className="mb-1.5 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
        Grille d’Évaluation par Critères
      </h2>
      <table className="mb-4 w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 pr-2 font-semibold">Domaine / Critère</th>
            <th className="py-1 pr-2 font-semibold">Score</th>
            <th className="py-1 font-semibold">Niveau / Appréciation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-b border-slate-100">
              <td className="py-1 pr-2">{r.label}</td>
              <td className="py-1 pr-2 font-semibold text-indigo-600">{r.score}/5</td>
              <td className="py-1 text-slate-600">{appreciation(r.score)}</td>
            </tr>
          ))}
          <tr className="border-b border-slate-300 font-bold">
            <td className="py-1.5 pr-2">Note Globale Évaluée</td>
            <td className="py-1.5 pr-2 text-indigo-700">{record.noteGlobale}/20</td>
            <td className={`py-1.5 ${MENTION_TEXT_COLOR[mention.color]}`}>Mention {mention.label}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mb-1.5 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
        Rapport d’Inspection & Préconisations
      </h2>
      <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-[10px] text-slate-700">{record.rapport}</p>

      {record.autoEvaluation && (
        <>
          <h2 className="mb-1.5 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
            Auto-évaluation du Professeur
          </h2>
          <p className="mb-3 text-[10px] italic text-slate-600">« {record.autoEvaluation} »</p>
        </>
      )}

      {record.formationRecommandee && (
        <p className="mb-3 text-[10px] text-slate-600">
          Formation recommandée : <span className="font-semibold text-slate-800">{record.formationRecommandee}</span>
        </p>
      )}

      {record.pieceJointe && (
        <p className="mb-3 text-[10px] text-slate-500">Pièce jointe : {record.pieceJointe}</p>
      )}

      {record.planProgres.length > 0 && (
        <>
          <h2 className="mb-1.5 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
            Plan de Progrès
          </h2>
          <table className="mb-4 w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="py-1 pr-2 font-semibold">Objectif</th>
                <th className="py-1 pr-2 font-semibold">Échéance</th>
                <th className="py-1 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {record.planProgres.map((p, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{p.objectif}</td>
                  <td className="py-1 pr-2">{p.echeance}</td>
                  <td className="py-1">{p.statut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center">
          <p className="mb-4 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Commentaire de l’Enseignant Inspecté</p>
          <p className="text-[10px] italic text-slate-500">
            {record.commentaireEnseignant ? `« ${record.commentaireEnseignant} »` : 'Signature & Date'}
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center">
          <p className="mb-4 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Cachet & Signature Inspecteur / Direction</p>
          <p className="text-[10px] italic text-slate-500">Groupe Scolaire Mondrian</p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Direction de la Vie Scolaire</p>
        </div>
      </div>
    </div>
  )
}
