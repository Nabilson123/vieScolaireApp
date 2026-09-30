export default function ReportPageFooter({ label, page }: { label: string; page: string }) {
  return (
    <div className="border-t pt-1.5 text-[8.5px]" style={{ borderColor: '#EBEAE9', color: '#A6A8AC' }}>
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{page}</span>
      </div>
      <div className="mt-0.5 font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
    </div>
  )
}
