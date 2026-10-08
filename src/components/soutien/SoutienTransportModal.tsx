import { useMemo, useState } from 'react'
import { AlertTriangle, Bus, Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react'
import { prochaineDateDeSoutien, transportDuSoutien, type TransportDuSoutien } from '../../utils/soutienContexte'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'
import { buildSoutienTransportMessage, buildWhatsAppLink } from '../../utils/whatsapp'

interface Props {
  /** Jour de soutien dont on prévient le transport ; par défaut aujourd'hui, ou la prochaine séance. */
  initialDate?: string
  onClose: () => void
}

function Destinataire({ label, contact, message }: { label: string; contact: { nom: string; tel: string } | null; message: string }) {
  const lien = contact?.tel ? buildWhatsAppLink(contact.tel, message) : null
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm text-slate-700">{contact?.nom || '—'}</p>
      </div>
      {lien ? (
        <a href={lien} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600">
          <MessageCircle className="h-3.5 w-3.5" />
          Envoyer
        </a>
      ) : (
        <span className="shrink-0 text-xs text-slate-400">{contact ? 'Pas de numéro' : 'Non assigné'}</span>
      )}
    </div>
  )
}

/** Une ligne : ses élèves qui ne viendront pas, le message modifiable et les contacts (chauffeur, aide-maîtresse) de la ligne. */
function LigneEnvoi({ date, ligne }: { date: string; ligne: TransportDuSoutien['lignes'][number] }) {
  const [message, setMessage] = useState(() => buildSoutienTransportMessage({ date, lignes: [{ ligne: ligne.ligne, eleves: ligne.eleves }] }))
  return (
    <section className="rounded-xl border border-slate-200 p-3.5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900">
        <Bus className="h-4 w-4 text-slate-400" />
        Ligne {ligne.ligne}
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          {ligne.eleves.length > 1 ? `${ligne.eleves.length} élèves ne prennent pas le transport` : '1 élève ne prend pas le transport'}
        </span>
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        {ligne.eleves.map((e) => `${e.name} (${e.classe}, soutien ${e.matiere} jusqu'à ${e.heureFin})`).join(' · ')}
      </p>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} dir="rtl" rows={Math.min(10, 5 + ligne.eleves.length)} className="mb-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
      <div className="space-y-1.5">
        <Destinataire label="Chauffeur" contact={ligne.chauffeur} message={message} />
        <Destinataire label="Aide-maîtresse" contact={ligne.aide} message={message} />
      </div>
    </section>
  )
}

/**
 * Prévenir l'équipe transport : pour un jour de soutien, les élèves qui restent et manquent leur transport, ligne par ligne,
 * avec un message en arabe prêt pour le chauffeur, l'aide-maîtresse de la ligne, ou le groupe WhatsApp transport.
 * Rien n'est envoyé automatiquement : la personne relit, puis envoie elle-même.
 */
export default function SoutienTransportModal({ initialDate, onClose }: Props) {
  const aujourdhui = aujourdhuiLocalISO()
  const [date, setDate] = useState(() => initialDate ?? prochaineDateDeSoutien(aujourdhui) ?? aujourdhui)
  const [copie, setCopie] = useState(false)
  const donnees = useMemo(() => transportDuSoutien(date), [date])
  const messageGroupe = useMemo(() => buildSoutienTransportMessage({ date, lignes: donnees.lignes.map((l) => ({ ligne: l.ligne, eleves: l.eleves })) }), [date, donnees])
  const [messageGroupeEdite, setMessageGroupeEdite] = useState<string | null>(null)
  const texteGroupe = messageGroupeEdite ?? messageGroupe

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texteGroupe)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      // Presse-papiers refusé par le navigateur : le texte reste sélectionnable dans la zone de saisie.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-label="Prévenir le transport">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Bus className="h-5 w-5 text-emerald-500" />
            Prévenir le transport — soutien
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">Jour concerné</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setMessageGroupeEdite(null)
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          {donnees.enAttente > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {donnees.enAttente} élève{donnees.enAttente > 1 ? 's' : ''} du transport {donnees.enAttente > 1 ? "n'ont" : "n'a"} pas encore répondu au soutien : seuls ceux qui ont confirmé qu'ils restent sont listés ci-dessous.
              </span>
            </div>
          )}

          {donnees.lignes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Aucun élève du transport du soir ne reste au soutien ce jour-là : il n'y a rien à signaler au transport.
            </p>
          ) : (
            <>
              {donnees.lignes.map((l) => (
                <LigneEnvoi key={`${date}-${l.ligne}-${l.eleves.map((e) => e.name).join('|')}`} date={date} ligne={l} />
              ))}

              <section className="rounded-xl border border-slate-200 p-3.5">
                <h3 className="mb-1 text-sm font-bold text-slate-900">Groupe WhatsApp transport</h3>
                <p className="mb-2 text-xs text-slate-500">Un seul message pour toutes les lignes : copiez-le, puis collez-le dans le groupe.</p>
                <textarea value={texteGroupe} onChange={(e) => setMessageGroupeEdite(e.target.value)} dir="rtl" rows={Math.min(14, 6 + donnees.lignes.reduce((n, l) => n + l.eleves.length + 2, 0))} className="mb-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none" />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={copier} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    {copie ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copie ? 'Copié' : 'Copier'}
                  </button>
                  {donnees.groupeUrl ? (
                    <a href={donnees.groupeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ouvrir le groupe
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Aucun lien de groupe configuré (Transport → réglages).</span>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
