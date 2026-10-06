import { CheckCircle2, Flame, History, MailCheck, MessageCircle, UserCheck } from 'lucide-react'
import type { ReclamationRecord } from '../../data/studentDetails'
import type { AgendaSection, AgendaSectionKey } from '../../utils/reclamationsAgenda'
import { cleanReclamationText, formatDateFR, isAccuseAEnvoyer, isRelanceDue, relanceDueLe, todayLocalISO } from '../../utils/reclamationsLogic'
import { NIVEAU_LABELS, niveauOf } from '../../utils/reclamationsPolicy'
import { AccuseBadge, CATEGORY_COLORS, DelaiBadge } from '../ReclamationCard'

export interface AgendaItem extends ReclamationRecord {
  studentId: string
  studentName: string
  classe: string
}

/** Couleur d'accent de chaque section : le plus pressé en rouge, le suivi courant en bleu. */
const SECTION_STYLE: Record<AgendaSectionKey, { bar: string; title: string }> = {
  urgentes: { bar: 'border-l-orange-500', title: 'text-orange-700' },
  accuses: { bar: 'border-l-amber-400', title: 'text-amber-700' },
  echeances: { bar: 'border-l-rose-500', title: 'text-rose-700' },
  sans_responsable: { bar: 'border-l-rose-300', title: 'text-rose-600' },
  mon_service: { bar: 'border-l-indigo-400', title: 'text-indigo-700' },
  relances: { bar: 'border-l-violet-400', title: 'text-violet-700' },
  mes: { bar: 'border-l-sky-400', title: 'text-sky-700' },
}

interface ReclamationAgendaProps {
  sections: AgendaSection<AgendaItem>[]
  isEditable: boolean
  /** Ouvre le message d'accusé de réception (WhatsApp) — le copier ou l'ouvrir marque l'accusé comme envoyé. */
  onAccuse: (item: AgendaItem) => void
  onTakeCharge: (item: AgendaItem) => void
  /** Ouvre le message de suivi de la famille (réclamations résolues dont la relance est due). */
  onFollowUp?: (item: AgendaItem) => void
  onOpen: (item: AgendaItem) => void
  /** Retour à la liste complète, quand rien n'est à faire. */
  onShowList: () => void
  /** Nom du service chargé de la réclamation (pastille sur chaque ligne). */
  serviceName?: (item: AgendaItem) => string | undefined
}

/** « Que dois-je faire aujourd'hui ? » : les réclamations qui demandent une action, rangées par urgence. */
export default function ReclamationAgenda({ sections, isEditable, onAccuse, onTakeCharge, onFollowUp, onOpen, onShowList, serviceName }: ReclamationAgendaProps) {
  if (sections.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-10 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
        <p className="text-sm font-semibold text-emerald-800">Rien à traiter pour le moment</p>
        <p className="mt-1 text-xs text-emerald-700">Aucun accusé en attente, aucune échéance atteinte, aucune relance due.</p>
        <button type="button" onClick={onShowList} className="mt-4 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
          Voir toutes les réclamations
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const style = SECTION_STYLE[section.key]
        return (
          <section key={section.key}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <h2 className={`text-sm font-bold ${style.title}`}>
                {section.title} <span className="font-semibold text-slate-400">({section.items.length})</span>
              </h2>
              <p className="text-xs text-slate-400">{section.hint}</p>
            </div>
            <div className="space-y-2">
              {section.items.map((item) => (
                <AgendaRow
                  key={`${item.studentId}-${item.id}`}
                  item={item}
                  sectionKey={section.key}
                  barClass={style.bar}
                  isEditable={isEditable}
                  onAccuse={onAccuse}
                  onTakeCharge={onTakeCharge}
                  onFollowUp={onFollowUp}
                  onOpen={onOpen}
                  serviceName={serviceName?.(item)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function AgendaRow({
  item,
  sectionKey,
  barClass,
  isEditable,
  onAccuse,
  onTakeCharge,
  onFollowUp,
  onOpen,
  serviceName,
}: {
  item: AgendaItem
  serviceName?: string
  sectionKey: AgendaSectionKey
  barClass: string
  isEditable: boolean
  onAccuse: (item: AgendaItem) => void
  onTakeCharge: (item: AgendaItem) => void
  onFollowUp?: (item: AgendaItem) => void
  onOpen: (item: AgendaItem) => void
}) {
  const categoryClass = CATEGORY_COLORS[item.type] ?? 'bg-slate-100 text-slate-600'
  const urgent = item.statut !== 'Résolue' && niveauOf(item) === 'urgent'
  const relance = sectionKey === 'relances' && isRelanceDue(item)
  const btn = 'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-l-4 border-slate-100 bg-white px-4 py-3 shadow-sm ${barClass}`}>
      <div className="min-w-[260px] flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${categoryClass}`}>{item.type}</span>
          {urgent && (
            <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
              <Flame className="h-3 w-3" />
              {NIVEAU_LABELS.urgent}
            </span>
          )}
          {serviceName && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{serviceName}</span>}
          <DelaiBadge reclamation={item} />
          <AccuseBadge reclamation={item} />
        </div>
        <p className="text-sm font-bold text-slate-900">{cleanReclamationText(item.objet)}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{item.studentName}</span>
          {item.classe && <span className="ml-1.5 rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px]">{item.classe}</span>}
          {item.parentNom && <span> · {item.parentNom}</span>}
          {item.responsable && <span> · {item.responsable}</span>}
          {sectionKey === 'echeances' && item.echeance && <span className="font-semibold text-rose-600"> · échéance {formatDateFR(item.echeance)}</span>}
          {sectionKey === 'relances' && item.resoluLe && (
            <span className="font-semibold text-violet-700"> · résolue le {formatDateFR(todayLocalISO(new Date(item.resoluLe)))} (relance prévue le {formatDateFR(relanceDueLe(item) ?? '')})</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isAccuseAEnvoyer(item) && (
          <button type="button" onClick={() => onAccuse(item)} disabled={!isEditable} className={`${btn} bg-sky-600 text-white hover:bg-sky-700`}>
            <MailCheck className="h-3.5 w-3.5" />
            Envoyer l'accusé
          </button>
        )}
        {item.statut === 'En attente' && (
          <button type="button" onClick={() => onTakeCharge(item)} disabled={!isEditable} className={`${btn} bg-amber-100 text-amber-800 hover:bg-amber-200`}>
            <UserCheck className="h-3.5 w-3.5" />
            Prendre en charge
          </button>
        )}
        {relance && onFollowUp && (
          <button type="button" onClick={() => onFollowUp(item)} disabled={!isEditable} className={`${btn} bg-violet-600 text-white hover:bg-violet-700`}>
            <MessageCircle className="h-3.5 w-3.5" />
            Message de suivi
          </button>
        )}
        <button type="button" onClick={() => onOpen(item)} title="Détail et historique" className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
          <History className="h-3.5 w-3.5" />
          {relance ? 'Issue du suivi' : 'Détail'}
        </button>
      </div>
    </div>
  )
}
