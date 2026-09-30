import SchoolLogo from '../print/SchoolLogo'
import { teacherName } from '../../data/teachers'
import { getTeachersSnapshot } from '../../services/teachersService'
import { getMention } from '../../data/inspections'
import { getLatestInspection } from '../../utils/inspectionAggregation'

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableInspectionConsolidatedReport() {
  const rows = getTeachersSnapshot().map((t) => ({ teacher: t, latest: getLatestInspection(t.id) }))

  return (
    <div id="printable-inspection-consolidated" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-3 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">Rapport Consolidé des Inspections Pédagogiques</p>
          <p className="text-[10px] text-slate-500">Édité le {todayFR()}</p>
        </div>
      </header>

      <table className="mb-1 w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 pr-2 font-semibold">Enseignant</th>
            <th className="py-1 pr-2 font-semibold">Matière(s)</th>
            <th className="py-1 pr-2 font-semibold">Dernière Note</th>
            <th className="py-1 pr-2 font-semibold">Mention</th>
            <th className="py-1 pr-2 font-semibold">Date</th>
            <th className="py-1 font-semibold">Statut PP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ teacher, latest }) => {
            const mention = latest ? getMention(latest.noteGlobale) : null
            return (
              <tr key={teacher.id} className="border-b border-slate-100">
                <td className="py-1 pr-2">{teacherName(teacher)}</td>
                <td className="py-1 pr-2">{teacher.matieres.join(', ')}</td>
                <td className="py-1 pr-2 font-semibold text-indigo-600">{latest ? `${latest.noteGlobale}/20` : '—'}</td>
                <td className="py-1 pr-2">{mention ? mention.label : '—'}</td>
                <td className="py-1 pr-2">{latest ? latest.date : '—'}</td>
                <td className="py-1">{latest?.isPP ? 'Oui' : 'Non'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
