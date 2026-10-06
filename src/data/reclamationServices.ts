/** Service qui traite certaines catégories de réclamation (ex. Cantine, Transport). Les personnes appartiennent à
 * un ou plusieurs services (`Profile.serviceIds`). La liste se règle dans Référentiel. */
export interface ReclamationService {
  id: string
  nom: string
  /** Catégories de réclamation traitées par ce service ; une catégorie n'appartient qu'à un seul service. */
  categories: string[]
  ordre: number
}
