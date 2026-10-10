import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { libelleClub, type Club, type ClubEcheance, type ClubInscription, type ClubSeance, type JourClub, type StatutInscriptionClub, type TypeEcheance } from '../data/clubs'
import { ajouterMois, echeancesPourInscription, moisDe, reconcilerEcheances } from '../utils/clubsFinance'
import { clubComplet, seancesTriees, statutPourNouvelInscrit } from '../utils/clubs'
import { aujourdhuiLocalISO } from '../utils/soutienSeances'
import { getAnneesScolairesSnapshot, useAnneesLoaded } from './anneesScolairesService'
import { logAudit } from './auditLogService'
import { getCurrentUserIdSnapshot } from './currentUser'
import { getViewedYearIdSnapshot, useViewedYearId } from './viewedYear'

interface ClubRow {
  id: string
  nom: string
  categorie: string | null
  description: string
  teacher_id: string | null
  intervenant_nom: string
  /** Séances de la semaine (jsonb) ; les colonnes `jour`, `heure_debut`, `heure_fin` et `salle_id` sont l'ancienne séance unique. */
  seances: ClubSeance[] | null
  jour: JourClub | null
  heure_debut: string | null
  heure_fin: string | null
  salle_id: string | null
  places_max: number | null
  niveaux: string[]
  mensualite_centimes: number
  frais_inscription_centimes: number | null
  mois_debut: string
  mois_fin: string
  jour_echeance: number
  delai_grace_jours: number
  archive: boolean
  created_at: string
}

interface InscriptionRow {
  id: string
  club_id: string
  student_id: string
  statut: StatutInscriptionClub
  date_inscription: string
  date_arret: string | null
  exonere: boolean
  motif_exoneration: string
  derogation_niveau: boolean
  created_at: string
}

interface EcheanceRow {
  id: string
  inscription_id: string
  type: TypeEcheance | null
  mois: string
  montant_centimes: number
  date_echeance: string
}

// Les colonnes `time` reviennent en HH:MM:SS.
const hhmm = (t: string) => t.slice(0, 5)

/** Séances d'un club : la liste enregistrée, ou à défaut l'ancienne séance unique (clubs créés avant les séances multiples). */
function seancesDeLaLigne(row: ClubRow): ClubSeance[] {
  const enregistrees = (row.seances ?? []).filter((s) => s && s.jour && s.heureDebut && s.heureFin).map((s) => ({ jour: s.jour, heureDebut: hhmm(s.heureDebut), heureFin: hhmm(s.heureFin), salleId: s.salleId ?? null }))
  if (enregistrees.length > 0) return enregistrees
  if (row.jour && row.heure_debut && row.heure_fin) return [{ jour: row.jour, heureDebut: hhmm(row.heure_debut), heureFin: hhmm(row.heure_fin), salleId: row.salle_id }]
  return []
}

function rowToClub(row: ClubRow): Club {
  return {
    id: row.id,
    nom: row.nom,
    categorie: row.categorie ?? '',
    description: row.description ?? '',
    teacherId: row.teacher_id,
    intervenantNom: row.intervenant_nom ?? '',
    seances: seancesDeLaLigne(row),
    placesMax: row.places_max,
    niveaux: row.niveaux ?? [],
    mensualiteCentimes: row.mensualite_centimes,
    fraisInscriptionCentimes: row.frais_inscription_centimes ?? 0,
    moisDebut: row.mois_debut,
    moisFin: row.mois_fin,
    jourEcheance: row.jour_echeance,
    delaiGraceJours: row.delai_grace_jours,
    archive: row.archive,
    createdAt: row.created_at,
  }
}

function rowToInscription(row: InscriptionRow): ClubInscription {
  return {
    id: row.id,
    clubId: row.club_id,
    studentId: row.student_id,
    statut: row.statut,
    dateInscription: row.date_inscription,
    dateArret: row.date_arret,
    exonere: row.exonere,
    motifExoneration: row.motif_exoneration ?? '',
    derogationNiveau: row.derogation_niveau,
    createdAt: row.created_at,
  }
}

