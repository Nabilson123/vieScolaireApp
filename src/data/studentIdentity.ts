/** Valeur sentinelle stockée dans transportLigne/transportLigneSoir : l'élève a le transport activé
 * mais ce trajet précis (matin ou soir) est assuré par les parents, pas par le bus — distinct de
 * `null` (pas encore affecté, à traiter dans la Liste Administrative Transport). */
export const TRANSPORT_PARENTS = 'PARENTS'

export interface StudentIdentity {
  prenom: string
  nom: string
  nomAr: string
  prenomAr: string
  codeMassar: string
  cantine: boolean
  gardeApresMidi: boolean
  gardeMatin: boolean
  gardeMidi: boolean
  transport: boolean
  transportLigne: string | null
  /** Override optionnel pour le soir — vide = même ligne que le matin (transportLigne). */
  transportLigneSoir: string | null
  transportSortie17h: boolean
  transportMotifException: string | null
  transportMotifAutre: string | null
  dateNaissance: string
  lieuNaissance: string
  dateEntree: string
  parent1Nom: string
  parent1Prenom: string
  parent1Tel: string
  parent1Email: string
  parent2Nom: string
  parent2Prenom: string
  parent2Tel: string
  parent2Email: string
}

export const defaultIdentity: StudentIdentity = {
  prenom: '',
  nom: '',
  nomAr: '',
  prenomAr: '',
  codeMassar: '',
  cantine: false,
  gardeApresMidi: false,
  gardeMatin: false,
  gardeMidi: false,
  transport: false,
  transportLigne: null,
  transportLigneSoir: null,
  transportSortie17h: false,
  transportMotifException: null,
  transportMotifAutre: null,
  dateNaissance: '',
  lieuNaissance: '',
  dateEntree: '',
  parent1Nom: '',
  parent1Prenom: '',
  parent1Tel: '',
  parent1Email: '',
  parent2Nom: '',
  parent2Prenom: '',
  parent2Tel: '',
  parent2Email: '',
}

