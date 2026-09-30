import { GraduationCap } from 'lucide-react'
import { useSchoolIdentity } from '../../services/schoolIdentityService'

interface SchoolLogoProps {
  size: number
}

export default function SchoolLogo({ size }: SchoolLogoProps) {
  const { data: identity } = useSchoolIdentity()
  const style = { height: size, width: size }

  if (identity?.logo) {
    return <img src={identity.logo} alt="Logo" className="justify-self-center object-contain" style={style} />
  }

  return (
    <div
      className="flex items-center justify-center justify-self-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600"
      style={style}
    >
      <GraduationCap className="h-1/2 w-1/2 text-white" />
    </div>
  )
}
