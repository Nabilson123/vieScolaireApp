import { AlertTriangle, CalendarX2, Clock3, ShieldAlert } from 'lucide-react'
import { formatDateFR } from '../../utils/reclamationsLogic'
import type { AssiduiteClasse, EleveConcerne } from '../../utils/suiviClasseReunion'

interface AssiduitePanelProps {
  classes: AssiduiteClasse[]
  /** Début de la période (AAAA-MM-JJ) : la réunion précédente du niveau, à défaut 30 jours avant aujourd'hui. */
  depuis: string
  today: string
}

function Chiffre({ icon: Icon, label, value, detail, tone }: { icon: typeof Clock3; label: string; value: number; detail?: string; tone: 'rose' | 'amber' | 'slate' }) {
  const color = value === 0 ? 'text-slate-400' : tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-700'
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <div>
        <p className={`text-base font-bold leading-none ${color}`}>{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {label}
          {detail ? ` · ${detail}` : ''}
        </p>
      </div>
    </div>
  )
}

function detailEleve(e: EleveConcerne): string {
  const parts = [e.absences > 0 && `${e.absences} séance${e.absences > 1 ? 's' : ''} d'absence`, e.retards > 0 && `${e.retards} retard${e.retards > 1 ? 's' : ''}`, e.incidents > 0 && `${e.incidents} incident${e.incidents > 1 ? 's' : ''}`]
  return parts.filter(Boolean).join(', ')
}

/** Point 4 de la réunion de suivi : les chiffres réels de chaque classe depuis la dernière réunion, pour débattre sur des faits. */
export default function AssiduitePanel({ classes, depuis, today }: AssiduitePanelProps) {
  const rien = classes.every((c) => c.absences === 0 && c.retards === 0 && c.incidents === 0)
  return (
    <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{`Chiffres du ${formatDateFR(depuis)} au ${formatDateFR(today)}`}</p>
      {rien ? (
        <p className="text-sm text-slate-500">Aucune absence, aucun retard ni incident enregistré sur la période pour ce niveau.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {classes.map((c) => (
            <div key={c.classe} className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">{c.classe}</span>
                <span className="text-[11px] text-slate-400">{`${c.effectif} élève${c.effectif > 1 ? 's' : ''}`}</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Chiffre icon={CalendarX2} label="séances d'absence" value={c.absences} detail={c.absences > 0 ? `${c.elevesAbsents} élève${c.elevesAbsents > 1 ? 's' : ''}` : undefined} tone="rose" />
                <Chiffre icon={Clock3} label="retards" value={c.retards} tone="amber" />
                <Chiffre icon={ShieldAlert} label="incidents" value={c.incidents} tone="rose" />
              </div>
              {c.concernes.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <b>À surveiller :</b> {c.concernes.map((e) => `${e.name} (${detailEleve(e)})`).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
