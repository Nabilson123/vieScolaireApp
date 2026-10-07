import { useState } from 'react'
import type { SoutienInscription, SoutienSeance } from '../../data/soutien'
import { useMarkSoutienMessageEnvoye } from '../../services/soutienService'
import { buildSoutienOutbound, type ParentEleve } from '../../utils/soutienMessage'
import type { SoutienMessageKind } from '../../utils/whatsapp'
import MessageWhatsAppModal from '../MessageWhatsAppModal'
import MessageLangSwitch, { useMessageLang } from '../reclamations/MessageLangSwitch'

export const KIND_LABELS: Record<SoutienMessageKind, string> = {
  confirmation: 'Première annonce',
  changement: 'Créneau modifié',
}

/** Choix « première annonce » / « créneau modifié » : le second annule la réponse précédente des parents. */
export function MessageKindSwitch({ kind, onChange }: { kind: SoutienMessageKind; onChange: (kind: SoutienMessageKind) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Type de message">
      {(Object.keys(KIND_LABELS) as SoutienMessageKind[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`rounded-md px-3 py-1 text-xs font-semibold ${kind === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {KIND_LABELS[k]}
        </button>
      ))}
    </div>
  )
}

interface Props {
  inscription: SoutienInscription
  seance: SoutienSeance
  studentName: string
  /** Type de message proposé d'emblée. */
  initialKind?: SoutienMessageKind
  onClose: () => void
}

/**
 * Message de soutien à un parent : français, arabe ou les deux, destinataire au choix (le parent 1 d'abord). Copier le
 * message ou ouvrir WhatsApp l'enregistre comme envoyé ; la réponse des parents se note ensuite dans la liste.
 */
export default function SoutienMessageModal({ inscription, seance, studentName, initialKind = 'confirmation', onClose }: Props) {
  const [lang, setLang] = useMessageLang()
  const [kind, setKind] = useState<SoutienMessageKind>(initialKind)
  const [parentKey, setParentKey] = useState<ParentEleve['key'] | undefined>(undefined)
  const marquerEnvoye = useMarkSoutienMessageEnvoye()
  const { message, parents, parent, recipients } = buildSoutienOutbound(seance, inscription.studentId, kind, lang, parentKey)

  return (
    <MessageWhatsAppModal
      // Changer de langue, de type ou de destinataire régénère le message : on remonte la fenêtre pour repartir du nouveau texte.
      key={`${lang}-${kind}-${parent?.key ?? ''}`}
      title={`Soutien — message à la famille de ${studentName}`}
      label="Message aux parents"
      toolbar={
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <MessageLangSwitch lang={lang} onChange={setLang} />
            <MessageKindSwitch kind={kind} onChange={setKind} />
          </div>
          {parents.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">Destinataire :</span>
              {parents.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setParentKey(p.key)}
                  className={`rounded-full border px-2.5 py-1 font-medium ${parent?.key === p.key ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {p.nom || p.fallback}
                  {!p.phone && <span className="ml-1 text-slate-400">(sans numéro)</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-600">Aucun parent renseigné sur la fiche de cet élève : copiez le message et envoyez-le autrement.</p>
          )}
        </div>
      }
      message={message}
      recipients={recipients}
      onShared={() => marquerEnvoye.mutate([inscription.id])}
      onClose={onClose}
    />
  )
}