function rowToEcheance(row: EcheanceRow): ClubEcheance {
  return {
    id: row.id,
    inscriptionId: row.inscription_id,
    type: row.type ?? 'mensualite',
    mois: row.mois,
    montantCentimes: row.montant_centimes,
    dateEcheance: row.date_echeance,
  }
}

const CLUBS_KEY = ['clubs']
const INSCRIPTIONS_KEY = ['clubInscriptions']
const ECHEANCES_KEY = ['clubEcheances']

let cachedClubs: Club[] = []
let cachedInscriptions: ClubInscription[] = []
let cachedEcheances: ClubEcheance[] = []

/** Instantanés synchrones pour les utilitaires hors-React (disponibilité des enseignants et des salles, grilles). */
export function getClubsSnapshot(): Club[] {
  return cachedClubs
}

export function getClubInscriptionsSnapshot(): ClubInscription[] {
  return cachedInscriptions
}

export function getClubEcheancesSnapshot(): ClubEcheance[] {
  return cachedEcheances
}

const PAGE = 1000

/** Lit toutes les lignes d'une requête, page par page (PostgREST plafonne une réponse à 1000 lignes). */
async function fetchTout<Row>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

async function fetchClubs(yearId: string): Promise<Club[]> {
  const { data, error } = await supabase.from('clubs').select('*').eq('annee_scolaire_id', yearId).order('nom', { ascending: true })
  if (error) throw error
  return (data as ClubRow[]).map(rowToClub)
}

async function fetchInscriptions(yearId: string): Promise<ClubInscription[]> {
  const rows = await fetchTout<InscriptionRow>((from, to) =>
    supabase.from('club_inscriptions').select('*, clubs!inner(annee_scolaire_id)').eq('clubs.annee_scolaire_id', yearId).order('id').range(from, to),
  )
  return rows.map(rowToInscription)
}

async function fetchEcheances(yearId: string): Promise<ClubEcheance[]> {
  const rows = await fetchTout<EcheanceRow>((from, to) =>
    supabase
      .from('club_echeances')
      .select('*, club_inscriptions!inner(club_id, clubs!inner(annee_scolaire_id))')
      .eq('club_inscriptions.clubs.annee_scolaire_id', yearId)
      .order('id')
      .range(from, to),
  )
  return rows.map(rowToEcheance)
}

export function useClubs(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...CLUBS_KEY, viewedYearId],
    queryFn: () => fetchClubs(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone : les agrégats hors React voient les données dès ce rendu.
  if (query.data) cachedClubs = query.data
  return query
}

export function useClubInscriptions(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...INSCRIPTIONS_KEY, viewedYearId],
    queryFn: () => fetchInscriptions(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  if (query.data) cachedInscriptions = query.data
  return query
}

export function useClubEcheances(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...ECHEANCES_KEY, viewedYearId],
    queryFn: () => fetchEcheances(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  if (query.data) cachedEcheances = query.data
  return query
}

function useInvalidateClubs() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLUBS_KEY }),
      queryClient.invalidateQueries({ queryKey: INSCRIPTIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: ECHEANCES_KEY }),
    ])
}

// ───────────────────────── Synchronisation des mensualités ─────────────────────────

const TRANCHE = 100

function parTranches<T>(items: T[], taille = TRANCHE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += taille) out.push(items.slice(i, i + taille))
  return out
}

/**
 * Mensualités qui ont déjà reçu un règlement valide (même partiel). Passe par la fonction SQL `club_echeances_payees`
 * (migration 080) : elle ne renvoie que les identifiants, jamais les montants, et fonctionne pour tout le personnel,
 * alors que les règlements eux-mêmes sont réservés au droit sur les paiements. Une lecture directe de `club_imputations`
 * ne verrait rien sans ce droit et ferait croire qu'aucun mois n'est payé.
 */
async function fetchPayees(echeanceIds: string[]): Promise<Set<string>> {
  const payees = new Set<string>()
  for (const tranche of parTranches(echeanceIds)) {
    const { data, error } = await supabase.rpc('club_echeances_payees', { p_echeance_ids: tranche })
    if (error) throw error
    for (const id of (data ?? []) as string[]) payees.add(id)
  }
  return payees
}

