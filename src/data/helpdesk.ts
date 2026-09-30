export type Priorite = 'URGENT' | 'NORMALE' | 'BASSE'
export type StatutIncident = 'A_TRAITER' | 'EN_COURS' | 'RESOLU'
export type StatutBC = 'BROUILLON' | 'EN_ATTENTE_DIRECTION' | 'VALIDE'

export const STATUT_INCIDENT_ORDER: StatutIncident[] = ['A_TRAITER', 'EN_COURS', 'RESOLU']

export const STATUT_INCIDENT_LABELS: Record<StatutIncident, string> = {
  A_TRAITER: 'À Traiter',
  EN_COURS: 'En Cours / En Attente Validation',
  RESOLU: 'Résolu & Validé Direction',
}

export interface PanneCategorie {
  categorie: string
  items: string[]
}

export const PANNE_CATEGORIES: PanneCategorie[] = [
  {
    categorie: 'Informatique & Audio-visuel',
    items: [
      "Vidéoprojecteur HS / Pas d'affichage",
      'Ordinateur / PC Portable en panne',
      'Connexion Wi-Fi / Internet coupée',
      'Problème Son / Enceintes / Micro',
      'Tableau Interactif (TNI) bloqué',
    ],
  },
  {
    categorie: 'Réseau, Serveurs & Vidéosurveillance',
    items: [
      'Caméra de vidéosurveillance HS',
      'Serveur / Baie informatique en panne',
      'Ligne Fibre optique coupée',
      'Ligne téléphonique fixe en panne',
      'Standard téléphonique HS',
    ],
  },
  {
    categorie: 'Plomberie & Sanitaires',
    items: ["Fuite d'eau / Robinet défectueux", 'Chasse d’eau / Toilettes bouchées', "Coupure d'eau / Pression faible"],
  },
  {
    categorie: 'Électricité & Éclairage',
    items: ["Panne d'éclairage / Ampoule grillée", 'Prise électrique défectueuse', 'Disjoncteur sauté / Panne de courant'],
  },
  {
    categorie: 'Mobilier & Infrastructures',
    items: ['Chaise / Table / Bureau cassé', 'Porte / Serrure bloquée ou cassée', 'Fenêtre / Store / Volet coincé', 'Climatisation / Chauffage défaillant'],
  },
  {
    categorie: 'Sécurité Incendie',
    items: ['Extincteur à recharger / manquant', 'Alarme incendie défectueuse', 'Issue de secours bloquée', 'Éclairage de sécurité (BAES) HS'],
  },
  {
    categorie: 'Espaces Verts',
    items: ['Taille / Entretien espaces verts', 'Arrosage automatique en panne', 'Arbre / Branche dangereuse', 'Allée / Clôture endommagée'],
  },
  {
    categorie: 'Autre',
    items: ['Autre (préciser dans la description)'],
  },
]

/** Catégories de déclarants non rattachées à une personne nommée (contrairement aux enseignants et
 * aux vigiles, réels et récupérés dynamiquement dans IncidentModal.tsx) — véritables unités
 * fonctionnelles de l'établissement, pas des noms fabriqués. */
export const DECLARANTS_INSTITUTIONNELS = ['Service Technique', 'Secrétariat', 'Direction']

export const TYPE_INTERVENANT_OPTIONS = [
  'Plombier',
  'Électricien',
  'Technicien IT / Informatique',
  'Menuisier / Serrurier',
  'Climatisation',
  'Jardinier / Espaces Verts',
  'Société de nettoyage',
  'Personnel Interne',
  'Autre',
]

export const TYPE_INTERVENANT_ICONS: Record<string, string> = {
  Plombier: '🔧',
  Électricien: '⚡',
  'Technicien IT / Informatique': '💻',
  'Menuisier / Serrurier': '🔨',
  Climatisation: '❄️',
  'Jardinier / Espaces Verts': '🌳',
  'Société de nettoyage': '🧹',
  'Personnel Interne': '👤',
  Autre: '🔖',
}

export const CATEGORIE_TYPE_MAP: Record<string, string[]> = {
  'Informatique & Audio-visuel': ['Technicien IT / Informatique'],
  'Réseau, Serveurs & Vidéosurveillance': ['Technicien IT / Informatique'],
  'Plomberie & Sanitaires': ['Plombier'],
  'Électricité & Éclairage': ['Électricien'],
  'Mobilier & Infrastructures': ['Menuisier / Serrurier', 'Climatisation'],
  'Espaces Verts': ['Jardinier / Espaces Verts'],
}

