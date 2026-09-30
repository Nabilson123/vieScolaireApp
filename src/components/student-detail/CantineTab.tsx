import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CircleAlert,
  Lock,
  Clock,
  UtensilsCrossed,
  Zap,
  Snowflake,
  MapPin,
  History,
  PlusCircle,
} from 'lucide-react'
import type { CantineInfo } from '../../data/studentDetails'
import { updateStudentCantine } from '../../services/studentDetailsService'
import { addPointage, displayFormule } from '../../utils/cantineAggregation'
import CantineInterdictionEditModal from './CantineInterdictionEditModal'
import PointageModal from '../cantine/PointageModal'

export default function CantineTab({
  studentId,
  studentName,
  cantine,
}: {
  studentId: string
  studentName: string
  cantine: CantineInfo
}) {
  const queryClient = useQueryClient()
  const [showInterdiction, setShowInterdiction] = useState(false)
  const [showPointage, setShowPointage] = useState(false)

  const handleSaveInterdiction = async (updated: CantineInfo) => {
    await updateStudentCantine(studentId, updated)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setShowInterdiction(false)
  }

  const handleSavePointage = async (arrivee: string, sortie: string, surveillant: string) => {
    await addPointage(studentId, arrivee, sortie, surveillant)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setShowPointage(false)
  }

  return (
    <div className="space-y-4">
      {cantine.interdictionSortie && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-700">INTERDICTION DE SORTIR DE L'ÉTABLISSEMENT</p>
              <p className="text-xs text-rose-600">{cantine.interdictionMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInterdiction(true)}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <Lock className="h-3.5 w-3.5" />
              Gérer Autorisation
            </button>
            <button
              type="button"
              onClick={() => setShowPointage(true)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Clock className="h-3.5 w-3.5" />
              Pointer Présence / Sortie
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Modalités Lunchbox (Garde Repas)</h3>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
            INSCRIPTION ACTIVE
          </span>
        </div>

        <div className="mb-4 rounded-xl bg-amber-50/60 px-3 py-2">
          <p className="text-xs text-slate-500">Formule souscrite :</p>
          <p className="text-sm font-semibold text-slate-800">{displayFormule(cantine)}</p>
        </div>

        <p className="mb-2 text-xs font-semibold text-slate-500">Besoins logistiques au réfectoire :</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 p-3 text-center">
            <Zap className="mx-auto mb-1 h-4 w-4 text-orange-500" />
            <p className="text-xs text-slate-500">Réchauffage Micro-ondes</p>
            <p className="text-sm font-semibold text-emerald-600">
              {cantine.rechauffage ? 'Oui (Demandé)' : 'Non'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 p-3 text-center">
            <Snowflake className="mx-auto mb-1 h-4 w-4 text-sky-500" />
            <p className="text-xs text-slate-500">Conservation Réfrigérateur</p>
            <p className="text-sm font-semibold text-emerald-600">
              {cantine.conservation ? 'Oui (Demandé)' : 'Non'}
            </p>
          </div>
        </div>
      </div>

      {cantine.alertePAI && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-700">ALERTES SANTÉ & CONSIGNES SANITAIRES (PAI REPAS)</p>
          </div>
          <p className="mb-2 text-sm text-amber-700">⚠️ ALERTE PAI : {cantine.alertePAI}</p>
          {cantine.emplacementTrousse && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-white/60 px-3 py-2 text-xs text-amber-700">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Emplacement Trousse Médicale / Stylo Épipen : {cantine.emplacementTrousse}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">
              Historique Récent des Flux de Sortie & Pointage (10 Derniers Jours)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowPointage(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Pointer Aujourd'hui
          </button>
        </div>

        {cantine.historiqueFlux.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucun flux enregistré récemment.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Arrivée Repas</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Sortie / Maintien
                </th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Surveillant Responsable
                </th>
              </tr>
            </thead>
            <tbody>
              {cantine.historiqueFlux.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 text-sm text-slate-700">{row.date}</td>
                  <td className="py-3 text-sm text-emerald-600">{row.arrivee}</td>
                  <td className="py-3 text-sm text-slate-700">{row.sortie}</td>
                  <td className="py-3 text-sm text-slate-500">{row.surveillant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInterdiction && (
        <CantineInterdictionEditModal cantine={cantine} onClose={() => setShowInterdiction(false)} onSave={handleSaveInterdiction} />
      )}

      {showPointage && (
        <PointageModal studentName={studentName} onClose={() => setShowPointage(false)} onSubmit={handleSavePointage} />
      )}
    </div>
  )
}