async function fetchEcheancesDe(inscriptionIds: string[]): Promise<ClubEcheance[]> {
  const out: ClubEcheance[] = []
  for (const tranche of parTranches(inscriptionIds)) {
    const rows = await fetchTout<EcheanceRow>((from, to) => supabase.from('club_echeances').select('*').in('inscription_id', tranche).order('id').range(from, to))
    out.push(...rows.map(rowToEcheance))
  }
  return out
}

export interface ResumeSynchro {
  ajoutees: number
  modifiees: number
  supprimees: number
}

interface PlanSynchro {
  aAjouter: { inscription_id: string; type: TypeEcheance; mois: string; montant_centimes: number; date_echeance: string }[]
  aMettreAJour: { id: string; montant_centimes: number; date_echeance: string }[]
  aSupprimer: string[]
}

/**
 * Calcule ce qu'il faut ajouter, modifier ou supprimer pour que les mensualités des inscriptions correspondent au tarif et
 * aux dates du club. Lit les mensualités et les paiements à jour en base (pas le cache) : un mois payé n'est jamais touché.
 */
async function planifierSynchro(club: Club, inscriptions: ClubInscription[]): Promise<PlanSynchro> {
  const plan: PlanSynchro = { aAjouter: [], aMettreAJour: [], aSupprimer: [] }
  if (inscriptions.length === 0) return plan
  const existantes = await fetchEcheancesDe(inscriptions.map((i) => i.id))
  const payees = await fetchPayees(existantes.map((e) => e.id))
  for (const inscription of inscriptions) {
    const voulues = echeancesPourInscription(club, inscription)
    const siennes = existantes.filter((e) => e.inscriptionId === inscription.id)
    const r = reconcilerEcheances(siennes, voulues, payees, moisDe(inscription.dateInscription))
    r.aAjouter.forEach((v) => plan.aAjouter.push({ inscription_id: inscription.id, type: v.type, mois: v.mois, montant_centimes: v.montantCentimes, date_echeance: v.dateEcheance }))
    r.aMettreAJour.forEach((m) => plan.aMettreAJour.push({ id: m.id, montant_centimes: m.montantCentimes, date_echeance: m.dateEcheance }))
    plan.aSupprimer.push(...r.aSupprimer)
  }
  return plan
}

function resumeDe(plan: PlanSynchro): ResumeSynchro {
  return { ajoutees: plan.aAjouter.length, modifiees: plan.aMettreAJour.length, supprimees: plan.aSupprimer.length }
}

async function appliquerSynchro(plan: PlanSynchro): Promise<void> {
  for (const tranche of parTranches(plan.aAjouter)) {
    const { error } = await supabase.from('club_echeances').insert(tranche)
    if (error) throw error
  }
  await Promise.all(
    plan.aMettreAJour.map(async (m) => {
      const { error } = await supabase.from('club_echeances').update({ montant_centimes: m.montant_centimes, date_echeance: m.date_echeance }).eq('id', m.id)
      if (error) throw error
    }),
  )
  for (const tranche of parTranches(plan.aSupprimer)) {
    const { error } = await supabase.from('club_echeances').delete().in('id', tranche)
    if (error) throw error
  }
}

/** Inscriptions dont les mensualités doivent suivre le club (la liste d'attente ne facture rien). */
const facturables = (inscriptions: ClubInscription[]) => inscriptions.filter((i) => i.statut !== 'attente')

async function synchroniserEcheances(club: Club, inscriptions: ClubInscription[]): Promise<ResumeSynchro> {
  const plan = await planifierSynchro(club, inscriptions)
  await appliquerSynchro(plan)
  return resumeDe(plan)
}

/**
 * Recale les mensualités de ces inscriptions sur le tarif, les mois et l'arrêt de leur club. Utilisé après l'annulation d'un
 * règlement : un mois payé d'avance après l'arrêt de l'élève n'était conservé que parce qu'il avait été payé, il disparaît
 * dès que ce paiement est annulé.
 */