export const REGIME_TVA_OPTIONS = ['TVA 20%', 'TVA 14%', 'TVA 10%', 'TVA 7%', 'HT (0%)']

export const CATEGORIE_LIGNE_OPTIONS = ['Matériel', "Main d'œuvre", 'Fourniture', 'Transport', 'Autre']

export const MODE_PAIEMENT_OPTIONS = ['Virement bancaire', 'Chèque', 'Espèces', 'Non défini']

export interface BCLigne {
  id: string
  categorie: string
  designation: string
  quantite: number
  unite: string
  puHT: number
  regimeTVA: string
}

export interface BonCommande {
  numero: string
  typeIntervenant: string
  prestataireId?: string
  prestataireNom: string
  prestataireContact: string
  lignes: BCLigne[]
  transportManutention: number
  modePaiement: string
  dateIntervention: string
  garantieRemarques: string
  /** Imputation budgétaire / centre de coût — texte libre, optionnel, saisi via BCModal.tsx. Absent
   * sur les BC créés avant son introduction (jsonb : pas de migration nécessaire), traité comme
   * "— non renseigné" à l'affichage. */
  imputation?: string
  statut: StatutBC
}

export interface IncidentHistoryEntry {
  id: string
  date: string
  action: string
  auteur: string
}

export interface Incident {
  id: string
  titre: string
  categorie: string
  lieu: string
  priorite: Priorite
  description: string
  statut: StatutIncident
  declarant: string
  dateSignalement: string
  photo?: string
  bc: BonCommande
  historique: IncidentHistoryEntry[]
}

export interface Prestataire {
  id: string
  nom: string
  typeIntervenant: string
  telephone: string
}

/** Type structurel partagé par BCModal.tsx / BCPrintPreviewModal.tsx / PrintableBonCommande.tsx —
 * ces composants ne lisent que ces champs (jamais statut/photo), donc n'importe quel enregistrement
 * Helpdesk porteur d'un Bon de Commande (Incident, Demande...) peut les réutiliser tel quel sans
 * duplication. `categorie` reste optionnel : seule BCModal.tsx s'en sert, pour une suggestion de
 * type d'intervenant, déjà tolérante à son absence. */
export interface BCContext {
  id: string
  titre: string
  lieu: string
  priorite: Priorite
  categorie?: string
  declarant: string
  dateSignalement: string
  bc: BonCommande
  historique: IncidentHistoryEntry[]
}

export function nextBCNumero(existing: { bc: BonCommande }[]): string {
  const year = new Date().getFullYear()
  const prefix = `BC-${year}-`
  let max = 100
  existing.forEach((inc) => {
    if (inc.bc.numero.startsWith(prefix)) {
      const n = Number(inc.bc.numero.slice(prefix.length))
      if (!Number.isNaN(n) && n > max) max = n
    }
  })
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export function emptyBC(numero: string): BonCommande {
  return {
    numero,
    typeIntervenant: 'Personnel Interne',
    prestataireNom: 'Personnel Interne',
    prestataireContact: '',
    lignes: [],
    transportManutention: 0,
    modePaiement: 'Non défini',
    dateIntervention: '',
    garantieRemarques: '',
    imputation: '',
    statut: 'BROUILLON',
  }
}

export function makeHistoryEntry(action: string, auteur: string): IncidentHistoryEntry {
  return { id: crypto.randomUUID(), date: new Date().toISOString(), action, auteur }
}

export function makeBCLigne(categorie: string, designation: string, quantite: number, unite: string, puHT: number, regimeTVA: string): BCLigne {
  return { id: crypto.randomUUID(), categorie, designation, quantite, unite, puHT, regimeTVA }
}

export function computeBCTotals(bc: BonCommande): { sousTotalHT: number; tvaCumulee: number; totalTTC: number } {
  let sousTotalHT = 0
  let tvaCumulee = 0
  bc.lignes.forEach((l) => {
    const montantHT = l.quantite * l.puHT
    sousTotalHT += montantHT
    const tvaMatch = l.regimeTVA.match(/(\d+)%/)
    const taux = tvaMatch ? Number(tvaMatch[1]) / 100 : 0
    tvaCumulee += montantHT * taux
  })
  const totalTTC = sousTotalHT + tvaCumulee + bc.transportManutention
  return { sousTotalHT, tvaCumulee, totalTTC }
}
