import type { ReclamationService } from '../data/reclamationServices'
import type { Profile } from '../data/profiles'

/**
 * Service chargé de traiter une réclamation : celui qu'on a désigné à la main (`serviceId`) s'il existe encore,
 * sinon celui dont la liste de catégories contient la sienne. `undefined` quand aucun service ne la traite
 * (catégorie non rattachée) : la réclamation reste utilisable, simplement sans service.
 */
export function serviceFor(r: { type: string; serviceId?: string }, services: ReclamationService[]): ReclamationService | undefined {
  if (r.serviceId) {
    const chosen = services.find((s) => s.id === r.serviceId)
    if (chosen) return chosen
  }
  return services.find((s) => s.categories.includes(r.type))
}

/** Personnes (comptes actifs) qui appartiennent à ce service. */
export function membersOf(service: Pick<ReclamationService, 'id'>, profiles: Profile[]): Profile[] {
  return profiles.filter((p) => p.actif && p.serviceIds.includes(service.id))
}

/** La réclamation relève-t-elle d'un des services de cette personne ? */
export function isInMyServices(r: { type: string; serviceId?: string }, services: ReclamationService[], me: Pick<Profile, 'serviceIds'> | undefined): boolean {
  if (!me || me.serviceIds.length === 0) return false
  const service = serviceFor(r, services)
  return !!service && me.serviceIds.includes(service.id)
}

/** Catégories que plus aucun service ne traite — à signaler dans Référentiel. */
export function categoriesWithoutService(services: ReclamationService[], allCategories: readonly string[]): string[] {
  const covered = new Set(services.flatMap((s) => s.categories))
  return allCategories.filter((c) => !covered.has(c))
}

/** Coche ou décoche une catégorie pour un service. Une catégorie n'appartient qu'à un seul service : la cocher
 * pour l'un la retire de celui qui la traitait. Renvoie uniquement les services dont la liste change. */
export function toggleCategory(services: ReclamationService[], serviceId: string, category: string, checked: boolean): ReclamationService[] {
  const changed: ReclamationService[] = []
  services.forEach((s) => {
    if (s.id === serviceId) {
      const has = s.categories.includes(category)
      if (checked && !has) changed.push({ ...s, categories: [...s.categories, category] })
      if (!checked && has) changed.push({ ...s, categories: s.categories.filter((c) => c !== category) })
    } else if (checked && s.categories.includes(category)) {
      changed.push({ ...s, categories: s.categories.filter((c) => c !== category) })
    }
  })
  return changed
}
