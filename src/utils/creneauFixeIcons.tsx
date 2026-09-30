import { UtensilsCrossed, Sun, BookOpen, Bus, Clock, type LucideIcon } from 'lucide-react'
import type { CreneauFixeIcon } from '../services/servicesCapaciteService'

export const CRENEAU_ICON_OPTIONS: { value: CreneauFixeIcon; label: string; Icon: LucideIcon }[] = [
  { value: 'cantine', label: 'Cantine', Icon: UtensilsCrossed },
  { value: 'recreation', label: 'Récréation', Icon: Sun },
  { value: 'etude', label: 'Étude', Icon: BookOpen },
  { value: 'transport', label: 'Transport', Icon: Bus },
  { value: 'autre', label: 'Autre', Icon: Clock },
]

export function getCreneauIcon(icon: CreneauFixeIcon | undefined): LucideIcon {
  return CRENEAU_ICON_OPTIONS.find((o) => o.value === icon)?.Icon ?? Clock
}

/** Couleur du créneau, alignée sur son icône : transport reprend la teinte des marqueurs transport (indigo), le reste reste teal (générique "créneau fixe"). */
export function getCreneauColorClass(icon: CreneauFixeIcon | undefined): string {
  return icon === 'transport' ? 'indigo' : 'teal'
}
