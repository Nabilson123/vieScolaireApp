import { useMemo } from 'react'
import { impayesParFamille } from '../utils/clubsFinance'
import { useClubsFinance } from './useClubsFinance'

export interface ClubsImpayes {
  /** Faux sans le droit d'aperçu des paiements : rien ne doit alors s'afficher (ni carte, ni pastille). */
  visible: boolean
  nbFamilles: number
  totalCentimes: number
}

/** Familles qui ont au moins une mensualité de club en retard et ce qu'elles doivent ; réservé aux comptes qui voient les paiements. */
export function useClubsImpayes(): ClubsImpayes {
  const { paiementsConnus, lignes, aujourdhui } = useClubsFinance()
  return useMemo(() => {
    if (!paiementsConnus) return { visible: false, nbFamilles: 0, totalCentimes: 0 }
    const impayes = impayesParFamille(lignes, aujourdhui)
    return { visible: true, nbFamilles: impayes.length, totalCentimes: impayes.reduce((n, f) => n + f.resteCentimes, 0) }
  }, [paiementsConnus, lignes, aujourdhui])
}
