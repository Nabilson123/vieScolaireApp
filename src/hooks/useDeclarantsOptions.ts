import { useTeachers } from '../services/teachersService'
import { useVigiles } from '../services/vigilesService'
import { DECLARANTS_INSTITUTIONNELS } from '../data/helpdesk'

/** Vrais enseignants + vrai(s) vigile(s) de l'app, plus les unités fonctionnelles non nominatives —
 * réutilisé par IncidentModal.tsx et DemandeModal.tsx (module Helpdesk), remplace toute liste de
 * déclarants fabriquée. */
export function useDeclarantsOptions(): string[] {
  const { data: teachers = [] } = useTeachers()
  const { data: vigiles = [] } = useVigiles()
  return [
    ...teachers.map((t) => `${t.prenom} ${t.nom}`.trim()).sort((a, b) => a.localeCompare(b)),
    ...vigiles.map((v) => `${v.nom} (Surveillant)`),
    ...DECLARANTS_INSTITUTIONNELS,
  ]
}
