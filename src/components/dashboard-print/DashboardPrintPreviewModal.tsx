import { useState } from 'react'
import { ListChecks, ChevronDown } from 'lucide-react'
import { formatPeriodLabel } from '../../utils/period'
import PrintableDashboardBilan, { REPORT_SECTIONS, ALL_SECTIONS_VISIBLE, type AdminReportData, type ReportSectionKey } from './PrintableDashboardBilan'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface DashboardPrintPreviewModalProps {
  data: AdminReportData
  onClose: () => void
}

export default function DashboardPrintPreviewModal({ data, onClose }: DashboardPrintPreviewModalProps) {
  const [visibleSections, setVisibleSections] = useState<Record<ReportSectionKey, boolean>>(ALL_SECTIONS_VISIBLE)
  const [showSectionsMenu, setShowSectionsMenu] = useState(false)

  const toggleSection = (key: ReportSectionKey) => {
    setVisibleSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <PrintPreviewShell
      subtitle={`Bilan Général de la Vie Scolaire — ${formatPeriodLabel(data.periodStart, data.periodEnd)}`}
      onClose={onClose}
      fileName={`Bilan_Vie_Scolaire_${sanitizeFileName(formatPeriodLabel(data.periodStart, data.periodEnd))}`}
      extraHeaderActions={
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSectionsMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            <ListChecks className="h-4 w-4" />
            Sections
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {showSectionsMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSectionsMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Sections du rapport
                </p>
                {REPORT_SECTIONS.map((section) => (
                  <label
                    key={section.key}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={visibleSections[section.key]}
                      onChange={() => toggleSection(section.key)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {section.label}
                  </label>
                ))}
                <p className="mt-1 border-t border-slate-100 px-3 pt-1.5 text-[10px] text-slate-400">
                  "Indicateurs Clés" est toujours inclus.
                </p>
              </div>
            </>
          )}
        </div>
      }
    >
      <PrintableDashboardBilan {...data} visibleSections={visibleSections} />
    </PrintPreviewShell>
  )
}
