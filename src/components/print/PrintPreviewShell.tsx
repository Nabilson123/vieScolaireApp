import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { printWithFileName } from './printFileName'

interface PrintPreviewShellProps {
  subtitle: string
  onClose: () => void
  fileName: string
  title?: string
  printLabel?: string
  extraHeaderActions?: ReactNode
  children: ReactNode
}

export default function PrintPreviewShell({
  subtitle,
  onClose,
  fileName,
  title = 'Aperçu avant impression',
  printLabel = 'Imprimer',
  extraHeaderActions,
  children,
}: PrintPreviewShellProps) {
  return createPortal(
    <div className="print-preview-overlay fixed inset-0 z-50 flex flex-col bg-slate-900/70">
      <div className="print-modal-chrome flex items-center justify-between bg-slate-900 px-6 py-3 shadow-md">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {extraHeaderActions}
          <button
            type="button"
            onClick={() => printWithFileName(fileName)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            <Printer className="h-4 w-4" />
            {printLabel}
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
        <div className="print-pages-wrapper mx-auto flex w-fit flex-col items-center gap-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}
