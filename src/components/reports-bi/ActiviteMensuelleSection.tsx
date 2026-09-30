import { CalendarRange } from 'lucide-react'
import MiniBarChart from './MiniBarChart'

interface MonthPoint {
  label: string
  value: number
}

interface ActiviteMensuelleSectionProps {
  reclamationsParMois: MonthPoint[]
  reclamationsParType: MonthPoint[]
  absencesProfsParMois: MonthPoint[]
  absencesElevesParMois: MonthPoint[]
  retardsElevesParMois: MonthPoint[]
  disciplineElevesParMois: MonthPoint[]
}

export default function ActiviteMensuelleSection({
  reclamationsParMois,
  reclamationsParType,
  absencesProfsParMois,
  absencesElevesParMois,
  retardsElevesParMois,
  disciplineElevesParMois,
}: ActiviteMensuelleSectionProps) {
  // Ne garder que les catégories effectivement utilisées, triées par fréquence — sur 19 catégories
  // possibles (RECLAMATION_CATEGORIES), afficher les 19 labels même à 0 écraserait le graphique.
  const reclamationsParTypeActives = [...reclamationsParType].filter((r) => r.value > 0).sort((a, b) => b.value - a.value)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <CalendarRange className="h-4 w-4 text-indigo-500" />
        Activité Mensuelle — Année Scolaire Consultée
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MiniBarChart title="Réclamations par mois" data={reclamationsParMois} color="#8b5cf6" />
        <MiniBarChart title="Réclamations par type" data={reclamationsParTypeActives} color="#a855f7" horizontal />
        <MiniBarChart title="Absences des professeurs par mois" data={absencesProfsParMois} color="#14b8a6" />
        <MiniBarChart title="Absences des élèves par mois" data={absencesElevesParMois} color="#6366f1" />
        <MiniBarChart title="Retards des élèves par mois" data={retardsElevesParMois} color="#f59e0b" />
        <MiniBarChart title="Problèmes disciplinaires par mois" data={disciplineElevesParMois} color="#f43f5e" />
      </div>
    </div>
  )
}
