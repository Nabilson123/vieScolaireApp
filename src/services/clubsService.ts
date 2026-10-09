import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Club, ClubEcheance, ClubInscription, JourClub, StatutInscriptionClub } from '../data/clubs'
import { ajouterMois, echeancesPourInscription, moisDe, reconcilerEcheances } from '../utils/clubsFinance'
import { clubComplet, statutPourNouvelInscrit } from '../utils/clubs'
import { aujourdhuiLocalISO } from '../utils/soutienSeances'
import { getAnneesScolairesSnapshot, useAnneesLoaded } from './anneesScolairesService'
import { logAudit } from './auditLogService'
import { getCurrentUserIdSnapshot } from './currentUser'
import { getViewedYearIdSnapshot, useViewedYearId } from './viewedYear'

interface ClubRow {
  id: string
  nom: string
  description: string
  teacher_id: string | null
  intervenant_nom: string
  jour: JourClub
  heure_debut: string
  heure_fin: string
  salle_id: string | null
  places_max: number | null
  niveaux: string[]
  mensualite_centimes: number
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
  mois: string
  montant_centimes: number
  date_echeance: string
}

// Les colonnes `time` reviennent en HH:MM:SS.
const hhmm = (t: string) => t.slice(0, 5)

function rowToClub(row: ClubRow): Club {
  return {
    id: row.id,
    nom: row.nom,
    description: row.description ?? '',
    teacherId: row.teacher_id,
    intervenantNom: row.intervenant_nom ?? '',
    jour: row.jour,
    heureDebut: hhmm(row.heure_debut),
    heureFin: hhmm(row.heure_fin),
    salleId: row.salle_id,
    placesMax: row.places_max,
    niveaux: row.niveaux ?? [],
    mensualiteCentimes: row.mensualite_centimes,
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

/** Ce qui a déjà été payé, en centimes, par mensualité (règlements valides seulement). */
async function fetchPayees(echeanceIds: string[]): Promise<Map<string, number>> {
  const payees = new Map<string, number>()
  for (const tranche of parTranches(echeanceIds)) {
    const { data, error } = await supabase
      .from('club_imputations')
      .select('echeance_id, montant_centimes, club_reglements!inner(statut)')
      .in('echeance_id', tranche)
      .eq('club_reglements.statut', 'valide')
    if (error) throw error
    for (const r of data as { echeance_id: string; montant_centimes: number }[]) {
      payees.set(r.echeance_id, (payees.get(r.echeance_id) ?? 0) + r.montant_centimes)
    }
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
  aAjouter: { inscription_id: string; mois: string; montant_centimes: number; date_echeance: string }[]
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
    r.aAjouter.forEach((v) => plan.aAjouter.push({ inscription_id: inscription.id, mois: v.mois, montant_centimes: v.montantCentimes, date_echeance: v.dateEcheance }))
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
  description: string
  teacherId: string | null
  intervenantNom: string
  jour: JourClub
  heureDebut: string
  heureFin: string
  salleId: string | null
  placesMax: number | null
  niveaux: string[]
  mensualiteCentimes: number
  moisDebut: string
  moisFin: string
  jourEcheance: number
  delaiGraceJours: number
}

function clubToRow(input: ClubInput) {
  return {
    nom: input.nom,
    description: input.description,
    teacher_id: input.teacherId,
    intervenant_nom: input.intervenantNom,
    jour: input.jour,
    heure_debut: input.heureDebut,
    heure_fin: input.heureFin,
    salle_id: input.salleId,
    places_max: input.placesMax,
    niveaux: input.niveaux,
    mensualite_centimes: input.mensualiteCentimes,
    mois_debut: input.moisDebut,
    mois_fin: input.moisFin,
    jour_echeance: input.jourEcheance,
    delai_grace_jours: input.delaiGraceJours,
  }
}

/** Le changement touche-t-il les mensualités (tarif, mois facturés, jour d'échéance) ? */
export function tarifOuPeriodeModifie(avant: Club, apres: Pick<ClubInput, 'mensualiteCentimes' | 'moisDebut' | 'moisFin' | 'jourEcheance'>): boolean {
  return avant.mensualiteCentimes !== apres.mensualiteCentimes || avant.moisDebut !== apres.moisDebut || avant.moisFin !== apres.moisFin || avant.jourEcheance !== apres.jourEcheance
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
      const dejaLa = new Set(cachedClubs.map((c) => c.nom.trim().toLowerCase()))
      const aCreer = sources.filter((c) => !dejaLa.has(c.nom.trim().toLowerCase()))
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
      const existante = cachedInscriptions.find((i) => i.clubId === input.clubId && i.studentId === input.studentId)
      if (existante && existante.statut === 'actif') throw new Error('Cet élève est déjà inscrit à ce club.')
      if (existante && existante.statut === 'attente') throw new Error("Cet élève est déjà sur la liste d'attente de ce club.")

      const statut = statutPourNouvelInscrit(club, cachedInscriptions)
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
        : supabase.from('club_inscriptions').insert({ ...champs, club_id: input.clubId, student_id: input.studentId }).select('*').single()
      const { data, error } = await requete
      if (error) {
        // 23505 : l'élève est déjà inscrit à ce club (contrainte d'unicité).
        if (error.code === '23505') throw new Error('Cet élève est déjà inscrit à ce club.')
        throw error
      }
      const inscription = rowToInscription(data as InscriptionRow)
      await synchroniserEcheances(club, facturables([inscription]))
      await logAudit({ tableName: 'club_inscriptions', recordId: inscription.id, action: existante ? 'update' : 'insert', newData: { club: club.nom, student_id: input.studentId, ...champs } })
      return { id: inscription.id, statut }
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
        await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'delete', oldData: { club: club?.nom, student_id: inscription.studentId, statut: 'attente' } })
        return
      }
      const date = dateArret || aujourdhuiLocalISO()
      const { error } = await supabase.from('club_inscriptions').update({ statut: 'arrete', date_arret: date }).eq('id', id)
      if (error) throw error
      if (club) await synchroniserEcheances(club, [{ ...inscription, statut: 'arrete', dateArret: date }])
      await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'update', oldData: { statut: inscription.statut }, newData: { statut: 'arrete', date_arret: date, club: club?.nom } })
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
      await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'update', oldData: { statut: 'attente' }, newData: { statut: 'actif', club: club.nom, date_inscription: date } })
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
      await logAudit({ tableName: 'club_inscriptions', recordId: id, action: 'update', oldData: { exonere: inscription.exonere }, newData: { exonere, motif_exoneration: motifNet, club: club?.nom } })
    },
    onSuccess: invalidate,
  })
}
