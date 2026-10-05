import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Flame, ListChecks, MailCheck, MessageCircle, UserCheck, X } from 'lucide-react'
import type { ReclamationRecord } from '../../data/studentDetails'
import type { ReclamationMessageKind } from '../../utils/whatsapp'
import { useReclamationActions } from '../../hooks/useReclamationActions'
import { cleanReclamationText, echeanceParDefaut, formatDateFR, isAccuseAEnvoyer } from '../../utils/reclamationsLogic'
import { NIVEAU_PAR_CATEGORIE, delaiResolutionAutorise, niveauOf } from '../../utils/reclamationsPolicy'
import { buildStaffOptions } from '../../utils/staffOptions'
import { AccuseBadge, CATEGORY_COLORS, DelaiBadge } from '../ReclamationCard'
import StudentContextBlock from './StudentContextBlock'

export interface QueueReclamation extends ReclamationRecord {
  studentId: string
  studentName: string
  classe: string
}

interface ReclamationQueueModalProps {
  /** Réclamations à passer en revue, de la plus urgente à la moins urgente — figées à l'ouverture pour que la
   * navigation ne saute pas quand une carte est traitée. */
  keys: { studentId: string; id: string }[]
  /** État courant de toutes les réclamations (mis à jour après chaque action). */
  items: QueueReclamation[]
  isEditable: boolean
  /** Ouvre le message d'accusé de réception ; le copier ou l'ouvrir dans WhatsApp le marque comme envoyé. */
  onAccuse: (item: QueueReclamation) => void
  onMessage: (item: QueueReclamation, kind: ReclamationMessageKind) => void
  onClose: () => void
}

function Step({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
      <CheckCircle2 className={`h-3.5 w-3.5 ${done ? 'text-emerald-500' : 'text-slate-300'}`} />
      <span className="font-semibold">{label}</span>
      {detail && <span className="text-[11px] opacity-80">{detail}</span>}
    </div>
  )
}

/**
 * « Traiter la file » : une réclamation à la fois, de la plus urgente à la moins urgente, avec le contexte de
 * l'élève et les actions de tri (accusé, prise en charge, assignation, urgence). Aucune résolution ici :
 * résoudre demande un texte et se fait depuis la carte ou le tiroir.
 */
export default function ReclamationQueueModal({ keys, items, isEditable, onAccuse, onMessage, onClose }: ReclamationQueueModalProps) {
  const actions = useReclamationActions()
  const [index, setIndex] = useState(0)
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)

  const finished = index >= keys.length
  const current = finished ? undefined : items.find((r) => r.studentId === keys[index].studentId && r.id === keys[index].id)

  const go = (delta: number) => setIndex((i) => Math.min(keys.length, Math.max(0, i + delta)))

  // Quand on change de réclamation, le sélecteur de responsable reprend celui de la nouvelle.
  useEffect(() => {
    setAssignee(current?.responsable ?? '')
  }, [current?.studentId, current?.id, current?.responsable])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(keys.length, i + 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keys.length, onClose])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn()
    setBusy(false)
  }

  const urgentParCategorie = current ? NIVEAU_PAR_CATEGORIE[current.type] === 'urgent' : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-label="Traiter la file">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ListChecks className="h-5 w-5 text-indigo-600" />
              Traiter la file
              <span className="text-sm font-semibold text-slate-400">{finished ? `${keys.length} / ${keys.length}` : `${index + 1} / ${keys.length}`}</span>
            </h2>
            <button type="button" onClick={onClose} title="Fermer (Échap)" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${keys.length === 0 ? 100 : Math.round((Math.min(index, keys.length) / keys.length) * 100)}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {finished || keys.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
              <p className="text-base font-semibold text-slate-800">{keys.length === 0 ? 'Rien à traiter' : 'File parcourue'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {keys.length === 0 ? 'Aucune réclamation en attente de tri.' : `Vous avez passé en revue ${keys.length} réclamation${keys.length > 1 ? 's' : ''}.`}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                {keys.length > 0 && (
                  <button type="button" onClick={() => setIndex(0)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Revoir depuis le début
                  </button>
                )}
                <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Fermer
                </button>
              </div>
            </div>
          ) : !current ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Cette réclamation n'existe plus (supprimée entre-temps).
              <div className="mt-4">
                <button type="button" onClick={() => go(1)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Suivante
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${CATEGORY_COLORS[current.type] ?? 'bg-slate-100 text-slate-600'}`}>{current.type}</span>
                  {niveauOf(current) === 'urgent' && (
                    <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                      <Flame className="h-3 w-3" />
                      Urgent
                    </span>
                  )}
                  <DelaiBadge reclamation={current} />
                  <AccuseBadge reclamation={current} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{cleanReclamationText(current.objet)}</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{current.studentName}</span> · {current.classe}
                  {current.parentNom && <> · Parent : {current.parentNom}</>}
                  {current.enseignant && <> · Concernant : {current.enseignant}</>}
                  {' · '}reçue le {formatDateFR(current.date)} · résolution sous {delaiResolutionAutorise(current)} j
                </p>
                <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">{cleanReclamationText(current.description)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Step done={!isAccuseAEnvoyer(current)} label="Accusé de réception" detail={current.accuseLe ? 'envoyé' : 'à envoyer'} />
                <Step done={current.statut !== 'En attente'} label="Prise en charge" detail={current.statut !== 'En attente' ? 'faite' : 'à faire'} />
                <Step done={!!current.responsable} label="Responsable" detail={current.responsable || 'aucun'} />
              </div>

              <StudentContextBlock studentId={current.studentId} classe={current.classe} excludeId={current.id} />

              {isEditable && (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {isAccuseAEnvoyer(current) && (
                      <button type="button" disabled={busy} onClick={() => onAccuse(current)} className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
                        <MailCheck className="h-4 w-4" />
                        Envoyer l'accusé
                      </button>
                    )}
                    {current.statut === 'En attente' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => actions.prendreEnCharge(current.studentId, current.id))}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                      >
                        <UserCheck className="h-4 w-4" />
                        Prendre en charge
                      </button>
                    )}
                    {current.statut === 'En cours' && (
                      <button type="button" disabled={busy} onClick={() => onMessage(current, 'prise_en_charge')} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                        <MessageCircle className="h-4 w-4" />
                        Message de prise en charge
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || (urgentParCategorie && !current.urgente)}
                      onClick={() => run(() => actions.basculerUrgente(current.studentId, current.id))}
                      title={urgentParCategorie && !current.urgente ? "Urgente d'office : sa catégorie l'impose" : undefined}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${current.urgente ? 'bg-orange-500 text-white hover:bg-orange-600' : 'border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'}`}
                    >
                      <Flame className="h-4 w-4" />
                      {current.urgente ? "Retirer l'urgence" : 'Marquer urgente'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      aria-label="Assigner à"
                      className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                    >
                      <option value="">Assigner à…</option>
                      {buildStaffOptions(current.responsable).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy || !assignee || assignee === current.responsable}
                      onClick={() => run(() => actions.assigner(current.studentId, current.id, assignee, current.echeance ?? echeanceParDefaut(current)))}
                      className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Assigner
                    </button>
                  </div>
                  {actions.error && <p className="text-xs text-rose-600">{actions.error}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {!finished && keys.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-3">
            <button type="button" onClick={() => go(-1)} disabled={index === 0} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
              Précédente
            </button>
            <span className="hidden text-[11px] text-slate-400 sm:inline">Flèches ← → pour naviguer</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => go(1)} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                {index === keys.length - 1 ? 'Terminer' : 'Suivante'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
