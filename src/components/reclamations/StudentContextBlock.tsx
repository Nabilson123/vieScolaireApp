import { useMemo } from 'react'
import { useStudentExtras } from '../../services/studentDetailsService'
import { defaultExtra } from '../../data/studentDetails'
import { CONTEXTE_FENETRE_JOURS, computeStudentContext } from '../../utils/reclamationsContexte'

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) {
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-sm font-bold ${tone === 'warn' ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

/** Ce qu'il faut savoir de l'élève avant de répondre à sa famille : assiduité, comportement, résultats et autres
 * réclamations. Lecture seule, calculée à partir de la fiche élève. */
export default function StudentContextBlock({ studentId, classe, excludeId }: { studentId: string; classe: string; excludeId?: string }) {
  const { data: extras } = useStudentExtras()
  const ctx = useMemo(() => computeStudentContext(extras?.[studentId] ?? defaultExtra, classe, excludeId), [extras, studentId, classe, excludeId])

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Contexte de l'élève</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile
          label={`Absences · ${CONTEXTE_FENETRE_JOURS} j`}
          value={String(ctx.absences)}
          sub={ctx.absences > 0 ? `dont ${ctx.absencesNonJustifiees} non justifiée${ctx.absencesNonJustifiees > 1 ? 's' : ''}` : undefined}
        />
        <Tile label={`Retards · ${CONTEXTE_FENETRE_JOURS} j`} value={String(ctx.retards)} />
        <Tile label={`Incidents · ${CONTEXTE_FENETRE_JOURS} j`} value={String(ctx.incidents)} sub="discipline" tone={ctx.incidents > 0 ? 'warn' : undefined} />
        <Tile label="Conduite" value={`${ctx.conduite}/20`} />
        <Tile label="Moyenne générale" value={ctx.moyenne ? `${ctx.moyenne.value.toFixed(1).replace('.', ',')}/${ctx.moyenne.scale}` : '—'} />
        <Tile
          label="Autres réclamations"
          value={String(ctx.autresReclamations.total)}
          sub={ctx.autresReclamations.total > 0 ? `${ctx.autresReclamations.ouvertes} ouverte${ctx.autresReclamations.ouvertes > 1 ? 's' : ''}` : undefined}
          tone={ctx.autresReclamations.ouvertes > 0 ? 'warn' : undefined}
        />
      </div>
    </div>
  )
}