export async function resynchroniserInscriptions(inscriptionIds: string[]): Promise<ResumeSynchro> {
  const total: ResumeSynchro = { ajoutees: 0, modifiees: 0, supprimees: 0 }
  const concernees = cachedInscriptions.filter((i) => inscriptionIds.includes(i.id))
  for (const club of cachedClubs) {
    const duClub = facturables(concernees.filter((i) => i.clubId === club.id))
    if (duClub.length === 0) continue
    const r = await synchroniserEcheances(club, duClub)
    total.ajoutees += r.ajoutees
    total.modifiees += r.modifiees
    total.supprimees += r.supprimees
  }
  return total
}

/**
 * Effet qu'aurait la modification du club sur les mensualités déjà créées de ses inscrits, sans rien écrire. Sert à
 * prévenir avant de changer un tarif ou une période (« N mensualités sans règlement seront recalculées »).
 */
export async function apercuSynchroClub(apres: Club): Promise<ResumeSynchro> {
  const plan = await planifierSynchro(apres, facturables(cachedInscriptions.filter((i) => i.clubId === apres.id)))
  return resumeDe(plan)
}

// ───────────────────────── Clubs ─────────────────────────

/** Champs d'un club saisis par la vie scolaire (le reste est calculé). */
export interface ClubInput {
  nom: string
  categorie: string
  description: string
  teacherId: string | null
  intervenantNom: string
  seances: ClubSeance[]
  placesMax: number | null
  niveaux: string[]
  mensualiteCentimes: number
  /** 0 = pas de frais d'inscription. */
  fraisInscriptionCentimes: number
  moisDebut: string
  moisFin: string
  jourEcheance: number
  delaiGraceJours: number
}

function clubToRow(input: ClubInput) {
  const seances = seancesTriees(input)
  // L'ancienne séance unique reste renseignée avec la première séance, pour qu'un retour en arrière du code ne perde rien.
  const premiere = seances[0]
  return {
    nom: input.nom,
    categorie: input.categorie.trim(),
    description: input.description,
    teacher_id: input.teacherId,
    intervenant_nom: input.intervenantNom,
    seances,
    jour: premiere?.jour ?? null,
    heure_debut: premiere?.heureDebut ?? null,
    heure_fin: premiere?.heureFin ?? null,
    salle_id: premiere?.salleId ?? null,
    places_max: input.placesMax,
    niveaux: input.niveaux,
    mensualite_centimes: input.mensualiteCentimes,
    frais_inscription_centimes: input.fraisInscriptionCentimes,
    mois_debut: input.moisDebut,
    mois_fin: input.moisFin,
    jour_echeance: input.jourEcheance,
    delai_grace_jours: input.delaiGraceJours,
  }
}

/** Le changement touche-t-il les sommes dues (mensualité, frais d'inscription, mois facturés, jour d'échéance) ? */
export function tarifOuPeriodeModifie(avant: Club, apres: Pick<ClubInput, 'mensualiteCentimes' | 'fraisInscriptionCentimes' | 'moisDebut' | 'moisFin' | 'jourEcheance'>): boolean {
  return (
    avant.mensualiteCentimes !== apres.mensualiteCentimes ||
    avant.fraisInscriptionCentimes !== apres.fraisInscriptionCentimes ||
    avant.moisDebut !== apres.moisDebut ||
    avant.moisFin !== apres.moisFin ||
    avant.jourEcheance !== apres.jourEcheance
  )
}

export function useAddClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async (club: ClubInput): Promise<string> => {
      const { data, error } = await supabase
        .from('clubs')
        .insert({ ...clubToRow(club), annee_scolaire_id: getViewedYearIdSnapshot(), created_by: getCurrentUserIdSnapshot() })
        .select('id')
        .single()
      if (error) throw error
      const id = (data as { id: string }).id
      await logAudit({ tableName: 'clubs', recordId: id, action: 'insert', newData: clubToRow(club) })
      return id
    },
    onSuccess: invalidate,
  })
}

