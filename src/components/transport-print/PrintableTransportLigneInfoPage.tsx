import SchoolLogo from '../print/SchoolLogo'
import type { PreppedInfoTrajet } from '../../utils/transportRoutePagination'

interface PrintableTransportLigneInfoPageProps {
  ligneNom: string
  color: string
  bgSoft: string
  trajet: string
  chauffeurNom: string | null
  chauffeurTel: string | null
  aideNom: string | null
  aideTel: string | null
  heureMatin: string
  heureSoirPrimaire: string
  suiteLabel: string
  trajets: PreppedInfoTrajet[]
  pageNum: number
  totalPages: number
}

const MUTED = 'oklch(0.55 0.01 260)'
const MUTED2 = 'oklch(0.45 0.01 260)'
const INK = 'oklch(0.24 0.01 260)'

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

function InfoChip({ label, name, tel }: { label: string; name: string | null; tel: string | null }) {
  return (
    <div className="rounded-[10px] bg-white px-3 py-[7px] text-center" style={{ minWidth: 96 }}>
      <p className="text-[8px] font-normal uppercase tracking-[0.04em]" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-0.5 text-[11px] font-bold" style={{ color: INK }}>
        {name || '—'}
      </p>
      <p className="mt-px text-[9px]" style={{ color: MUTED }}>
        📞 {tel || '—'}
      </p>
    </div>
  )
}

export default function PrintableTransportLigneInfoPage({
  ligneNom,
  color,
  bgSoft,
  trajet,
  chauffeurNom,
  chauffeurTel,
  aideNom,
  aideTel,
  heureMatin,
  heureSoirPrimaire,
  suiteLabel,
  trajets,
  pageNum,
  totalPages,
}: PrintableTransportLigneInfoPageProps) {
  return (
    <div className="print-page flex flex-col gap-[10px] px-[44px] py-[30px] text-slate-800" style={{ background: 'oklch(0.99 0.003 90)' }}>
      <header className="grid grid-cols-3 items-start border-b-2 pb-3" style={{ borderColor: INK }}>
        <div className="flex flex-col gap-0.5">
          <p className="text-[19px] font-bold tracking-tight" style={{ color: INK }}>
            Groupe Scolaire Mondrian
          </p>
          <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: MUTED }}>
            École de la Bienveillance
          </p>
        </div>
        <SchoolLogo size={70} />
        <div className="flex flex-col items-end gap-0.5 text-right">
          <p className="text-[12.5px] font-bold" style={{ color: INK }}>
            Transport — Informations par Ligne
          </p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-4 rounded-[14px] px-[18px] py-3.5" style={{ background: bgSoft }}>
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[26px] font-extrabold text-white"
          style={{ background: color }}
        >
          {ligneNom}
        </div>
        <div className="flex-1">
          <p className="text-[17px] font-extrabold" style={{ color }}>
            Ligne {ligneNom} {suiteLabel}
          </p>
          <p className="text-[10.5px]" style={{ color: MUTED2 }}>
            Trajet : {trajet || '—'} · Horaires : Matin {heureMatin || '—'} · Soir primaire {heureSoirPrimaire || '—'}
          </p>
        </div>
        <div className="flex gap-2.5">
          <InfoChip label="🚍 Chauffeur" name={chauffeurNom} tel={chauffeurTel} />
          <InfoChip label="🧑‍🏫 Aide-maîtresse" name={aideNom} tel={aideTel} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {trajets.map((t) => (
          <div key={t.label}>
            <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: color }}>
              <span className="text-sm">{t.icon}</span>
              <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">
                {t.label} — {t.time}
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
                {t.students.length} élève(s)
              </span>
            </div>

            {t.hasStudents ? (
              <div className="flex overflow-hidden rounded-b-[10px] border" style={{ borderColor: bgSoft, gap: 1, background: bgSoft }}>
                {t.columns.map((col, ci) => (
                  <div key={ci} className="flex-1 bg-white">
                    <div
                      className="grid px-2.5 py-[5px] text-[8.5px] font-bold uppercase tracking-[0.03em]"
                      style={{ gridTemplateColumns: t.cols, background: 'oklch(0.96 0.005 264)', color: 'oklch(0.5 0.01 260)' }}
                    >
                      <div>Élève</div>
                      <div>Classe</div>
                      {t.hasMotif && <div>Motif</div>}
                    </div>
                    {col.map((s) => (
                      <div
                        key={s.name + s.classe}
                        className="grid items-center border-t px-2.5 py-1"
                        style={{ gridTemplateColumns: t.cols, borderColor: 'oklch(0.93 0.005 90)' }}
                      >
                        <div className="truncate text-[9.5px] font-semibold" style={{ color: INK }}>
                          {s.name}
                        </div>
                        <div className="text-[9px]" style={{ color: MUTED2 }}>
                          {s.classe}
                        </div>
                        {t.hasMotif && (
                          <div className="text-[9.5px]" style={{ color: MUTED }}>
                            {s.motif || '—'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="rounded-b-[10px] border border-dashed px-3.5 py-3.5 text-center text-[10.5px]"
                style={{ borderColor: 'oklch(0.85 0.01 264)', color: MUTED }}
              >
                {t.emptyMsg}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t pt-1.5 text-[8px]" style={{ borderColor: 'oklch(0.92 0.005 90)', color: 'oklch(0.65 0.01 260)' }}>
        <div className="flex justify-between">
          <span>Groupe Scolaire Mondrian — Informations transport par ligne</span>
          <span>
            Ligne {ligneNom} — Page {pageNum} / {totalPages}
          </span>
        </div>
        <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
      </div>
    </div>
  )
}
