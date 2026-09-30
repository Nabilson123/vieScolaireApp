import type { ReactNode } from 'react'

export default function ReportEmptyStateBox({ children }: { children: ReactNode }) {
  return (
    <div
      className="border border-dashed px-4 py-4 text-center text-[10.5px]"
      style={{ background: '#F5F4FA', borderColor: '#D6D4E3', color: '#6E7075' }}
    >
      {children}
    </div>
  )
}
