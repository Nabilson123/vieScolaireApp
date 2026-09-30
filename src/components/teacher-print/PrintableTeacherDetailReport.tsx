import { teacherName, type Teacher } from '../../data/teachers'
import SchoolLogo from '../print/SchoolLogo'
import type { TeacherExtra } from '../../data/teacherExtras'
import {
  computeTeacherStats,
  formatHeures,
  formatFois,
  collectTeacherReclamations,
  collectTeacherRendezVous,
} from '../../utils/teacherAggregation'
import { isWithinPeriod, formatPeriodLabel } from '../../utils/period'

interface PrintableTeacherDetailReportProps {
  teacher: Teacher
  extra: TeacherExtra
  periodStart: string
  periodEnd: string
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableTeacherDetailReport({ teacher, extra, periodStart, periodEnd }: PrintableTeacherDetailReportProps) {
  const stats = computeTeacherStats(extra.absences, extra.remplacements, periodStart, periodEnd)
  const absences = extra.absences.filter((a) => isWithinPeriod(a.date, periodStart, periodEnd))
  const remplacements = extra.remplacements.filter((r) => isWithinPeriod(r.date, periodStart, periodEnd))
  const reclamations = collectTeacherReclamations(teacher, periodStart, periodEnd)
  const rendezVous = collectTeacherRendezVous(teacher, periodStart, periodEnd)
  const periodLabel = formatPeriodLabel(periodStart, periodEnd)

  return (
    <div id="printable-teacher-detail" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-3 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">Rapport Détaillé — Prof. {teacherName(teacher)}</p>
          <p className="text-[10px] text-slate-500">
            {teacher.matieres.join(', ')} · Édité le {todayFR()}
          </p>
        </div>
      </header>

      <div className="mb-3 flex items-center justify-between text-[10px] text-slate-600">
        <span>Période : {periodLabel}</span>
        <span>
          Taux d’assiduité global :{' '}
          <span className="font-bold text-emerald-600">{stats.tauxAssiduite.toFixed(1)}%</span>
        </span>
      </div>

      <h2 className="mb-1.5 mt-1 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
        Assiduité — Absences & Retards
      </h2>
      <p className="mb-1.5 text-[10px] text-slate-600">
        Absences : {formatHeures(stats.absencesHeures)} ({formatFois(stats.absencesFois)}) · Retards : {formatHeures(stats.retardsHeures)} (
        {formatFois(stats.retardsFois)}) · Cumul : {formatHeures(stats.heuresPerdues)}
      </p>
      {absences.length === 0 ? (
        <p className="mb-3 text-[10px] italic text-slate-400">Aucune donnée.</p>
      ) : (
        <table className="mb-3 w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Date</th>
              <th className="py-1 pr-2 font-semibold">Type</th>
              <th className="py-1 pr-2 font-semibold">Classe</th>
              <th className="py-1 pr-2 font-semibold">Durée</th>
              <th className="py-1 pr-2 font-semibold">Statut</th>
              <th className="py-1 font-semibold">Motif</th>
            </tr>
          </thead>
          <tbody>
            {absences.map((a, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-1 pr-2 whitespace-nowrap">{a.date}</td>
                <td className="py-1 pr-2">{a.type}</td>
                <td className="py-1 pr-2">{a.classe}</td>
                <td className="py-1 pr-2">{formatHeures(a.duree)}</td>
                <td className="py-1 pr-2">{a.justified ? 'Justifié' : 'Injustifié'}</td>
                <td className="py-1">{a.motif}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-1.5 mt-1 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
        Réclamations Parents
      </h2>
      {reclamations.length === 0 ? (
        <p className="mb-3 text-[10px] italic text-slate-400">Aucune donnée.</p>
      ) : (
        <table className="mb-3 w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Date</th>
              <th className="py-1 pr-2 font-semibold">Élève</th>
              <th className="py-1 pr-2 font-semibold">Objet</th>
              <th className="py-1 font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody>
            {reclamations.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-1 pr-2 whitespace-nowrap">{r.date}</td>
                <td className="py-1 pr-2">{r.studentName}</td>
                <td className="py-1 pr-2">{r.objet}</td>
                <td className="py-1">{r.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-1.5 mt-1 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
        Rendez-vous Parents
      </h2>
      {rendezVous.length === 0 ? (
        <p className="mb-3 text-[10px] italic text-slate-400">Aucune donnée.</p>
      ) : (
        <table className="mb-3 w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Date</th>
              <th className="py-1 pr-2 font-semibold">Élève</th>
              <th className="py-1 pr-2 font-semibold">Motif</th>
              <th className="py-1 font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rendezVous.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-1 pr-2 whitespace-nowrap">{r.date}</td>
                <td className="py-1 pr-2">{r.studentName}</td>
                <td className="py-1 pr-2">{r.motif}</td>
                <td className="py-1">{r.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-1.5 mt-1 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">
        Remplacements Effectués
      </h2>
      {remplacements.length === 0 ? (
        <p className="text-[10px] italic text-slate-400">Aucune donnée.</p>
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2 font-semibold">Date</th>
              <th className="py-1 pr-2 font-semibold">Classe</th>
              <th className="py-1 pr-2 font-semibold">Matière</th>
              <th className="py-1 pr-2 font-semibold">Professeur remplacé</th>
              <th className="py-1 font-semibold">Heures</th>
            </tr>
          </thead>
          <tbody>
            {remplacements.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-1 pr-2 whitespace-nowrap">{r.date}</td>
                <td className="py-1 pr-2">{r.classe}</td>
                <td className="py-1 pr-2">{r.matiere}</td>
                <td className="py-1 pr-2">{r.profRemplace}</td>
                <td className="py-1">{r.heures}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
