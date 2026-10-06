import { roleLabel, useProfileTypes } from '../services/profileTypesService'

/** `<option>` des types de profil définis dans Référentiel ; la valeur déjà choisie reste proposée même si son type
 * n'existe plus. */
export default function ProfileTypeOptions({ current }: { current?: string }) {
  const { data: types = [] } = useProfileTypes()
  const known = types.some((t) => t.cle === current)
  return (
    <>
      {types.map((t) => (
        <option key={t.cle} value={t.cle}>
          {t.libelle}
        </option>
      ))}
      {current && !known && <option value={current}>{roleLabel(current)}</option>}
    </>
  )
}
