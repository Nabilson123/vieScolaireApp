import { useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { AlertTriangle, Grid3x3, TrendingUp, Target, ExternalLink } from 'lucide-react'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import type { InspectionRecord } from '../data/inspections'
import {
  buildEvolutionData,
  buildHeatmapRows,
  buildRadarComparisonData,
  buildRadarData,
  getAllPendingObjectives,
  getLatestInspection,
  getTeachersBelowThreshold,
} from '../utils/inspectionAggregation'
import TeacherSearchSelect from './TeacherSearchSelect'

const SOUS_SEUIL_THRESHOLD = 12

function cellColor(v: number | null): string {
  if (v === null) return 'bg-slate-50 text-slate-300'
  if (v >= 4) return 'bg-emerald-100 text-emerald-700'
  if (v >= 3) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

interface InspectionOverviewTabProps {
  onOpenPlanProgres: (record: InspectionRecord) => void
}

export default function InspectionOverviewTab({ onOpenPlanProgres }: InspectionOverviewTabProps) {
  const teachersWithData = getTeachersSnapshot().filter((t) => getLatestInspection(t.id))
  const [selectedId, setSelectedId] = useState(teachersWithData[0]?.id ?? '')
  const selectedTeacher = getTeachersSnapshot().find((t) => t.id === selectedId)
  const latest = selectedTeacher ? getLatestInspection(selectedTeacher.id) : undefined
  const radarData = latest ? buildRadarData(latest) : []
  const comparisonData = latest ? buildRadarComparisonData(latest) : []
  const evolutionData = selectedTeacher ? buildEvolutionData(selectedTeacher.id) : []

  const heatmapRows = buildHeatmapRows()
  const sousSeuil = getTeachersBelowThreshold(SOUS_SEUIL_THRESHOLD)
  const pendingObjectives = getAllPendingObjectives()

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Profil de compétences</h3>
          <div className="w-56">
            <TeacherSearchSelect
              teachers={teachersWithData}
              value={selectedId}
              onChange={setSelectedId}
              size="sm"
              clearable={false}
              placeholder={teachersWithData.length === 0 ? 'Aucun professeur inspecté' : 'Rechercher un enseignant...'}
            />
          </div>
        </div>

        {radarData.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Dernière inspection</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="critere" tick={{ fontSize: 11, fill: '#475569' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Radar dataKey="valeur" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {comparisonData.length > 0 && teachersWithData.length >= 2 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">Positionnement vs Moyenne Établissement</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={comparisonData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="critere" tick={{ fontSize: 11, fill: '#475569' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Radar name={selectedTeacher ? teacherName(selectedTeacher) : 'Prof'} dataKey="prof" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      <Radar name="Moyenne établissement" dataKey="etablissement" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">Aucune donnée d’inspection disponible pour ce professeur.</p>
        )}

        {evolutionData.length > 0 && (
          <div className="mt-4 border-t border-slate-50 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" />
              Évolution de la note globale
            </p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="note" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Grid3x3 className="h-4 w-4 text-slate-400" />
          Heatmap de l’équipe (dernière inspection par professeur)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1.5 pr-3 font-semibold">Professeur</th>
                <th className="px-2 py-1.5 text-center font-semibold">Clarté</th>
                <th className="px-2 py-1.5 text-center font-semibold">Tenue</th>
                <th className="px-2 py-1.5 text-center font-semibold">Innovation</th>
                <th className="px-2 py-1.5 text-center font-semibold">Note /20</th>
              </tr>
            </thead>
            <tbody>
              {heatmapRows.map((row) => (
                <tr key={row.teacher.id} className="border-b border-slate-50">
                  <td className="py-1.5 pr-3 font-medium text-slate-700">{teacherName(row.teacher)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-block w-8 rounded-md py-0.5 font-semibold ${cellColor(row.clarte)}`}>{row.clarte ?? '—'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-block w-8 rounded-md py-0.5 font-semibold ${cellColor(row.tenue)}`}>{row.tenue ?? '—'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-block w-8 rounded-md py-0.5 font-semibold ${cellColor(row.innovation)}`}>{row.innovation ?? '—'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold text-slate-800">{row.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          Professeurs sous le seuil ({SOUS_SEUIL_THRESHOLD}/20)
        </h3>
        {sousSeuil.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucun professeur sous ce seuil actuellement.</p>
        ) : (
          <ul className="space-y-1.5">
            {sousSeuil.map(({ teacher, note }) => (
              <li key={teacher.id} className="flex items-center justify-between rounded-lg bg-rose-50/60 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{teacherName(teacher)}</span>
                <span className="font-bold text-rose-600">{note}/20</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Target className="h-4 w-4 text-indigo-400" />
          Objectifs en cours (tous professeurs)
        </h3>
        {pendingObjectives.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucun objectif en cours actuellement.</p>
        ) : (
          <div className="space-y-1.5">
            {pendingObjectives.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                  item.isLate ? 'bg-rose-50/60' : 'bg-slate-50/60'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-700">{item.objectif}</p>
                  <p className="text-xs text-slate-500">
                    {teacherName(item.teacher)} · Échéance : {item.echeance}
                    {item.isLate && <span className="ml-1.5 font-semibold text-rose-600">En retard</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPlanProgres(item.inspection)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3 w-3" />
                  Voir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
