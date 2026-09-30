import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import type { RendezVousRecord } from '../../data/studentDetails'
import PrintableRdvReport from './PrintableRdvReport'
import { printWithFileName, todayFileStamp } from '../print/printFileName'

interface FlatRdv extends RendezVousRecord {
  studentName: string
  classe: string
}

interface RdvPrintPreviewModalProps {
  records: FlatRdv[]
  onClose: () => void
}

export default function RdvPrintPreviewModal({ records, onClose }: RdvPrintPreviewModalProps) {
  return createPortal(
    <div className="print-preview-overlay fixed inset-0 z-50 flex flex-col bg-slate-900/70">
      <div className="print-modal-chrome flex items-center justify-between bg-slate-900 px-6 py-3 shadow-md">
        <div>
          <p className="text-sm font-semibold text-white">Aperçu avant impression</p>
          <p className="text-xs text-slate-400">Rapport des Rendez-vous Parents ({records.length})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printWithFileName(`Rendez-vous_Parents_${todayFileStamp()}`)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="print-scroll-area flex-1 overflow-y-auto py-8">
        <div className="print-pages-wrapper mx-auto flex w-fit flex-col items-center gap-6">
          <PrintableRdvReport records={records} />
        </div>
      </div>
    </div>,
    document.body
  )
}
