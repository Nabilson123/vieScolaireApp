import { useMemo, useRef, useState } from 'react'
import { Banknote, CheckCircle2, MessageCircle, Printer, TriangleAlert, X } from 'lucide-react'
import { libelleClub } from '../../data/clubs'
import { useClubsFinance } from '../../hooks/useClubsFinance'
import { useClubRelances, useEnregistrerRelance } from '../../services/clubsPaiementsService'
import { formatDH, impayesParFamille, joursEntre, libelleEcheance, type ImpayeFamille } from '../../utils/clubsFinance'
import { parentsDeLEleve, type ParentEleve } from '../../utils/soutienMessage'
import { buildClubRelanceMessage } from '../../utils/whatsapp'
import ClubsFinancePrintPreviewModal, { type DocumentFinance } from '../clubs-print/ClubsFinancePrintPreviewModal'
import MessageWhatsAppModal from '../MessageWhatsAppModal'
import MessageLangSwitch, { useMessageLang } from '../reclamations/MessageLangSwitch'

interface Props {
  /** Droit d'enregistrer (relances, règlements) et année modifiable. */
  canEdit: boolean
  onEncaisser: (familleCle?: string) => void
}

const INPUT = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none'

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

const LANGUE_LABEL = { fr: 'en français', ar: 'en arabe', both: 'en français et en arabe' } as const

/** Message de relance d'une famille : langue au choix, destinataire (parent 1 d'abord) ; l'envoi est noté une seule fois dans l'historique. */
function RelanceModal({ famille, onClose, onDone }: { famille: ImpayeFamille; onClose: () => void; onDone: (message: string) => void }) {
  const [lang, setLang] = useMessageLang()
  const [parentKey, setParentKey] = useState<ParentEleve['key'] | undefined>(undefined)
  const enregistrer = useEnregistrerRelance()
  const dejaNote = useRef(false)

  const parents = parentsDeLEleve(famille.lignes[0].studentId)
  const parent = parents.find((p) => p.key === parentKey) ?? parents.find((p) => p.phone) ?? parents[0] ?? null
  const message = buildClubRelanceMessage(
    { parentNom: parent?.nom ?? '', lignes: famille.lignes.map((l) => ({ eleve: l.studentNom, club: l.clubNom, mois: l.mois, type: l.type, resteCentimes: l.resteCentimes })) },
    lang,
  )

  const noterEnvoi = () => {
    if (dejaNote.current) return
    dejaNote.current = true
    enregistrer.mutate(
      { familleCle: famille.familleCle, familleLibelle: famille.familleLibelle, montantDuCentimes: famille.resteCentimes, langue: lang },
      {
        onSuccess: () => onDone(`Relance de ${famille.familleLibelle} enregistrée (${LANGUE_LABEL[lang]}).`),
        onError: () => {
          dejaNote.current = false
        },
      },
    )
  }

  return (
    <MessageWhatsAppModal
      // Changer de langue ou de destinataire régénère le message : on remonte la fenêtre pour repartir du nouveau texte.
      key={`${lang}-${parent?.key ?? ''}`}
      title={`Relance — ${famille.familleLibelle}`}
      label="Message à la famille"
      toolbar={
        <div className="space-y-2">
          <MessageLangSwitch lang={lang} onChange={setLang} />
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
            <p className="text-xs text-amber-600">Aucun parent renseigné sur la fiche de l'élève : copiez le message et envoyez-le autrement.</p>
          )}
        </div>
      }
      message={message}
      recipients={parent?.phone ? [{ label: parent.nom || parent.fallback, phone: parent.phone }] : []}
      onShared={noterEnvoi}
      onClose={onClose}
      note="Rien n'est envoyé automatiquement : relisez, puis envoyez vous-même. Copier le message ou ouvrir WhatsApp l'ajoute à l'historique des relances."
    />
  )
}

