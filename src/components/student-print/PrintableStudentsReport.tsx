import SchoolLogo from '../print/SchoolLogo'
import type { Student } from '../../data/students'

interface PrintableStudentsReportProps {
  students: Student[]
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableStudentsReport({ students }: PrintableStudentsReportProps) {
  return (
    <div id="printable-students-report" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-3 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">Fiches Élèves</p>
          <p className="text-[10px] text-slate-500">Édité le {todayFR()}</p>
        </div>
      </header>

      <div className="mb-3 text-[10px] text-slate-600">
        Total : <span className="font-semibold text-slate-800">{students.length}</span> élève(s)
      </div>

      <table className="mb-1 w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 pr-2 font-semibold">Élève</th>
            <th className="py-1 pr-2 font-semibold">Classe</th>
            <th className="py-1 pr-2 font-semibold">Absences</th>
            <th className="py-1 pr-2 font-semibold">Retards</th>
            <th className="py-1 pr-2 font-semibold">Total Heures Manquées</th>
            <th className="py-1 font-semibold">Taux de Présence</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-b border-slate-100">
              <td className="py-1 pr-2">{s.name}</td>
              <td className="py-1 pr-2">{s.classe}</td>
              <td className="py-1 pr-2">
                {s.absencesHeures} ({s.absencesFois}x)
              </td>
              <td className="py-1 pr-2">
                {s.retardsMin} ({s.retardsFois}x)
              </td>
              <td className="py-1 pr-2">{s.totalHeures}</td>
              <td className="py-1">{s.taux.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {students.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Aucun élève ne correspond aux filtres sélectionnés.</p>}

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
