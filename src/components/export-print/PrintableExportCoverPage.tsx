import SchoolLogo from '../print/SchoolLogo'
import type { ExportReportData } from '../../utils/exportGeneraliseAggregation'

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const PAGE_BG = 'oklch(0.99 0.003 90)'
const BORDER = 'oklch(0.9 0.005 90)'

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

interface PrintableExportCoverPageProps {
  data: ExportReportData
  subtitle: string
  totalPages: number
}

export default function PrintableExportCoverPage({ data, subtitle, totalPages }: PrintableExportCoverPageProps) {
  const { kpis, sommaire, alertes, showAlertes, resteLabel } = data

  return (
    <div className="print-page flex flex-col gap-5 px-11 py-10 text-slate-800" style={{ background: PAGE_BG, fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <header className="grid grid-cols-3 items-start border-b-2 pb-3.5" style={{ borderColor: INK }}>
        <div className="flex flex-col gap-0.5">
          <p className="text-[19px] font-bold tracking-tight" style={{ color: INK }}>
            Groupe Scolaire Mondrian
          </p>
          <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: MUTED }}>
            École de la Bienveillance
          </p>
        </div>
        <SchoolLogo size={72} />
        <div className="flex flex-col items-end gap-0.5 text-right">
          <p className="text-[14px] font-bold" style={{ color: INK }}>
            Export Généralisé
          </p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </div>
      </header>

      <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.03em]" style={{ color: MUTED }}>
        {subtitle}
      </p>

      {kpis.length > 0 && (
        <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, background: BORDER, border: `1px solid ${BORDER}` }}>
          {kpis.map((k) => (
            <div key={k.label} className="flex flex-col gap-1 px-3 py-3" style={{ background: '#fff' }}>
              <div className="text-center text-[9px] uppercase tracking-[0.05em]" style={{ color: MUTED }}>
                {k.label}
              </div>
              <div className="text-center text-[21px] font-bold" style={{ color: k.color }}>
                {k.value}
              </div>
              <div className="text-center text-[9.5px]" style={{ color: MUTED }}>
                {k.detail}
              </div>
            </div>
          ))}
        </div>
      )}

      {sommaire.length > 0 && (
        <div>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.05em]" style={{ color: INK }}>
            Sommaire
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {sommaire.map((s) => (
              <div
                key={s.num}
                className="flex items-center gap-2.5 rounded-[8px] px-3 py-2"
                style={{ background: s.soft }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: s.color }}
                >
                  {s.num}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10.5px] font-bold" style={{ color: s.color }}>
                    {s.name}
                  </p>
                  <p className="text-[9px]" style={{ color: MUTED }}>
                    {s.count}
                  </p>
                </div>
                <div className="shrink-0 text-[9.5px] font-semibold" style={{ color: MUTED }}>
                  p.{s.page}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAlertes && (
        <div className="flex flex-1 flex-col gap-1.5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.05em]" style={{ color: INK }}>
            Élèves à signaler
          </h2>
          {alertes.length === 0 ? (
            <div
              className="border border-dashed px-4 py-4 text-center text-[10.5px]"
              style={{ background: '#F5F4FA', borderColor: '#D6D4E3', color: '#6E7075' }}
            >
              Aucun élève ne déclenche d'alerte sur ce périmètre.
            </div>
          ) : (
            <>
              <table className="w-full border-collapse text-[9.5px]" style={{ color: INK }}>
                <thead>
                  <tr style={{ background: INK }}>
                    {['Élève', 'Classe', 'Présence', 'Abs. / Ret.', 'Moyenne', 'Discipline'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-2 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.04em] text-white ${i === 0 ? 'text-left' : 'text-center'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertes.map((a, i) => (
                    <tr key={`${a.nom}-${i}`} style={{ background: a.bg }}>
                      <td className="px-2 py-1 text-left font-semibold" style={{ color: INK }}>
                        {a.nom}
                      </td>
                      <td className="px-2 py-1 text-center" style={{ color: MUTED }}>
                        {a.classe}
                      </td>
                      <td className="px-2 py-1 text-center font-semibold" style={{ color: a.tauxColor }}>
                        {a.taux}
                      </td>
                      <td className="px-2 py-1 text-center" style={{ color: a.absColor }}>
                        {a.absRet}
                      </td>
                      <td className="px-2 py-1 text-center font-semibold" style={{ color: a.moyColor }}>
                        {a.moy}
                      </td>
                      <td className="px-2 py-1 text-center font-semibold" style={{ color: a.discColor }}>
                        {a.disc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[9px] italic" style={{ color: MUTED }}>
                {resteLabel}
              </p>
            </>
          )}
        </div>
      )}

      <div className="mt-auto border-t pt-1.5 text-[8px]" style={{ borderColor: BORDER, color: 'oklch(0.65 0.01 260)' }}>
        <div className="flex justify-between">
          <span>Groupe Scolaire Mondrian — Export Généralisé</span>
          <span>
            Page 1 / {totalPages}
          </span>
        </div>
        <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
      </div>
    </div>
  )
}