/** Modifie un club. Si le tarif ou les mois changent, les mensualités sans règlement de ses inscrits sont recalculées. */
export function useUpdateClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async ({ id, club }: { id: string; club: ClubInput }): Promise<ResumeSynchro> => {
      const avant = cachedClubs.find((c) => c.id === id)
      const { error } = await supabase.from('clubs').update(clubToRow(club)).eq('id', id)
      if (error) throw error

      let resume: ResumeSynchro = { ajoutees: 0, modifiees: 0, supprimees: 0 }
      if (avant && tarifOuPeriodeModifie(avant, club)) {
        const apres: Club = { ...avant, ...club }
        resume = await synchroniserEcheances(apres, facturables(cachedInscriptions.filter((i) => i.clubId === id)))
      }
      await logAudit({
        tableName: 'clubs',
        recordId: id,
        action: 'update',
        oldData: avant ? { nom: avant.nom, mensualite_centimes: avant.mensualiteCentimes, mois_debut: avant.moisDebut, mois_fin: avant.moisFin, jour_echeance: avant.jourEcheance } : undefined,
        newData: { ...clubToRow(club), mensualites_recalculees: resume.modifiees },
      })
      return resume
    },
    onSuccess: invalidate,
  })
}

export function useArchiveClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase.from('clubs').update({ archive }).eq('id', id)
      if (error) throw error
      await logAudit({ tableName: 'clubs', recordId: id, action: 'update', newData: { archive } })
    },
    onSuccess: invalidate,
  })
}

/** Supprime un club sans aucun inscrit (une erreur de saisie) ; un club qui a eu des inscrits s'archive. */
export function useDeleteClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async (id: string) => {
      if (cachedInscriptions.some((i) => i.clubId === id)) throw new Error('Ce club a des inscrits : archivez-le plutôt que de le supprimer.')
      const avant = cachedClubs.find((c) => c.id === id)
      const { error } = await supabase.from('clubs').delete().eq('id', id)
      if (error) throw error
      await logAudit({ tableName: 'clubs', recordId: id, action: 'delete', oldData: avant ? { nom: avant.nom } : undefined })
    },
    onSuccess: invalidate,
  })
}

export interface ReconductionResult {
  crees: number
  /** Clubs de l'année précédente dont un club du même nom existe déjà cette année. */
  ignores: number
}

/**
 * Recopie les clubs non archivés de l'année précédente dans l'année consultée : nom, encadrant, tarif, horaires, niveaux,
 * avec les mois décalés d'autant d'années. Aucun inscrit ni paiement n'est copié.
 */
export function useReconduireClubs() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async (): Promise<ReconductionResult> => {
      const annees = getAnneesScolairesSnapshot()
      const courante = annees.find((a) => a.id === getViewedYearIdSnapshot())
      const precedente = courante ? annees.find((a) => a.anneeDebut === courante.anneeDebut - 1) : undefined
      if (!courante || !precedente) throw new Error('Aucune année précédente à reconduire.')
      const sources = (await fetchClubs(precedente.id)).filter((c) => !c.archive)
      const cle = (c: Club) => libelleClub(c).trim().toLowerCase()
      const dejaLa = new Set(cachedClubs.map(cle))
      const aCreer = sources.filter((c) => !dejaLa.has(cle(c)))
      const decalage = 12 * (courante.anneeDebut - precedente.anneeDebut)
      if (aCreer.length > 0) {
        const { error } = await supabase.from('clubs').insert(
          aCreer.map((c) => ({
            ...clubToRow({ ...c, moisDebut: ajouterMois(c.moisDebut, decalage), moisFin: ajouterMois(c.moisFin, decalage) }),
            annee_scolaire_id: courante.id,
            created_by: getCurrentUserIdSnapshot(),
          })),
        )
        if (error) throw error
      }
      await logAudit({ tableName: 'clubs', recordId: courante.id, action: 'insert', newData: { reconduction: true, crees: aCreer.length, depuis: precedente.libelle } })
      return { crees: aCreer.length, ignores: sources.length - aCreer.length }
    },
    onSuccess: invalidate,
  })
}

// ───────────────────────── Inscriptions ─────────────────────────

export interface InscrireInput {
  clubId: string
  studentId: string
  /** AAAA-MM-JJ, aujourd'hui par défaut : le mois d'inscription est dû en entier. */
  dateInscription?: string
  exonere?: boolean
  motifExoneration?: string
  derogationNiveau?: boolean
}

export interface InscrireResult {
  id: string
  /** `attente` quand le club est complet. */
  statut: 'actif' | 'attente'
}

