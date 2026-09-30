import { type Incident, computeBCTotals } from '../data/helpdesk'
import { isWithinPeriod } from './period'

export interface HelpdeskStats {
  aTraiter: number
  enCours: number
  resolu: number
  cumulTTCValide: number
}

export function computeHelpdeskStats(incidents: Incident[]): HelpdeskStats {
  let aTraiter = 0
  let enCours = 0
  let resolu = 0
  let cumulTTCValide = 0
  incidents.forEach((inc) => {
    if (inc.statut === 'A_TRAITER') aTraiter += 1
    else if (inc.statut === 'EN_COURS') enCours += 1
    else resolu += 1
    if (inc.bc.statut === 'VALIDE') cumulTTCValide += computeBCTotals(inc.bc).totalTTC
  })
  return { aTraiter, enCours, resolu, cumulTTCValide }
}

export function filterIncidentsByPeriod(incidents: Incident[], start: string, end: string): Incident[] {
  return incidents.filter((inc) => isWithinPeriod(inc.dateSignalement, start, end))
}

export interface BilanRow {
  label: string
  count: number
  totalTTC: number
}

/** `referentiel` pré-remplit une entrée à 0 pour chaque catégorie connue (ex. PANNE_CATEGORIES) —
 * le document Bilan doit montrer ce qui n'a pas été signalé, pas seulement ce qui l'a été. */
export function computeBilanParCategorie(incidents: Incident[], referentiel: string[] = []): BilanRow[] {
  const map: Record<string, BilanRow> = {}
  referentiel.forEach((label) => {
    map[label] = { label, count: 0, totalTTC: 0 }
  })
  incidents.forEach((inc) => {
    if (!map[inc.categorie]) map[inc.categorie] = { label: inc.categorie, count: 0, totalTTC: 0 }
    map[inc.categorie].count += 1
    map[inc.categorie].totalTTC += computeBCTotals(inc.bc).totalTTC
  })
  return Object.values(map).sort((a, b) => b.totalTTC - a.totalTTC)
}

export function computeBilanParPrestataire(incidents: Incident[]): BilanRow[] {
  const map: Record<string, BilanRow> = {}
  incidents.forEach((inc) => {
    const key = inc.bc.prestataireNom
    if (!map[key]) map[key] = { label: key, count: 0, totalTTC: 0 }
    map[key].count += 1
    map[key].totalTTC += computeBCTotals(inc.bc).totalTTC
  })
  return Object.values(map).sort((a, b) => b.totalTTC - a.totalTTC)
}
