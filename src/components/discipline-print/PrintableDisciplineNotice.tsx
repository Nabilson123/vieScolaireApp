import SchoolLogo from '../print/SchoolLogo'
import { findDisciplineType, SANCTION_DESCRIPTIONS, type SanctionLevel } from '../../data/disciplineTypes'

interface PrintableDisciplineNoticeProps {
  studentName: string
  classe: string
  date: string
  author: string
  typeCode?: string
  title: string
  description: string
  sanction?: string
  procedureStepsDone?: number[]
  retenueDate?: string
  retenueDuree?: string
  procedureStepDetails?: Record<number, string>
  procedureDetailsPrintable?: boolean
  privationActivite?: string
  privationDuree?: string
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

function formatDateFR(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR')
}

function isKnownSanction(s: string | undefined): s is SanctionLevel {
  return !!s && s in SANCTION_DESCRIPTIONS
}

export default function PrintableDisciplineNotice({
  studentName,
  classe,
  date,
  author,
  typeCode,
  title,
  description,
  sanction,
  procedureStepsDone,
  retenueDate,
  retenueDuree,
  procedureStepDetails,
  procedureDetailsPrintable,
  privationActivite,
  privationDuree,
}: PrintableDisciplineNoticeProps) {
  const type = findDisciplineType(typeCode)
  const sanctionKnown = isKnownSanction(sanction)

  return (
    <div id="printable-discipline-notice" className="print-page bg-white px-10 py-8 text-slate-800">
      <header className="mb-5 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">Notification Disciplinaire</p>
          <p className="text-[10px] text-slate-500">Édité le {todayFR()}</p>
        </div>
      </header>

      <table className="mb-5 w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className="w-1/4 border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold">Élève</td>
            <td className="border border-slate-200 px-2 py-1.5">{studentName}</td>
            <td className="w-1/4 border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold">Classe</td>
            <td className="border border-slate-200 px-2 py-1.5">{classe}</td>
          </tr>
          <tr>
            <td className="border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold">Date du fait</td>
            <td className="border border-slate-200 px-2 py-1.5">{date}</td>
            <td className="border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold">Rédigé par</td>
            <td className="border border-slate-200 px-2 py-1.5">{author}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        Fiche de référence {type ? `— ${type.code}` : '(hors cahier)'}
      </h2>
      <p className="mb-4 text-sm font-semibold text-slate-900">{title}</p>

      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Description des faits</h2>
      <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{description || '—'}</p>

      {type && (
        <>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Procédure appliquée <span className="normal-case text-slate-400">— الإجراء المتبع</span>
          </h2>
          {procedureStepsDone && procedureStepsDone.length === 0 ? (
            <p className="mb-4 text-xs text-slate-400">Aucune étape de la procédure de référence n'était nécessaire pour ce cas.</p>
          ) : (
            <div className="mb-4 space-y-1.5">
              {type.procedure
                .map((step, idx) => ({ step, idx }))
                .filter(({ idx }) => !procedureStepsDone || procedureStepsDone.includes(idx))
                .map(({ step, idx }, displayIdx) => {
                  const detail = procedureStepDetails?.[idx]
                  const showDetail = procedureDetailsPrintable && detail?.trim()
                  return (
                    <div key={idx} className="flex gap-1.5 text-xs">
                      <span className="shrink-0 font-semibold text-slate-400">{displayIdx + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-600">{step}</p>
                        <p dir="rtl" className="text-slate-500">
                          {type.procedureAr[idx]}
                        </p>
                        {showDetail && (
                          <p className="mt-0.5 rounded bg-slate-50 px-1.5 py-1 text-[10.5px] text-slate-600">
                            <span className="font-semibold">Détail :</span> {detail}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}

      {sanction && (
        <div className="mb-5 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Sanction retenue</h2>
          <p className="text-sm font-bold text-slate-900">{sanction}</p>
          {sanctionKnown && <p className="mt-1 text-xs text-slate-600">{SANCTION_DESCRIPTIONS[sanction]}</p>}
          {sanction === 'Retenue' && (retenueDate || retenueDuree) && (
            <div className="mt-2 flex gap-4 border-t border-slate-200 pt-2 text-xs text-slate-700">
              {retenueDate && (
                <p>
                  <span className="font-semibold">Date :</span> {formatDateFR(retenueDate)}
                </p>
              )}
              {retenueDuree && (
                <p>
                  <span className="font-semibold">Durée :</span> {retenueDuree}
                </p>
              )}
            </div>
          )}
          {sanction === 'Privation d’activités périscolaires/sportives' && (privationActivite || privationDuree) && (
            <div className="mt-2 flex gap-4 border-t border-slate-200 pt-2 text-xs text-slate-700">
              {privationActivite && (
                <p>
                  <span className="font-semibold">Activité :</span> {privationActivite}
                </p>
              )}
              {privationDuree && (
                <p>
                  <span className="font-semibold">Durée :</span> {privationDuree}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {sanction === 'Engagement parental' && (
        <div className="print-avoid-break mb-4 rounded-lg border-2 border-slate-800 p-4">
          <p className="mb-3 text-xs leading-relaxed text-slate-700">
            Je soussigné(e), parent(s) / tuteur(trice) légal(e) de <strong>{studentName}</strong>, reconnais avoir pris
            connaissance des faits ci-dessus et m'engage, conjointement avec mon enfant, à veiller au strict respect
            du règlement intérieur de l'établissement. Je suis informé(e) que tout nouveau manquement de même nature
            pourra entraîner une sanction plus lourde, pouvant aller jusqu'à la comparution devant le Conseil de
            discipline.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="mb-8 font-semibold">Signature de l'élève</p>
              <div className="border-t border-slate-400" />
            </div>
            <div>
              <p className="mb-8 font-semibold">Signature du parent / tuteur</p>
              <div className="border-t border-slate-400" />
            </div>
            <div>
              <p className="mb-8 font-semibold">Signature du CPE</p>
              <div className="border-t border-slate-400" />
            </div>
          </div>
        </div>
      )}

      {sanction === 'Conseil de discipline' && (
        <div className="print-avoid-break mb-4 rounded-lg border-2 border-rose-700 p-4">
          <p className="text-xs leading-relaxed text-slate-700">
            Conformément à la FICHE CADRE 7 du Cahier de Procédures, la famille de <strong>{studentName}</strong> doit
            être convoquée par écrit (lettre recommandée avec accusé de réception, ou remise en main propre contre
            décharge) au minimum 3 à 5 jours avant la tenue du Conseil de discipline, avec le détail précis des griefs
            reprochés. Une mesure conservatoire d'exclusion temporaire peut être prononcée par le Chef d'établissement
            dans l'attente de l'instance.
          </p>
        </div>
      )}

      {sanction && sanction !== 'Engagement parental' && sanction !== 'Conseil de discipline' && (
        <div className="print-avoid-break mt-8 grid grid-cols-2 gap-6 text-xs">
          <div>
            <p className="mb-8 font-semibold">Pris connaissance — Signature du parent / tuteur</p>
            <div className="border-t border-slate-400" />
          </div>
          <div>
            <p className="mb-8 font-semibold">Date</p>
            <div className="border-t border-slate-400" />
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
