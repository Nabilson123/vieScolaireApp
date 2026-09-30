import SchoolLogo from '../print/SchoolLogo'
import { teacherName, type Teacher } from '../../data/teachers'

interface PrintableTeacherReportProps {
  teachers: Teacher[]
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableTeacherReport({ teachers }: PrintableTeacherReportProps) {
  return (
    <div id="printable-teacher-report" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-3 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">Registre des Enseignants</p>
          <p className="text-[10px] text-slate-500">Édité le {todayFR()}</p>
        </div>
      </header>

      <div className="mb-3 text-[10px] text-slate-600">
        Total : <span className="font-semibold text-slate-800">{teachers.length}</span> enseignant(s)
      </div>

      <table className="mb-1 w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 pr-2 font-semibold">Nom</th>
            <th className="py-1 pr-2 font-semibold">Matière(s)</th>
            <th className="py-1 pr-2 font-semibold">Statut</th>
            <th className="py-1 pr-2 font-semibold">Type</th>
            <th className="py-1 pr-2 font-semibold">Classes</th>
            <th className="py-1 font-semibold">Contact</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id} className="border-b border-slate-100">
              <td className="py-1 pr-2">{teacherName(t)}</td>
              <td className="py-1 pr-2">{t.matieres.join(', ')}</td>
              <td className="py-1 pr-2">{t.statut}</td>
              <td className="py-1 pr-2">{t.type}</td>
              <td className="py-1 pr-2">{t.classes.join(', ')}</td>
              <td className="py-1">{t.email}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {teachers.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Aucun enseignant ne correspond aux filtres sélectionnés.</p>}

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
