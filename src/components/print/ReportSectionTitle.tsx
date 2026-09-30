export default function ReportSectionTitle({
  color,
  size = '11px',
  children,
}: {
  color: string
  size?: string
  children: string
}) {
  return (
    <h2 className="text-center font-bold uppercase tracking-[0.06em]" style={{ color, fontSize: size }}>
      {children}
    </h2>
  )
}
