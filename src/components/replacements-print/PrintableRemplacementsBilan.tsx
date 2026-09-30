import SchoolLogo from '../print/SchoolLogo'
import { formatHeures } from '../../utils/teacherAggregation'
import { formatPeriodLabel } from '../../utils/period'
import { computeClasseMatiereBreakdown, type FlatRemplacement, type EquiteRow, type RemplacementGlobalStats } from '../../utils/replacementAggregation'
import { teacherName } from '../../data/teachers'

interface PrintableRemplacementsBilanProps {
  periodStart: string
  periodEnd: string
  stats: RemplacementGlobalStats
  equite: EquiteRow[]
  historique: FlatRemplacement[]
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableRemplacementsBilan({
  periodStart,
  periodEnd,
  stats,
  equite,
  historique,
}: PrintableRemplacementsBilanProps) {
  const classeMatiereBreakdown = computeClasseMatiereBreakdown(historique)

  return (
    <div id="printable-remplacements-bilan" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-3 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">Bilan des Remplacements</p>
          <p className="text-[10px] text-slate-500">Édité le {todayFR()}</p>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-[10px] text-slate-600">
        <span>
          Période : <span className="font-semibold text-slate-800">{formatPeriodLabel(periodStart, periodEnd)}</span>
        </span>
        <span>
          Remplacements assurés : <span className="font-semibold text-slate-800">{stats.totalRemplacements}</span>
        </span>
        <span>
          Volume horaire total : <span className="font-semibold text-slate-800">{formatHeures(stats.totalHeures)}</span>
        </span>
        <span>
          Professeurs mobilisés : <span className="font-semibold text-slate-800">{stats.profsMobilises}</span>
        </span>
        <span>
          Absences couvertes (profs) : <span className="font-semibold text-slate-800">{stats.profsAbsentsCouverts}</span>
        </span>
      </div>

      <h2 className="mb-1 text-center text-xs font-bold text-rose-600">Classes & Matières Impactées par les Absences</h2>
      {classeMatiereBreakdown.length === 0 ? (
        <p className="mb-3 text-[10px] italic text-slate-400">Aucune absence enregistrée sur cette période.</p>
      ) : (
        <table className="mb-3 w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Classe</th>
              <th className="py-1 pr-2 font-semibold">Matière</th>
              <th className="py-1 pr-2 text-center font-semibold">Absences</th>
              <th className="py-1 pr-2 font-semibold">Profs Absents</th>
              <th className="py-1 pr-2 font-semibold">Remplaçant(s)</th>
              <th className="py-1 font-semibold">Volume Horaire</th>
            </tr>
          </thead>
          <tbody>
            {classeMatiereBreakdown.map((group) =>
              group.matieres.map((row, idx) => (
                <tr key={`${group.classe}-${row.matiere}`} className="border-b border-slate-100">
                  {idx === 0 && (
                    <td rowSpan={group.matieres.length} className="border-r border-slate-100 py-1 pr-2 align-top font-semibold text-slate-800">
                      {group.classe}
                    </td>
                  )}
                  <td className="py-1 pr-2">{row.matiere}</td>
                  <td className="py-1 pr-2 text-center">{row.count}</td>
                  <td className="py-1 pr-2">{row.profsAbsents.join(', ')}</td>
                  <td className="py-1 pr-2">{row.remplacants.join(', ')}</td>
                  <td className="py-1">{formatHeures(row.heures)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <h2 className="mb-1 text-center text-xs font-bold text-amber-600">Équité des Remplacements</h2>
      {equite.length === 0 ? (
        <p className="mb-3 text-[10px] italic text-slate-400">Aucun remplacement enregistré sur cette période.</p>
      ) : (
        <table className="mb-3 w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Professeur Remplaçant</th>
              <th className="py-1 pr-2 text-center font-semibold">Remplacements</th>
              <th className="py-1 font-semibold">Volume Horaire</th>
            </tr>
          </thead>
          <tbody>
            {equite.map((row) => (
              <tr key={row.teacher.id} className="border-b border-slate-100">
                <td className="py-1 pr-2 font-medium text-slate-800">Prof. {teacherName(row.teacher)}</td>
                <td className="py-1 pr-2 text-center">{row.count}</td>
                <td className="py-1">{formatHeures(row.heures)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-1 text-center text-xs font-bold text-indigo-600">Historique des Remplacements assurés</h2>
      {historique.length === 0 ? (
        <p className="mb-2 text-[10px] italic text-slate-400">Aucun remplacement assuré sur cette période.</p>
      ) : (
        <table className="mb-2 w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Date</th>
              <th className="py-1 pr-2 font-semibold">Classe</th>
              <th className="py-1 pr-2 font-semibold">Matière</th>
              <th className="py-1 pr-2 font-semibold">Professeur Absent</th>
              <th className="py-1 pr-2 font-semibold">Professeur Remplaçant</th>
              <th className="py-1 font-semibold">Volume Horaire</th>
            </tr>
          </thead>
          <tbody>
            {historique.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-1 pr-2 whitespace-nowrap">{r.date}</td>
                <td className="py-1 pr-2 font-medium text-slate-800">{r.classe}</td>
                <td className="py-1 pr-2">{r.matiere}</td>
                <td className="py-1 pr-2">Prof. {r.profRemplace}</td>
                <td className="py-1 pr-2">Prof. {r.remplacantName}</td>
                <td className="py-1">{formatHeures(r.heures)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-auto flex justify-end pt-10 text-xs text-slate-600">
        <div className="w-64 text-center">
          <p className="mb-10 font-semibold text-slate-700">Cachet de l'établissement</p>
          <div className="border-t border-slate-300" />
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
