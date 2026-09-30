import { Building2, Video, FileText, PenLine, Clock, MapPin, Pencil, Ban, Trash2, Download } from 'lucide-react'
import type { RendezVousRecord } from '../data/studentDetails'

const MODE_STYLES: Record<RendezVousRecord['mode'], { badge: string; Icon: typeof Building2 }> = {
  Présentiel: { badge: 'bg-purple-50 text-purple-600', Icon: Building2 },
  Virtuel: { badge: 'bg-sky-50 text-sky-600', Icon: Video },
}

const STATUT_STYLES: Record<RendezVousRecord['statut'], string> = {
  Planifié: 'bg-sky-50 text-sky-600',
  Réalisé: 'bg-emerald-50 text-emerald-600',
  Annulé: 'bg-rose-50 text-rose-600',
}

interface RdvCardProps {
  record: RendezVousRecord
  studentName?: string
  classe?: string
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
  onRedigerCR: () => void
  onDownloadCR: () => void
}

export default function RdvCard({ record, studentName, classe, onEdit, onCancel, onDelete, onRedigerCR, onDownloadCR }: RdvCardProps) {
  const modeStyle = MODE_STYLES[record.mode]
  const ModeIcon = modeStyle.Icon
  const isVirtuel = record.mode === 'Virtuel'

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span
            className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${modeStyle.badge}`}
          >
            <ModeIcon className="h-3 w-3" />
            {record.mode}
          </span>
          <p className="text-sm font-bold text-slate-900">{record.motif}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUT_STYLES[record.statut]}`}>
          {record.statut}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
        <Clock className="h-3.5 w-3.5" />
        <span>
          Date : <span className="font-semibold text-slate-700">{record.date}</span> à{' '}
          <span className="font-semibold text-slate-700">{record.heure}</span> ({record.duree} min)
        </span>
        <span className="text-slate-300">|</span>
        <MapPin className="h-3.5 w-3.5" />
        {isVirtuel ? (
          <span>
            Lieu : <span className="font-semibold text-teal-600 underline underline-offset-2">{record.lieu}</span>
          </span>
        ) : (
          <span>
            Lieu : <span className="font-semibold text-slate-700">{record.lieu}</span>
          </span>
        )}
      </div>

      {record.notesParents && (
        <p className="mb-3 border-l-2 border-slate-200 pl-3 text-sm italic text-slate-600">
          « {record.notesParents} »
        </p>
      )}

      {record.compteRendu && (
        <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <FileText className="h-3.5 w-3.5" />
              COMPTE-RENDU DU RENDEZ-VOUS
            </p>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                Rédigé par {record.compteRendu.redacteur}
              </span>
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  record.compteRendu.signeParent ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <PenLine className="h-3 w-3" />
                {record.compteRendu.signeParent ? 'Signé par le parent' : 'En attente de signature'}
              </span>
            </div>
          </div>
          <div className={`grid grid-cols-1 gap-3 ${record.enseignant ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-purple-600">Administration</p>
              <p className="text-xs text-slate-600">{record.compteRendu.administration || '—'}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-pink-600">Parents</p>
              <p className="text-xs text-slate-600">{record.compteRendu.parents || '—'}</p>
            </div>
            {record.enseignant && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-600">Enseignant</p>
                <p className="text-xs text-slate-600">{record.compteRendu.enseignant || '—'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          {studentName && (
            <span>
              Élève : <span className="font-semibold text-slate-700">{studentName}</span>
              {classe && (
                <span className="ml-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                  {classe}
                </span>
              )}
            </span>
          )}
          {record.enseignant ? (
            <span>
              Professeur : <span className="font-semibold text-slate-700">{record.enseignant}</span>
            </span>
          ) : (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
              Rencontre avec l'administration
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {record.statut === 'Planifié' && (
            <>
              <button
                type="button"
                onClick={onRedigerCR}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                Rédiger le C.R.
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50"
              >
                <Ban className="h-3.5 w-3.5" />
                Annuler
              </button>
            </>
          )}
          {record.compteRendu && (
            <button
              type="button"
              onClick={onDownloadCR}
              className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              <Download className="h-3.5 w-3.5" />
              Compte-rendu à signer
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Éditer RDV
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