/** Recouvrement : les familles qui ont des mensualités en retard, leur détail, la dernière relance, et la relance par WhatsApp. */
export default function RecouvrementPanel({ canEdit, onEncaisser }: Props) {
  const { lignes, clubs, aujourdhui } = useClubsFinance()
  const { data: relances = [] } = useClubRelances()
  const [club, setClub] = useState('')
  const [relance, setRelance] = useState<ImpayeFamille | null>(null)
  const [document, setDocument] = useState<DocumentFinance | null>(null)
  const [notice, setNotice] = useState('')

  const impayes = useMemo(() => impayesParFamille(lignes.filter((l) => !club || l.clubId === club), aujourdhui), [lignes, club, aujourdhui])
  const derniereRelance = useMemo(() => {
    const parFamille = new Map<string, { envoyeLe: string; langue: keyof typeof LANGUE_LABEL }>()
    for (const r of relances) {
      const avant = parFamille.get(r.familleCle)
      if (!avant || r.envoyeLe > avant.envoyeLe) parFamille.set(r.familleCle, { envoyeLe: r.envoyeLe, langue: r.langue })
    }
    return parFamille
  }, [relances])

  const total = impayes.reduce((n, f) => n + f.resteCentimes, 0)
  const jamaisRelancees = impayes.filter((f) => !derniereRelance.has(f.familleCle)).length
  const plusAncien = impayes.reduce((max, f) => Math.max(max, f.joursRetardMax), 0)
  const clubChoisi = club ? clubs.find((c) => c.id === club) : undefined
  const portee = club ? (clubChoisi ? libelleClub(clubChoisi) : 'Club') : 'Tous les clubs'

  const tuiles = [
    { label: 'Familles en retard', valeur: String(impayes.length), ton: impayes.length > 0 ? 'text-rose-600' : 'text-slate-900' },
    { label: 'Total dû en retard', valeur: formatDH(total), ton: total > 0 ? 'text-rose-600' : 'text-slate-900' },
    { label: 'Plus ancien retard', valeur: plusAncien > 0 ? `${plusAncien} jours` : '—', ton: 'text-slate-900' },
    { label: 'Jamais relancées', valeur: String(jamaisRelancees), ton: jamaisRelancees > 0 ? 'text-amber-600' : 'text-slate-900' },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <TriangleAlert className="h-5 w-5 text-rose-500" />
            Recouvrement
          </h2>
          <p className="text-xs text-slate-500">Dès qu'une mensualité est en retard (échéance et délai de grâce dépassés), la famille apparaît ici. Aucune pénalité de retard.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={club} onChange={(e) => setClub(e.target.value)} className={INPUT} aria-label="Filtrer par club">
            <option value="">Tous les clubs</option>
            {clubs
              .slice()
              .sort((a, b) => libelleClub(a).localeCompare(libelleClub(b), 'fr', { numeric: true }))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {libelleClub(c)}
                </option>
              ))}
          </select>
          <button type="button" onClick={() => setDocument({ type: 'impayes', impayes, aujourdhui, portee })} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Printer className="h-3.5 w-3.5" />
            État des impayés (PDF)
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tuiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</p>
            <p className={`mt-0.5 text-lg font-bold ${t.ton}`}>{t.valeur}</p>
          </div>
        ))}
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice('')} aria-label="Fermer" className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {impayes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-10 text-center text-sm font-medium text-emerald-700">Aucune mensualité en retard : toutes les familles sont à jour.</div>
      ) : (
        <ul className="space-y-3">
          {impayes.map((f) => {
            const derniere = derniereRelance.get(f.familleCle)
            return (
              <li key={f.familleCle} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900">{f.familleLibelle}</p>
                    <p className="text-xs text-slate-500">
                      Plus ancienne échéance le {dateCourte(f.plusAncienneEcheance)} — {joursEntre(f.plusAncienneEcheance, aujourdhui)} jours de retard
                    </p>
                    <p className={`mt-0.5 text-[11px] font-medium ${derniere ? 'text-slate-500' : 'text-amber-600'}`}>
                      {derniere ? `Dernière relance le ${dateCourte(derniere.envoyeLe.slice(0, 10))} (${LANGUE_LABEL[derniere.langue]})` : 'Jamais relancée'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-lg font-extrabold text-rose-600">{formatDH(f.resteCentimes)}</span>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRelance(f)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                          <MessageCircle className="h-3.5 w-3.5" />
                          Relancer
                        </button>
                        <button type="button" onClick={() => onEncaisser(f.familleCle)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          <Banknote className="h-3.5 w-3.5" />
                          Encaisser
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {f.lignes.map((l) => (
                    <li key={l.echeanceId} className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
                      {l.studentNom} ({l.clubNom}) — {libelleEcheance(l)} : {formatDH(l.resteCentimes)}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}

      {relance && <RelanceModal famille={relance} onClose={() => setRelance(null)} onDone={setNotice} />}
      {document && <ClubsFinancePrintPreviewModal document={document} onClose={() => setDocument(null)} />}
    </div>
  )
}
