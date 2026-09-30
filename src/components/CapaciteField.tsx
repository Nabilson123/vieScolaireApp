import type { LucideIcon } from 'lucide-react'

interface CapaciteFieldProps {
  icon: LucideIcon
  iconColor: string
  label: string
  value: number
  onChange: (value: number) => void
}

export default function CapaciteField({ icon: Icon, iconColor, label, value, onChange }: CapaciteFieldProps) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <span className="text-sm text-slate-500">places</span>
      </div>
    </div>
  )
}
