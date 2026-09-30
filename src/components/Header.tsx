import { useState } from 'react'
import { Plus, Download, Printer, Globe, GraduationCap, CalendarClock } from 'lucide-react'
import { useSchoolIdentity } from '../services/schoolIdentityService'
import type { PeriodPresetKey } from '../utils/period'
import SignalerAbsenceModal from './SignalerAbsenceModal'
import PeriodRangeFilter from './PeriodRangeFilter'
import { useIsViewedYearEditable } from '../services/viewedYear'

interface HeaderProps {
  activeTab: string
  onTabChange: (tab: string) => void
  onDataChanged?: () => void
  periodStart: string
  periodEnd: string
  periodPreset: PeriodPresetKey | null
  onPeriodPresetChange: (key: PeriodPresetKey) => void
  onPeriodDatesChange: (start: string, end: string) => void
  onDownloadReport: () => void
  onExportExcel: () => void
}

const tabs = [
  { key: 'global', label: 'Vue Globale', icon: Globe },
  { key: 'pedagogie', label: 'Pédagogie & Discipline', icon: GraduationCap },
  { key: 'agenda', label: 'Agenda & RDV', icon: CalendarClock },
]

export default function Header({
  activeTab,
  onTabChange,
  onDataChanged,
  periodStart,
  periodEnd,
  periodPreset,
  onPeriodPresetChange,
  onPeriodDatesChange,
  onDownloadReport,
  onExportExcel,
}: HeaderProps) {
  const { data: identity } = useSchoolIdentity()
  const isEditable = useIsViewedYearEditable()
  const [showSignalModal, setShowSignalModal] = useState(false)

  return (
    <div className="mb-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Vue d'ensemble analytique de l'établissement — {identity?.nom ?? ''}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodRangeFilter
            periodStart={periodStart}
            periodEnd={periodEnd}
            onDatesChange={onPeriodDatesChange}
            presetKey={periodPreset}
            onPresetChange={onPeriodPresetChange}
          />

          <button
            type="button"
            onClick={() => setShowSignalModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Signalement
          </button>

          <button
            type="button"
            onClick={onDownloadReport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Rapport PDF
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {showSignalModal && (
        <SignalerAbsenceModal
          onClose={() => setShowSignalModal(false)}
          onSaved={() => onDataChanged?.()}
        />
      )}
    </div>
  )
}
