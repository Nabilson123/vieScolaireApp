import type { Student } from '../../data/students'
import type { CantineInfo } from '../../data/studentDetails'
import SchoolLogo from '../print/SchoolLogo'

export type CantineReportVariant = 'securite' | 'refectoire'

interface PrintableCantineReportProps {
  title: string
  subtitle: string
  variant: CantineReportVariant
  rows: { student: Student; cantine: CantineInfo }[]
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableCantineReport({ title, subtitle, variant, rows }: PrintableCantineReportProps) {
  return (
    <div id="printable-cantine-report" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-4 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">{title}</p>
          <p className="text-[10px] text-slate-500">{subtitle}</p>
          <p className="text-[10px] text-slate-500">Édité le {todayFR()}</p>
        </div>
      </header>

      <div className="mb-3 text-[10px] text-slate-600">
        Total : <span className="font-semibold text-slate-800">{rows.length}</span> élève(s)
      </div>

      {variant === 'securite' ? (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Élève</th>
              <th className="py-1 pr-2 font-semibold">Classe</th>
              <th className="py-1 pr-2 font-semibold">Consigne</th>
              <th className="py-1 pr-2 font-semibold">Décharge</th>
              <th className="py-1 font-semibold">Responsables habilités</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, cantine }) => (
              <tr key={student.id} className="border-b border-slate-100 align-top">
                <td className="py-1.5 pr-2 font-semibold">{student.name}</td>
                <td className="py-1.5 pr-2">{student.classe}</td>
                <td className="py-1.5 pr-2">
                  {cantine.interdictionSortie ? `Maintien jusqu'à ${cantine.interdictionHoraire}` : cantine.modaliteSortie}
                </td>
                <td className="py-1.5 pr-2">{cantine.dechargeSignee ? `Signée (${cantine.dechargeDate})` : 'NON SIGNÉE'}</td>
                <td className="py-1.5">
                  {cantine.responsables.length === 0
                    ? '—'
                    : cantine.responsables.map((r) => `${r.name} (${r.relation}) · ${r.phone}`).join(' / ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Élève</th>
              <th className="py-1 pr-2 font-semibold">Classe</th>
              <th className="py-1 pr-2 font-semibold">Alerte PAI</th>
              <th className="py-1 pr-2 font-semibold">Emplacement trousse</th>
              <th className="py-1 font-semibold">Besoins réfectoire</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, cantine }) => (
              <tr key={student.id} className="border-b border-slate-100 align-top">
                <td className="py-1.5 pr-2 font-semibold">{student.name}</td>
                <td className="py-1.5 pr-2">{student.classe}</td>
                <td className="py-1.5 pr-2 text-rose-600">{cantine.alertePAI ?? '—'}</td>
                <td className="py-1.5 pr-2">{cantine.emplacementTrousse ?? '—'}</td>
                <td className="py-1.5">
                  {[cantine.rechauffage && 'Micro-ondes', cantine.conservation && 'Frigo'].filter(Boolean).join(' + ') || 'Aucun'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rows.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Aucun élève ne correspond aux filtres sélectionnés.</p>}

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
