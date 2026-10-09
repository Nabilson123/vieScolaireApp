import { useMemo } from 'react'
import { defaultIdentity } from '../data/studentIdentity'
import { useClubEcheances, useClubInscriptions, useClubs } from '../services/clubsService'
import { useClubImputations, useClubReglements } from '../services/clubsPaiementsService'
import { useClubsPaiementsAccess } from '../services/permissions'
import { useStudentIdentities } from '../services/studentIdentityService'
import { useStudents } from '../services/studentsService'
import { cleFamille, libelleFamille, lignesMensualites, paiementsParEcheance, type EleveFinance } from '../utils/clubsFinance'
import { aujourdhuiLocalISO } from '../utils/soutienSeances'

/**
 * Toutes les mensualités des clubs avec leur élève, leur famille, ce qui est payé et leur statut. Les paiements ne sont lus
 * qu'avec le droit d'aperçu : sans lui `paiementsConnus` est faux et les lignes ne doivent pas servir à afficher qui a payé.
 */
export function useClubsFinance() {
  const acces = useClubsPaiementsAccess()
  const { data: clubs = [] } = useClubs()
  const { data: inscriptions = [] } = useClubInscriptions()
  const { data: echeances = [] } = useClubEcheances()
  const { data: reglements = [] } = useClubReglements(acces.canView)
  const { data: imputations = [] } = useClubImputations(acces.canView)
  const { data: students = [] } = useStudents()
  const { data: identities = {} } = useStudentIdentities()
  const aujourdhui = aujourdhuiLocalISO()

  const eleves = useMemo(() => {
    const parId = new Map<string, EleveFinance>()
    const concernes = new Set(inscriptions.map((i) => i.studentId))
    for (const s of students) {
      if (!concernes.has(s.id)) continue
      const identity = identities[s.id] ?? defaultIdentity
      parId.set(s.id, { name: s.name, classe: s.classe, familleCle: cleFamille(identity, s.id), familleLibelle: libelleFamille(identity, s.name) })
    }
    return parId
  }, [students, identities, inscriptions])

  const paiements = useMemo(() => paiementsParEcheance(imputations, reglements), [imputations, reglements])

  const lignes = useMemo(
    () => lignesMensualites({ clubs, inscriptions, echeances, paiements, eleves, aujourdhui }),
    [clubs, inscriptions, echeances, paiements, eleves, aujourdhui],
  )

  return { acces, paiementsConnus: acces.canView, clubs, inscriptions, echeances, reglements, imputations, paiements, eleves, lignes, aujourdhui }
}
