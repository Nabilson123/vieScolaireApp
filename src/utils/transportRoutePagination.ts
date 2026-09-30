export interface TransportTrajetStudent {
  name: string
  classe: string
  motif?: string
}

export interface TransportTrajetInput {
  label: string
  time: string
  icon: string
  isMatin: boolean
  hasMotif: boolean
  students: TransportTrajetStudent[]
  emptyMsg: string
}

export interface PreppedTrajet extends TransportTrajetInput {
  hasStudents: boolean
  empty: boolean
  cols: string
  presenceLabel: string
  columns: TransportTrajetStudent[][]
  cost: number
}

// `.print-page` (index.css) n'a qu'un min-height (794×1123px, format A4 à 96dpi) — rien n'empêche
// son contenu de dépasser physiquement une page imprimée si le budget est mal calibré, ce qui coupe
// alors une liste d'élèves au milieu d'un tableau sur la page suivante au lieu d'un vrai saut de
// page propre (incident réel constaté sur des lignes collège à 3 trajets : l'ancien budget, en
// unités abstraites sans rapport avec les pixels réels, laissait passer des combinaisons de trajets
// dépassant largement 1123px). Calibré par mesure directe (getBoundingClientRect()) du rendu réel :
// hauteur totale = 286 + 71,25×(nb de trajets sur la page) + 29×(somme des lignes de la colonne la
// plus chargée de chaque trajet) — formule exacte (vérifiée au dixième de pixel près sur plusieurs
// lignes réelles), où 286px = partie fixe par page (marges + en-tête + bandeau ligne + pied de page
// + espacements, identique quel que soit pageNum : l'en-tête/bandeau/pied de page se répètent à
// l'identique sur chaque page de PrintableTransportLignePage.tsx, un seul budget suffit) et 71,25px
// = en-tête de bloc trajet + son espacement. `cost` ci-dessous n'inclut donc QUE la partie variable
// par trajet (71,25 + 29×lignes) ; la partie fixe (286px) est déjà retranchée du budget ci-dessous.
const PAGE_BUDGET_PX = 817 // 1123 - 286 = 837px réellement disponibles, marge de sécurité 20px
const TRAJET_OVERHEAD_PX = 71.25
const ROW_HEIGHT_PX = 29
// Scinde la liste d'un trajet en 2 colonnes (gauche/droite de la page) dès 11 élèves — la grille de
// pointage (5 cases L/M/M/J/V) est nettement plus haute par ligne que la variante sans pointage, un
// seuil resté à 20 laissait une liste de ~16 élèves déborder la page A4 en une seule colonne pleine
// largeur (incident réel constaté à l'usage).
const SPLIT_THRESHOLD = 10

function splitCols<T>(list: T[], threshold: number): T[][] {
  if (list.length <= threshold) return [list]
  const half = Math.ceil(list.length / 2)
  return [list.slice(0, half), list.slice(half)]
}

function prepTrajet(t: TransportTrajetInput): PreppedTrajet {
  const columns = splitCols(t.students, SPLIT_THRESHOLD)
  return {
    ...t,
    hasStudents: t.students.length > 0,
    empty: t.students.length === 0,
    cols: t.hasMotif ? '1fr 80px 90px 26px 26px 26px 26px 26px' : '1fr 80px 26px 26px 26px 26px 26px',
    presenceLabel: t.isMatin ? 'Arrivée' : 'Retour',
    columns,
    // Coût vertical en pixels réels (mesuré, cf. commentaire des constantes ci-dessus) : surcoût
    // d'en-tête de bloc + hauteur de la colonne la plus chargée (une fois scindée en 2 si >10 élèves).
    cost: TRAJET_OVERHEAD_PX + ROW_HEIGHT_PX * Math.max(1, ...columns.map((c) => c.length)),
  }
}