/**
 * Inscrit un élève : actif s'il reste une place, sinon en liste d'attente. Un élève qui avait quitté le club est
 * réinscrit sur la même ligne (ses éventuels impayés d'avant restent dus).
 */
export function useInscrireClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async (input: InscrireInput): Promise<InscrireResult> => {
      const club = cachedClubs.find((c) => c.id === input.clubId)
      if (!club) throw new Error('Club introuvable.')
      if (club.archive) throw new Error('Ce club est archivé.')
      const { inscription, statut } = await inscrireUnEleve(club, input, cachedInscriptions)
      return { id: inscription.id, statut }
    },
    onSuccess: invalidate,
  })
}

/**
 * Inscrit un élève au club d'après la liste d'inscriptions donnée (ce qui permet à une inscription en lot de compter les
 * places au fur et à mesure) : actif s'il reste une place, sinon en liste d'attente ; réinscrit sur la même ligne s'il
 * avait quitté le club ; mensualités créées et trace dans le journal d'audit.
 */
async function inscrireUnEleve(club: Club, input: InscrireInput, inscriptions: ClubInscription[]): Promise<{ inscription: ClubInscription; statut: 'actif' | 'attente' }> {
  const existante = inscriptions.find((i) => i.clubId === club.id && i.studentId === input.studentId)
  if (existante && existante.statut === 'actif') throw new Error('Cet élève est déjà inscrit à ce club.')
  if (existante && existante.statut === 'attente') throw new Error("Cet élève est déjà sur la liste d'attente de ce club.")

  const statut = statutPourNouvelInscrit(club, inscriptions)
  const champs = {
    statut,
    date_inscription: input.dateInscription || aujourdhuiLocalISO(),
    date_arret: null,
    exonere: !!input.exonere,
    motif_exoneration: input.exonere ? (input.motifExoneration ?? '').trim() : '',
    derogation_niveau: !!input.derogationNiveau,
  }
  const requete = existante
    ? supabase.from('club_inscriptions').update(champs).eq('id', existante.id).select('*').single()
    : supabase.from('club_inscriptions').insert({ ...champs, club_id: club.id, student_id: input.studentId }).select('*').single()
  const { data, error } = await requete
  if (error) {
    // 23505 : l'élève est déjà inscrit à ce club (contrainte d'unicité).
    if (error.code === '23505') throw new Error('Cet élève est déjà inscrit à ce club.')
    throw error
  }
  const inscription = rowToInscription(data as InscriptionRow)
  await synchroniserEcheances(club, facturables([inscription]))
  await logAudit({ tableName: 'club_inscriptions', recordId: inscription.id, action: existante ? 'update' : 'insert', newData: { club: libelleClub(club), student_id: input.studentId, ...champs } })
  return { inscription, statut }
}

export interface InscrireLotInput {
  clubId: string
  studentIds: string[]
  dateInscription?: string
  exonere?: boolean
  motifExoneration?: string
  /** Élèves hors des niveaux admis que l'on inscrit malgré tout (dérogation confirmée). */
  derogationIds?: string[]
}

export interface InscrireLotResult {
  inscrits: number
  enAttente: number
  /** Élèves non inscrits, avec la raison (déjà inscrit, erreur…). */
  echecs: { studentId: string; raison: string }[]
}

/**
 * Inscrit plusieurs élèves d'un coup. Les places sont comptées au fur et à mesure : les premiers sont inscrits tant qu'il
 * en reste, les suivants vont en liste d'attente. Un élève qui échoue (déjà inscrit, erreur) n'empêche pas les autres.
 */
