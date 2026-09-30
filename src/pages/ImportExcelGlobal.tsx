import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  UploadCloud,
  FileSpreadsheet,
  EyeOff,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  Users,
  Briefcase,
  CalendarDays,
  ClipboardList,
  BookOpen,
  UtensilsCrossed,
} from 'lucide-react'
import { parseImportFile, type ImportType, type ParseResult } from '../utils/excelImport'
import {
  downloadStudentsTemplate,
  downloadStudentsExport,
  downloadTeachersTemplate,
  downloadScheduleTemplate,
  downloadAbsencesTemplate,
  downloadNotesTemplate,
  downloadGardeRepasTemplate,
} from '../utils/excelTemplates'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface ImportExcelGlobalProps {
  onDataChanged: () => void
}

const IMPORT_TYPES: { key: ImportType; label: string }[] = [
  { key: 'eleves', label: 'Élèves' },
  { key: 'enseignants', label: 'Enseignants' },
  { key: 'absences', label: 'Absences & Retards' },
  { key: 'edt', label: 'Emplois du Temps' },
  { key: 'notes', label: 'Notes / Contrôles' },
  { key: 'garde_repas', label: 'Garde Repas' },
]

const TEMPLATES: { key: ImportType; title: string; subtitle: string; icon: typeof Users; download: () => void }[] = [
  { key: 'eleves', title: 'Modèle Élèves', subtitle: 'Identité complète (Massar, parents, cantine...)', icon: Users, download: downloadStudentsTemplate },
  { key: 'enseignants', title: 'Modèle Enseignants', subtitle: 'Nom, Prénom, Téléphone, E-mail, Statut, Code', icon: Briefcase, download: downloadTeachersTemplate },
  { key: 'edt', title: 'Modèle Emplois du Temps', subtitle: '1 fichier = 1 classe (nom du fichier détecté)', icon: CalendarDays, download: downloadScheduleTemplate },
  { key: 'absences', title: 'Modèle Absences & Retards', subtitle: 'Saisie groupée élèves/profs', icon: ClipboardList, download: downloadAbsencesTemplate },
  { key: 'notes', title: 'Modèle Notes / Contrôles', subtitle: 'Notes par élève, matière et contrôle', icon: BookOpen, download: downloadNotesTemplate },
  { key: 'garde_repas', title: 'Modèle Garde Repas', subtitle: 'Code Massar + Nom — active Garde midi et Cantine', icon: UtensilsCrossed, download: downloadGardeRepasTemplate },
]

