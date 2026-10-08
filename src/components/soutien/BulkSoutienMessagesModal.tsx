import { useState } from 'react'
import { Check, CheckCircle2, Copy, ExternalLink, MessageCircle, X } from 'lucide-react'
import type { SoutienInscription, SoutienSeance } from '../../data/soutien'
import { getStudentsSnapshot } from '../../services/studentsService'
import { useMarkSoutienMessageEnvoye, useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { libelleCreneau } from '../../utils/soutienSeances'
import { buildSoutienOutbound, datesAnnuleesAVenir } from '../../utils/soutienMessage'
import { buildWhatsAppLink, type SoutienMessageKind } from '../../utils/whatsapp'
import MessageLangSwitch, { useMessageLang } from '../reclamations/MessageLangSwitch'
import { MessageKindSwitch } from './SoutienMessageModal'

interface Props {
  /** Inscriptions à prévenir, dans l'ordre d'affichage — figées à l'ouverture. */
  ids: string[]
  isEditable: boolean
  /** Type de message proposé d'emblée (« annulation » après l'annulation d'une date). */
  initialKind?: SoutienMessageKind
  /** Dates annulées dont parle le message d'annulation ; par défaut celles à venir de chaque séance. */
  datesAnnulees?: string[]
  onClose: () => void
}

/**
 * Messages de soutien en série : une ligne par élève avec le message prêt, « Copier » et « Ouvrir WhatsApp » par parent.
 * Chaque envoi (copie, ouverture de WhatsApp ou case « Envoyé ») est enregistré tout de suite : rien n'est perdu si on
 * ferme à mi-parcours. Aucun envoi automatique — la personne relit et envoie elle-même.
 */
export default function BulkSoutienMessagesModal({ ids, isEditable, initialKind = 'confirmation', datesAnnulees, onClose }: Props) {
  const { data: inscriptions = [] } = useSoutienInscriptions()
  const { data: seances = [] } = useSoutienSeances()
  const marquer = useMarkSoutienMessageEnvoye()
  const [lang, setLang] = useMessageLang()
  const [kind, setKind] = useState<SoutienMessageKind>(initialKind)
  // Une annonce d'annulation n'est pas suivie en base (elle ne change pas l'état « prévenu du créneau ») : la case « Envoyé » vaut pour cette fenêtre.
  const [envoyesLocal, setEnvoyesLocal] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

  const students = new Map(getStudentsSnapshot().map((s) => [s.id, s]))
  const seanceParId = new Map(seances.map((s) => [s.id, s]))
  const rows = ids
    .map((id) => inscriptions.find((i) => i.id === id))
    .filter((i): i is SoutienInscription => !!i)
    .map((i) => ({ inscription: i, seance: seanceParId.get(i.seanceId), student: students.get(i.studentId) }))
    .filter((r): r is { inscription: SoutienInscription; seance: SoutienSeance; student: NonNullable<typeof r.student> } => !!r.seance && !!r.student)
  const estEnvoye = (i: SoutienInscription) => (kind === 'annulation' ? envoyesLocal.has(i.id) : !!i.messageEnvoyeLe)
  const envoyes = rows.filter((r) => estEnvoye(r.inscription)).length
  const avecAnnulation = rows.some((r) => (datesAnnulees ?? datesAnnuleesAVenir(r.seance)).length > 0)

  const marquerEnvoye = (i: SoutienInscription) => {
    if (estEnvoye(i)) return
    if (kind === 'annulation') setEnvoyesLocal((prev) => new Set(prev).add(i.id))
    else if (isEditable) marquer.mutate([i.id])
  }

  const copier = async (i: SoutienInscription, message: string) => {
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      setCopyError(true)
      return
    }
    setCopyError(false)
    setCopiedId(i.id)
    setTimeout(() => setCopiedId(null), 2000)
    marquerEnvoye(i)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-label="Messages de soutien">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageCircle className="h-5 w-5 text-emerald-500" />
              Messages de soutien aux familles
            </h2>
            <p className="text-xs text-slate-500">
              {envoyes} / {rows.length} envoyé{envoyes > 1 ? 's' : ''} · copier ou ouvrir WhatsApp l'enregistre comme envoyé.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MessageLangSwitch lang={lang} onChange={setLang} />
            <MessageKindSwitch kind={kind} onChange={setKind} avecAnnulation={avecAnnulation} />
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {copyError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Le navigateur a refusé la copie : utilisez « Ouvrir WhatsApp », ou le message individuel de la ligne.</p>}
          {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun élève à prévenir.</p>}
          {rows.map(({ inscription, seance, student }) => {
            const sent = estEnvoye(inscription)
            const annulees = datesAnnulees ?? datesAnnuleesAVenir(seance)
            const { message, parents } = buildSoutienOutbound(seance, student.id, kind, lang, undefined, annulees)
            const liens = parents
              .filter((p) => p.phone)
              .map((p) => ({ parent: p, href: buildWhatsAppLink(p.phone, buildSoutienOutbound(seance, student.id, kind, lang, p.key, annulees).message) }))
              .filter((l): l is typeof l & { href: string } => !!l.href)
            return (
              <div key={inscription.id} className={`rounded-xl border p-3.5 ${sent ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {student.name} <span className="font-normal text-slate-400">({student.classe})</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {seance.matiere} · {libelleCreneau(seance)}
                    </p>
                  </div>
                  <label className={`flex items-center gap-1.5 text-xs font-semibold ${sent ? 'text-emerald-700' : 'text-slate-600'}`}>
                    <input type="checkbox" checked={sent} disabled={sent || (kind !== 'annulation' && !isEditable)} onChange={() => marquerEnvoye(inscription)} className="h-4 w-4 rounded border-slate-300" />
                    Envoyé
                  </label>
                </div>
                <p dir="auto" className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" title={message}>
                  {message.split('\n').filter((l) => l.trim()).slice(0, 3).join(' ')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => copier(inscription, message)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                    {copiedId === inscription.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === inscription.id ? 'Copié' : 'Copier'}
                  </button>
                  {liens.map((l) => (
                    <a
                      key={l.parent.key}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => marquerEnvoye(inscription)}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      WhatsApp — {l.parent.nom || l.parent.fallback}
                    </a>
                  ))}
                  {liens.length === 0 && <span className="text-[11px] text-slate-400">Aucun numéro connu pour cet élève.</span>}
                  {sent && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Message enregistré
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            {envoyes === rows.length && rows.length > 0 ? 'Terminer' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  )
}
