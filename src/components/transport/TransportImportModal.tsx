import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Download, Loader2, EyeOff } from 'lucide-react'
import { parseTransportImportFile, type TransportImportRow } from '../../utils/transportImport'
import { downloadTransportTemplate } from '../../utils/excelTemplates'

interface TransportImportModalProps {
  lignesCollegeNoms: string[]
  onClose: () => void
  onConfirm: (accepted: { studentId: string; ligne: string }[]) => void
}

export default function TransportImportModal({ lignesCollegeNoms, onClose, onConfirm }: TransportImportModalProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<TransportImportRow[] | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const okRows = rows?.filter((r) => r.status === 'ok') ?? []
  const errorCount = rows?.filter((r) => r.status === 'error').length ?? 0

  const handleFile = async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setFileName(file.name)
      setRows(null)
      setReadError('Format non supporté. Merci de sélectionner un fichier .xlsx ou .xls.')
      return
    }
    setFileName(file.name)
    setReadError(null)
    setDone(null)
    setParsing(true)
    try {
      const parsed = await parseTransportImportFile(file, lignesCollegeNoms)
      setRows(parsed.rows)
    } catch {
      setRows(null)
      setReadError("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier Excel valide, avec les colonnes « Élève » et « Ligne ».")
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const handleConfirm = () => {
    onConfirm(okRows.map((r) => ({ studentId: r.studentId!, ligne: r.ligne! })))
    setDone(okRows.length)
    setRows(null)
    setFileName(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
            Importer les affectations transport
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {done !== null && (
            <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Import terminé : <span className="font-semibold">{done} élève(s) affecté(s)</span>.
            </div>
          )}

          <button
            type="button"
            onClick={downloadTransportTemplate}
            className="mb-4 flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-500 shadow-sm">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">Télécharger le modèle</p>
              <p className="text-xs text-slate-500">Colonnes : Élève (nom complet exact), Ligne (A à E)</p>
            </div>
          </button>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragOver ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-200'
            }`}
          >
            <UploadCloud className="mb-2 h-6 w-6 text-indigo-400" />
            <p className="mb-3 text-xs text-slate-500">Glissez-déposez votre fichier Excel, ou</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Choisir un fichier
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            {fileName && <p className="mt-3 text-xs text-slate-400">Fichier sélectionné : {fileName}</p>}
          </div>

          {parsing && (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Analyse du fichier en cours…</p>
            </div>
          )}

          {!parsing && readError && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <XCircle className="h-8 w-8 text-rose-400" />
              <p className="text-sm text-rose-600">{readError}</p>
            </div>
          )}

          {!parsing && !readError && !rows && (
            <div className="flex h-24 flex-col items-center justify-center gap-2 text-slate-300">
              <EyeOff className="h-6 w-6" />
              <p className="text-xs">Aucun aperçu disponible.</p>
            </div>
          )}

          {!parsing && rows && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Aperçu — {fileName}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {okRows.length} valide{okRows.length !== 1 ? 's' : ''}
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-rose-600">
                      <XCircle className="h-3.5 w-3.5" /> {errorCount} erreur{errorCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucune ligne exploitable dans ce fichier.</p>}
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${row.status === 'ok' ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}
                  >
                    {row.status === 'ok' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-slate-700">{row.summary}</p>
                      {row.error && <p className="text-xs text-rose-500">{row.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
          {rows && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={okRows.length === 0}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmer l'import ({okRows.length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
