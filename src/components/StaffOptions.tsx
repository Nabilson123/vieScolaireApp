import type { StaffOption } from '../utils/staffOptions'

/** `<option>` d'une liste de personnes, regroupées en `<optgroup>` quand les options portent un groupe. */
export default function StaffOptions({ options }: { options: StaffOption[] }) {
  if (!options.some((o) => o.group)) {
    return (
      <>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </>
    )
  }
  const groups: string[] = []
  options.forEach((o) => {
    if (o.group && !groups.includes(o.group)) groups.push(o.group)
  })
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {options
            .filter((o) => o.group === g)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  )
}
