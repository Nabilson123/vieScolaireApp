import { INK, MUTED, PAGE_BG } from './reportTheme'

export default function ReportKpiCard({
  label,
  value,
  detail,
  color = INK,
}: {
  label: string
  value: string
  detail: string
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1 px-3.5 py-2.5" style={{ background: PAGE_BG }}>
      <div className="text-center text-[9.5px] uppercase tracking-[0.04em]" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="text-center text-[19px] font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px]" style={{ color: MUTED }}>
        {detail}
      </div>
    </div>
  )
}
