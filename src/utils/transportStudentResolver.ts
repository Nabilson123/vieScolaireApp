import { TRANSPORT_PARENTS, type StudentIdentity } from '../data/studentIdentity'
import type { Student } from '../data/students'
import type { TransportLigne } from '../services/transportLignesService'
import type { Chauffeur } from '../services/chauffeursService'
import type { AideMaitresse } from '../services/aidesMaitressesService'
import type { ServicesCapacite } from '../services/servicesCapaciteService'
import { cycleOfClasse } from './alertEngine'

/** Ligne du soir effective : override explicite si renseigné, sinon même ligne que le matin. */
export function effectiveSoirLigne(identity: StudentIdentity | undefined | null): string | null {
  return identity?.transportLigneSoir || identity?.transportLigne || null
}

export interface StudentTransportInfo {
  affecte: boolean
  ligneMatinNom: string | null
  ligneSoirNom: string | null
  /** true si le matin/soir est explicitement "Amené(e) par les parents" — pas de bus sur ce trajet. */
  matinParents: boolean
  soirParents: boolean
  soirDepart: '16h' | '17h' | null
  ligneMatin: TransportLigne | null
  ligneSoir: TransportLigne | null
  chauffeurMatin: Chauffeur | null
  aideMatin: AideMaitresse | null
  chauffeurSoir: Chauffeur | null
  aideSoir: AideMaitresse | null
  heureMatin: string
  heureSoir: string
}

/**
 * Résolution du transport d'UN élève — même logique que TransportGlobal.tsx (effectiveSoirLigne +
 * cycleOfClasse + transportSortie17h) mais keyée sur un seul élève plutôt que de filtrer tout le
 * roster (buildTrajetsRaw y est une closure privée non exportée).
 */
export function resolveStudentTransport(
  student: Student,
  identity: StudentIdentity | undefined,
  lignes: TransportLigne[],
  chauffeurs: Chauffeur[],
  aides: AideMaitresse[],
  capacite: ServicesCapacite | undefined
): StudentTransportInfo {
  const ligneMatinNom = identity?.transportLigne ?? null
  const ligneSoirNom = effectiveSoirLigne(identity)
  const matinParents = ligneMatinNom === TRANSPORT_PARENTS
  const soirParents = ligneSoirNom === TRANSPORT_PARENTS
  const isCollege = cycleOfClasse(student.classe) === 'college'
  const soirDepart: '16h' | '17h' | null = ligneSoirNom && !soirParents ? (isCollege || identity?.transportSortie17h ? '17h' : '16h') : null

  const findLigne = (nom: string | null) => lignes.find((l) => l.nom === nom) ?? null
  const findChauffeur = (id: string | null | undefined) => chauffeurs.find((c) => c.id === id) ?? null
  const findAide = (id: string | null | undefined) => aides.find((a) => a.id === id) ?? null

  const ligneMatin = findLigne(ligneMatinNom)
  const ligneSoir = findLigne(ligneSoirNom)

  return {
    affecte: !!identity?.transport,
    ligneMatinNom,
    ligneSoirNom,
    matinParents,
    soirParents,
    soirDepart,
    ligneMatin,
    ligneSoir,
    chauffeurMatin: findChauffeur(ligneMatin?.chauffeurId),
    aideMatin: findAide(ligneMatin?.aideId),
    chauffeurSoir: findChauffeur(ligneSoir?.chauffeurId),
    aideSoir: findAide(ligneSoir?.aideId),
    heureMatin: capacite?.transportHeureMatin ?? '',
    heureSoir: soirDepart === '17h' ? (capacite?.transportHeureSoirCollege ?? '') : (capacite?.transportHeureSoirPrimaire ?? ''),
  }
}