export default function ImportExcelGlobal({ onDataChanged }: ImportExcelGlobalProps) {
  const queryClient = useQueryClient()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'import').canEdit
  const isEditable = canEditYear && canEditModule
  const [type, setType] = useState<ImportType>('eleves')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [summary, setSummary] = useState<{ created: number; updated: number; errors: number } | null>(null)
  const [committing, setCommitting] = useState(false)
  const [exportingStudents, setExportingStudents] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleExportStudents = async () => {
    setExportingStudents(true)
    try {
      await downloadStudentsExport()
    } finally {
      setExportingStudents(false)
    }
  }

  const okCount = result?.rows.filter((r) => r.status === 'ok').length ?? 0
  const errorCount = result?.rows.filter((r) => r.status === 'error').length ?? 0

  const resetPreview = () => {
    setResult(null)
    setReadError(null)
    setSummary(null)
  }

  const handleTypeChange = (next: ImportType) => {
    setType(next)
    setFileName(null)
    resetPreview()
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setFileName(file.name)
      setResult(null)
      setSummary(null)
      setReadError('Format non supporté. Merci de sélectionner un fichier .xlsx ou .xls.')
      return
    }
    setFileName(file.name)
    setSummary(null)
    setReadError(null)
    setParsing(true)
    try {
      const parsed = await parseImportFile(file, type)
      setResult(parsed)
    } catch {
      setResult(null)
      setReadError("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier Excel valide et correctement structuré.")
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

  const handleConfirm = async () => {
    if (!result) return
    setCommitting(true)
    try {
      const { created, updated, parentsLinked = 0 } = await result.commit()
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      await queryClient.invalidateQueries({ queryKey: ['studentIdentities'] })
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      await queryClient.invalidateQueries({ queryKey: ['classSchedules'] })
      await queryClient.invalidateQueries({ queryKey: ['classScheduleHistory'] })
      if (parentsLinked > 0) {
        await queryClient.invalidateQueries({ queryKey: ['parents'] })
        await queryClient.invalidateQueries({ queryKey: ['parentStudents'] })
      }
      setSummary({ created, updated, errors: errorCount })
      setResult(null)
      setFileName(null)
      if (inputRef.current) inputRef.current.value = ''
      onDataChanged()
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Importation Excel</h1>
          <p className="text-sm text-slate-500">
            Importez vos élèves, enseignants, emplois du temps, absences ou notes directement depuis un fichier Excel.
          </p>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-5 flex flex-wrap gap-2">
        {IMPORT_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTypeChange(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              type === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center rounded-2xl border-2 border-dashed bg-white px-6 py-14 text-center shadow-sm transition-colors ${
              dragOver ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-200'
            }`}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <UploadCloud className="h-7 w-7" />
            </div>
            <p className="mb-1 text-base font-bold text-slate-900">Glissez-déposez votre fichier Excel</p>
            <p className="mb-5 text-sm text-slate-500">Prend en charge les formats .xlsx et .xls</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700"
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
            {fileName && <p className="mt-4 text-xs text-slate-400">Fichier sélectionné : {fileName}</p>}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Download className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-bold text-slate-800">Télécharger des modèles de test</p>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Utilisez ces fichiers Excel pré-configurés pour tester le comportement d'importation de l'application.
            </p>
            <div className="space-y-2">
              {TEMPLATES.map((tpl) => {
                const Icon = tpl.icon
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={tpl.download}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      type === tpl.key ? 'bg-indigo-50/70 ring-1 ring-indigo-100' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-500 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{tpl.title}</p>
                      <p className="truncate text-xs text-slate-500">{tpl.subtitle}</p>
                    </div>
                    <Download className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                )
              })}
            </div>
          </div>

          {type === 'eleves' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-bold text-slate-800">Exporter les élèves actuels</p>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                Télécharge la liste des élèves de l'année consultée avec leurs données déjà enregistrées, dans le même format que le modèle
                d'import — pour corriger une seule colonne (ex. Cantine) sans repartir d'un fichier vierge. Au réimport, seules les cellules
                remplies écrasent la fiche existante : une cellule laissée vide garde sa valeur actuelle.
              </p>
              <button
                type="button"
                onClick={handleExportStudents}
                disabled={exportingStudents}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingStudents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exportingStudents ? 'Génération du fichier…' : 'Télécharger la liste actuelle des élèves'}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          {summary && (
            <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Import terminé : <span className="font-semibold">{summary.created} ajouté(s)</span>
              {summary.updated > 0 && <span className="font-semibold">, {summary.updated} mis à jour</span>}
              {summary.errors > 0 && <span> — {summary.errors} ligne(s) ignorée(s) en erreur.</span>}
            </div>
          )}

          {parsing && (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Analyse du fichier en cours…</p>
            </div>
          )}

          {!parsing && readError && (
            <div className="flex h-80 flex-col items-center justify-center gap-3 px-6 text-center">
              <XCircle className="h-10 w-10 text-rose-400" />
              <p className="text-sm text-rose-600">{readError}</p>
            </div>
          )}

          {!parsing && !readError && !result && !summary && (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-slate-300">
              <EyeOff className="h-10 w-10" />
              <p className="text-sm font-semibold text-slate-400">Aucun aperçu disponible</p>
              <p className="max-w-[220px] text-xs text-slate-400">Glissez un fichier ou téléchargez un modèle pour commencer.</p>
            </div>
          )}

          {!parsing && result && (
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Aperçu de l'import — {fileName}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {okCount} valide{okCount > 1 ? 's' : ''}
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-rose-600">
                      <XCircle className="h-3.5 w-3.5" /> {errorCount} erreur{errorCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="max-h-[420px] flex-1 space-y-1.5 overflow-y-auto pr-1">
                {result.rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucune ligne exploitable trouvée dans ce fichier.</p>}
                {result.rows.map((row) => (
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

              {committing && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-xs font-medium text-indigo-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Import en cours ({okCount} ligne{okCount > 1 ? 's' : ''}, un instant)…
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setFileName(null)
                    if (inputRef.current) inputRef.current.value = ''
                  }}
                  disabled={committing}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={okCount === 0 || !isEditable || committing}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {committing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {committing ? 'Import en cours…' : `Confirmer l'import (${okCount})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