export function useInscrireClubLot() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async (input: InscrireLotInput): Promise<InscrireLotResult> => {
      const club = cachedClubs.find((c) => c.id === input.clubId)
      if (!club) throw new Error('Club introuvable.')
      if (club.archive) throw new Error('Ce club est archivé.')
      const derogations = new Set(input.derogationIds ?? [])
      let actuelles = [...cachedInscriptions]
      const resultat: InscrireLotResult = { inscrits: 0, enAttente: 0, echecs: [] }
      for (const studentId of [...new Set(input.studentIds)]) {
        try {
          const { inscription, statut } = await inscrireUnEleve(
            club,
            { clubId: club.id, studentId, dateInscription: input.dateInscription, exonere: input.exonere, motifExoneration: input.motifExoneration, derogationNiveau: derogations.has(studentId) },
            actuelles,
          )
          actuelles = [...actuelles.filter((i) => i.id !== inscription.id), inscription]
          if (statut === 'attente') resultat.enAttente++
          else resultat.inscrits++
        } catch (e) {
          resultat.echecs.push({ studentId, raison: e instanceof Error ? e.message : 'Inscription impossible.' })
        }
      }
      return resultat
    },
    onSuccess: invalidate,
  })
}

/**
 * Arrête une inscription : le mois d'arrêt reste dû, les mensualités suivantes sans règlement disparaissent. Quitter la
 * liste d'attente supprime simplement la ligne (rien n'avait été facturé).
 */
export function useArreterInscription() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async ({ id, dateArret }: { id: string; dateArret?: string }) => {
      const inscription = cachedInscriptions.find((i) => i.id === id)
      if (!inscription) throw new Error('Inscription introuvable.')
      const club = cachedClubs.find((c) => c.id === inscription.clubId)
      if (inscription.statut === 'attente') {
        const { error } = await supabase.from('club_inscriptions').delete().eq('id', id)
        if (error) throw error
        await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'delete', oldData: { club: club ? libelleClub(club) : undefined, student_id: inscription.studentId, statut: 'attente' } })
        return
      }
      const date = dateArret || aujourdhuiLocalISO()
      const { error } = await supabase.from('club_inscriptions').update({ statut: 'arrete', date_arret: date }).eq('id', id)
      if (error) throw error
      if (club) await synchroniserEcheances(club, [{ ...inscription, statut: 'arrete', dateArret: date }])
      await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'update', oldData: { statut: inscription.statut }, newData: { statut: 'arrete', date_arret: date, club: club ? libelleClub(club) : undefined } })
    },
    onSuccess: invalidate,
  })
}

/** Fait passer l'élève suivant de la liste d'attente à inscrit (manuel) : son premier mois dû est celui de la promotion. */
export function usePromouvoirInscription() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async (id: string) => {
      const inscription = cachedInscriptions.find((i) => i.id === id)
      if (!inscription || inscription.statut !== 'attente') throw new Error("Cet élève n'est pas sur la liste d'attente.")
      const club = cachedClubs.find((c) => c.id === inscription.clubId)
      if (!club) throw new Error('Club introuvable.')
      if (clubComplet(club, cachedInscriptions)) throw new Error('Le club est complet : libérez une place avant de promouvoir.')
      const date = aujourdhuiLocalISO()
      const { error } = await supabase.from('club_inscriptions').update({ statut: 'actif', date_inscription: date }).eq('id', id)
      if (error) throw error
      await synchroniserEcheances(club, [{ ...inscription, statut: 'actif', dateInscription: date }])
      await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'update', oldData: { statut: 'attente' }, newData: { statut: 'actif', club: libelleClub(club), date_inscription: date } })
    },
    onSuccess: invalidate,
  })
}

/** Exonère (ou non) une inscription : les mensualités sans règlement passent à 0 (ou reprennent le tarif). */
export function useSetExoneration() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: async ({ id, exonere, motif }: { id: string; exonere: boolean; motif: string }) => {
      const inscription = cachedInscriptions.find((i) => i.id === id)
      if (!inscription) throw new Error('Inscription introuvable.')
      const motifNet = exonere ? motif.trim() : ''
      const { error } = await supabase.from('club_inscriptions').update({ exonere, motif_exoneration: motifNet }).eq('id', id)
      if (error) throw error
      const club = cachedClubs.find((c) => c.id === inscription.clubId)
      if (club) await synchroniserEcheances(club, facturables([{ ...inscription, exonere, motifExoneration: motifNet }]))
      await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'update', oldData: { exonere: inscription.exonere }, newData: { exonere, motif_exoneration: motifNet, club: club ? libelleClub(club) : undefined } })
    },
    onSuccess: invalidate,
  })
}