/**
 * Découpe les trajets d'une ligne en pages selon un budget de hauteur réelle par page (px, cf.
 * calibration ci-dessus), pour garantir qu'aucun contenu n'est jamais tronqué à l'impression —
 * chaque page de PrintableTransportLignePage.tsx répète le même en-tête/bandeau/pied de page quel
 * que soit pageNum, donc un seul budget s'applique uniformément (pas de distinction première page /
 * page de suite).
 */
export function chunkLigneTrajets(trajetsRaw: TransportTrajetInput[]): PreppedTrajet[][] {
  const trajets = trajetsRaw.map(prepTrajet)
  const chunks: PreppedTrajet[][] = []
  let current: PreppedTrajet[] = []
  let used = 0
  trajets.forEach((t) => {
    if (current.length && used + t.cost > PAGE_BUDGET_PX) {
      chunks.push(current)
      current = []
      used = 0
    }
    current.push(t)
    used += t.cost
  })
  if (current.length) chunks.push(current)
  return chunks
}

export interface PreppedInfoTrajet extends TransportTrajetInput {
  hasStudents: boolean
  empty: boolean
  cols: string
  columns: TransportTrajetStudent[][]
  cost: number
}

const INFO_FIRST_PAGE_BUDGET = 60
const INFO_CONT_PAGE_BUDGET = 66
const INFO_SPLIT_THRESHOLD = 28

function prepInfoTrajet(t: TransportTrajetInput): PreppedInfoTrajet {
  const columns = splitCols(t.students, INFO_SPLIT_THRESHOLD)
  return {
    ...t,
    hasStudents: t.students.length > 0,
    empty: t.students.length === 0,
    cols: t.hasMotif ? '1fr 90px 110px' : '1fr 110px',
    columns,
    // Pas de grille de cases à cocher ici : coût par ligne plus faible (2 au lieu de 3), donc
    // budgets de page relevés (60/66 au lieu de 48/54) et seuil de scission à 28 élèves (au lieu
    // de 20) — repris tel quel du handoff design "Liste Administrative — Transport" v2.
    cost: 2 + Math.max(1, ...columns.map((c) => c.length)),
  }
}

/** Variante sans pointage de présence de chunkLigneTrajets — mêmes trajets bruts, budgets retunés. */
export function chunkLigneTrajetsInfo(trajetsRaw: TransportTrajetInput[]): PreppedInfoTrajet[][] {
  const trajets = trajetsRaw.map(prepInfoTrajet)
  const chunks: PreppedInfoTrajet[][] = []
  let current: PreppedInfoTrajet[] = []
  let budget = INFO_FIRST_PAGE_BUDGET
  let used = 0
  trajets.forEach((t) => {
    if (current.length && used + t.cost > budget) {
      chunks.push(current)
      current = []
      used = 0
      budget = INFO_CONT_PAGE_BUDGET
    }
    current.push(t)
    used += t.cost
  })
  if (current.length) chunks.push(current)
  return chunks
}

export const TRANSPORT_LIGNE_COLORS: Record<string, { color: string; bgSoft: string }> = {
  A: { color: 'oklch(0.55 0.18 264)', bgSoft: 'oklch(0.94 0.03 264)' },
  B: { color: 'oklch(0.62 0.14 180)', bgSoft: 'oklch(0.94 0.03 180)' },
  C: { color: 'oklch(0.58 0.16 300)', bgSoft: 'oklch(0.94 0.03 300)' },
  D: { color: 'oklch(0.68 0.16 45)', bgSoft: 'oklch(0.95 0.04 45)' },
  E: { color: 'oklch(0.62 0.19 15)', bgSoft: 'oklch(0.95 0.04 15)' },
}

const DEFAULT_LIGNE_COLOR = { color: 'oklch(0.5 0.02 260)', bgSoft: 'oklch(0.95 0.005 260)' }

export function getLigneColors(nom: string): { color: string; bgSoft: string } {
  return TRANSPORT_LIGNE_COLORS[nom] ?? DEFAULT_LIGNE_COLOR
}
