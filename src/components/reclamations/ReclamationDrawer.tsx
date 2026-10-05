import { X, CircleDot, CheckCircle2, RotateCcw, Pencil, UserCog, MessageCircle, ArrowRightCircle, Inbox, MailCheck, StickyNote, HeartHandshake, Siren } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReclamationAction, ReclamationRecord } from '../../data/studentDetails'
import { cleanReclamationText, delaiResolutionJours, formatDateFR, isHorsDelai, joursOuverts } from '../../utils/reclamationsLogic'

const ACTION_META: Record<ReclamationAction, { label: string; icon: LucideIcon; color: string }> = {
  creee: { label: 'Réclamation enregistrée', icon: Inbox, color: 'bg-slate-100 text-slate-500' },
  prise_en_charge: { label: 'Prise en charge', icon: CircleDot, color: 'bg-amber-100 text-amber-600' },
  resolue: { label: 'Résolue', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  rouverte: { label: 'Rouverte', icon: RotateCcw, color: 'bg-rose-100 text-rose-600' },
  modifiee: { label: 'Modifiée', icon: Pencil, color: 'bg-indigo-100 text-indigo-600' },
  responsable: { label: 'Responsable / échéance', icon: UserCog, color: 'bg-sky-100 text-sky-600' },
  message_parent: { label: 'Message au parent', icon: MessageCircle, color: 'bg-emerald-100 text-emerald-600' },
  action_creee: { label: 'Action créée', icon: ArrowRightCircle, color: 'bg-violet-100 text-violet-600' },
  accuse: { label: 'Accusé de réception', icon: MailCheck, color: 'bg-emerald-100 text-emerald-600' },
  note: { label: 'Note', icon: StickyNote, color: 'bg-yellow-100 text-yellow-700' },
  suivi_famille: { label: 'Suivi de la famille', icon: HeartHandshake, color: 'bg-pink-100 text-pink-600' },
  urgente: { label: 'Urgence', icon: Siren, color: 'bg-rose-100 text-rose-600' },
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

interface ReclamationDrawerProps {
  reclamation: ReclamationRecord
  studentName: string
  classe: string
  onClose: () => void
}

/** Tiroir de détail : la réclamation et sa frise chronologique (qui a fait quoi, et quand). Les
 * réclamations enregistrées avant la frise n'ont pas d'historique : seule leur réception est connue. */
export default function ReclamationDrawer({ reclamation, studentName, classe, onClose }: ReclamationDrawerProps) {
  const hasCreation = reclamation.historique.some((e) => e.action === 'creee')
  const events = [...reclamation.historique].sort((a, b) => (a.at < b.at ? 1 : -1))
  const resolutionDays = delaiResolutionJours(reclamation)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{reclamation.type}</p>
            <h2 className="text-base font-bold text-slate-900">{cleanReclamationText(reclamation.objet)}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {studentName} · {classe}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <p className="border-l-2 border-slate-200 pl-3 text-sm text-slate-600">{cleanReclamationText(reclamation.description)}</p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-slate-400">Statut</dt>
              <dd className="font-semibold text-slate-700">{reclamation.statut}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Reçue le</dt>
              <dd className="font-semibold text-slate-700">{formatDateFR(reclamation.date)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{reclamation.statut === 'Résolue' ? 'Durée de traitement' : 'Ancienneté'}</dt>
              <dd className={`font-semibold ${isHorsDelai(reclamation) ? 'text-rose-600' : 'text-slate-700'}`}>
                {reclamation.statut === 'Résolue' ? (resolutionDays === null ? 'non enregistrée' : `${resolutionDays} j`) : `${joursOuverts(reclamation.date)} j${isHorsDelai(reclamation) ? ' · hors délai' : ''}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Responsable</dt>
              <dd className="font-semibold text-slate-700">{reclamation.responsable || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Échéance</dt>
              <dd className="font-semibold text-slate-700">{reclamation.echeance ? formatDateFR(reclamation.echeance) : '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Parent</dt>
              <dd className="font-semibold text-slate-700">{reclamation.parentNom || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Concernant</dt>
              <dd className="font-semibold text-slate-700">{reclamation.enseignant || '—'}</dd>
            </div>
          </dl>

          {reclamation.statut === 'Résolue' && reclamation.resolution && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="mb-1 text-xs font-bold text-emerald-700">SOLUTION / COMMENTAIRE</p>
              <p className="text-sm text-emerald-700">{reclamation.resolution}</p>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-800">Historique</h3>
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {events.map((e, i) => {
                const meta = ACTION_META[e.action]
                const Icon = meta.icon
                return (
                  <li key={`${e.at}-${i}`} className="relative">
                    <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ${meta.color}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-semibold text-slate-800">{meta.label}</p>
                    {e.detail && <p className="text-xs text-slate-600">{e.detail}</p>}
                    <p className="text-[11px] text-slate-400">
                      {formatWhen(e.at)}
                      {e.auteur ? ` · ${e.auteur}` : ''}
                    </p>
                  </li>
                )
              })}
              {!hasCreation && (
                <li className="relative">
                  <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ${ACTION_META.creee.color}`}>
                    <Inbox className="h-3 w-3" />
                  </span>
                  <p className="text-sm font-semibold text-slate-800">Réclamation reçue</p>
                  <p className="text-[11px] text-slate-400">{formatDateFR(reclamation.date)}</p>
                </li>
              )}
            </ol>
            {events.length === 0 && <p className="mt-3 text-xs italic text-slate-400">Aucun historique enregistré avant cette version : les prochaines actions y apparaîtront.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}
