import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ClubImputation, ClubReglement, ClubRelance, LangueRelance, ModeReglement, StatutReglement } from '../data/clubs'
import { aujourdhuiLocalISO } from '../utils/soutienSeances'
import { prochainNumeroReglement, type ImputationPrevue } from '../utils/clubsFinance'
import { getAnneesScolairesSnapshot, useAnneesLoaded } from './anneesScolairesService'
import { logAudit } from './auditLogService'
import { resynchroniserInscriptions } from './clubsService'
import { getCurrentUserIdSnapshot } from './currentUser'
import { getViewedYearIdSnapshot, useViewedYearId } from './viewedYear'

// L'argent encaissé (règlements, imputations, relances) n'est lisible et modifiable que par les comptes ayant le droit
// « clubsPaiements » : la base l'impose (RLS, migration 079). Les hooks de lecture reçoivent donc `enabled` = droit d'aperçu.

interface ReglementRow {
  id: string
  numero: string
  famille_cle: string
  famille_libelle: string
  date_reglement: string
  mode: ModeReglement
  reference: string
  montant_centimes: number
  statut: StatutReglement
  motif_annulation: string
  annule_le: string | null
  created_at: string
}

interface ImputationRow {
  id: string
  reglement_id: string
  echeance_id: string
  montant_centimes: number
}

interface RelanceRow {
  id: string
  famille_cle: string
  famille_libelle: string
  montant_du_centimes: number
  langue: LangueRelance
  envoye_le: string
}

function rowToReglement(row: ReglementRow): ClubReglement {
  return {
    id: row.id,
    numero: row.numero,
    familleCle: row.famille_cle,
    familleLibelle: row.famille_libelle,
    dateReglement: row.date_reglement,
    mode: row.mode,
    reference: row.reference ?? '',
    montantCentimes: row.montant_centimes,
    statut: row.statut,
    motifAnnulation: row.motif_annulation ?? '',
    annuleLe: row.annule_le,
    createdAt: row.created_at,
  }
}

function rowToImputation(row: ImputationRow): ClubImputation {
  return { id: row.id, reglementId: row.reglement_id, echeanceId: row.echeance_id, montantCentimes: row.montant_centimes }
}

function rowToRelance(row: RelanceRow): ClubRelance {
  return { id: row.id, familleCle: row.famille_cle, familleLibelle: row.famille_libelle, montantDuCentimes: row.montant_du_centimes, langue: row.langue, envoyeLe: row.envoye_le }
}

const REGLEMENTS_KEY = ['clubReglements']
const IMPUTATIONS_KEY = ['clubImputations']
const RELANCES_KEY = ['clubRelances']
const ECHEANCES_KEY = ['clubEcheances']

let cachedReglements: ClubReglement[] = []
let cachedImputations: ClubImputation[] = []
let cachedRelances: ClubRelance[] = []

export function getClubReglementsSnapshot(): ClubReglement[] {
  return cachedReglements
}

export function getClubImputationsSnapshot(): ClubImputation[] {
  return cachedImputations
}

export function getClubRelancesSnapshot(): ClubRelance[] {
  return cachedRelances
}

const PAGE = 1000

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

async function fetchReglements(yearId: string): Promise<ClubReglement[]> {
  const rows = await fetchTout<ReglementRow>((from, to) => supabase.from('club_reglements').select('*').eq('annee_scolaire_id', yearId).order('numero', { ascending: false }).range(from, to))
  return rows.map(rowToReglement)
}

async function fetchImputations(yearId: string): Promise<ClubImputation[]> {
  const rows = await fetchTout<ImputationRow>((from, to) =>
    supabase.from('club_imputations').select('*, club_reglements!inner(annee_scolaire_id)').eq('club_reglements.annee_scolaire_id', yearId).order('id').range(from, to),
  )
  return rows.map(rowToImputation)
}

async function fetchRelances(yearId: string): Promise<ClubRelance[]> {
  const rows = await fetchTout<RelanceRow>((from, to) => supabase.from('club_relances').select('*').eq('annee_scolaire_id', yearId).order('envoye_le', { ascending: false }).range(from, to))
  return rows.map(rowToRelance)
}

export function useClubReglements(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...REGLEMENTS_KEY, viewedYearId],
    queryFn: () => fetchReglements(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  if (query.data) cachedReglements = query.data
  return query
}

export function useClubImputations(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...IMPUTATIONS_KEY, viewedYearId],
    queryFn: () => fetchImputations(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  if (query.data) cachedImputations = query.data
  return query
}

export function useClubRelances(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...RELANCES_KEY, viewedYearId],
    queryFn: () => fetchRelances(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  if (query.data) cachedRelances = query.data
  return query
}

function useInvalidatePaiements() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: REGLEMENTS_KEY }),
      queryClient.invalidateQueries({ queryKey: IMPUTATIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: RELANCES_KEY }),
      queryClient.invalidateQueries({ queryKey: ECHEANCES_KEY }),
    ])
}

// ───────────────────────── Règlements ─────────────────────────

export interface ReglementInput {
  familleCle: string
  familleLibelle: string
  /** AAAA-MM-JJ, aujourd'hui par défaut. */
  dateReglement?: string
  mode: ModeReglement
  /** N° de chèque et banque, ou référence du virement. */
  reference: string
  montantCentimes: number
  /** Répartition calculée par `imputerReglement` : doit couvrir exactement le montant (pas de trop-perçu). */
  imputations: ImputationPrevue[]
}

const POSTGRES_UNIQUE_VIOLATION = '23505'
const ESSAIS_NUMERO = 6

/** Numéros déjà pris cette année (annulés compris : un numéro n'est jamais réutilisé), lus en base pour éviter les doublons entre postes. */
async function numerosDeLAnnee(yearId: string): Promise<string[]> {
  const rows = await fetchTout<{ numero: string }>((from, to) => supabase.from('club_reglements').select('numero').eq('annee_scolaire_id', yearId).order('numero').range(from, to))
  return rows.map((r) => r.numero)
}

/** Ce qui a déjà été payé sur ces mensualités (règlements valides), lu en base juste avant d'enregistrer. */
async function dejaPaye(echeanceIds: string[]): Promise<Map<string, number>> {
  const paye = new Map<string, number>()
  for (let i = 0; i < echeanceIds.length; i += 100) {
    const { data, error } = await supabase
      .from('club_imputations')
      .select('echeance_id, montant_centimes, club_reglements!inner(statut)')
      .in('echeance_id', echeanceIds.slice(i, i + 100))
      .eq('club_reglements.statut', 'valide')
    if (error) throw error
    for (const r of data as { echeance_id: string; montant_centimes: number }[]) paye.set(r.echeance_id, (paye.get(r.echeance_id) ?? 0) + r.montant_centimes)
  }
  return paye
}

/**
 * Enregistre un règlement et sa répartition sur les mensualités. Le numéro REC-AAAA-NNNN est calculé puis, si un autre
 * poste a pris le même entre-temps (contrainte d'unicité), recalculé. Avant d'écrire, on vérifie en base qu'aucune
 * mensualité visée n'a été payée entre-temps.
 */
export function useEnregistrerReglement() {
  const invalidate = useInvalidatePaiements()
  return useMutation({
    mutationFn: async (input: ReglementInput): Promise<{ id: string; numero: string }> => {
      if (input.montantCentimes <= 0) throw new Error('Le montant doit être supérieur à 0.')
      const total = input.imputations.reduce((n, i) => n + i.montantCentimes, 0)
      if (input.imputations.length === 0 || total !== input.montantCentimes) throw new Error('Le règlement doit être entièrement réparti sur des mensualités (pas de trop-perçu).')

      const yearId = getViewedYearIdSnapshot()
      const annee = getAnneesScolairesSnapshot().find((a) => a.id === yearId)
      if (!annee) throw new Error('Année scolaire introuvable.')

      // Les mensualités visées ont-elles encore de la place pour ces montants ?
      const ids = input.imputations.map((i) => i.echeanceId)
      const { data: echeances, error: echeancesError } = await supabase.from('club_echeances').select('id, montant_centimes').in('id', ids)
      if (echeancesError) throw echeancesError
      const montants = new Map((echeances as { id: string; montant_centimes: number }[]).map((e) => [e.id, e.montant_centimes]))
      const paye = await dejaPaye(ids)
      for (const imp of input.imputations) {
        const montant = montants.get(imp.echeanceId)
        if (montant === undefined) throw new Error("Une mensualité a disparu depuis l'ouverture de la fenêtre : rechargez la page.")
        if (imp.montantCentimes + (paye.get(imp.echeanceId) ?? 0) > montant) throw new Error('Une mensualité a été payée entre-temps : rechargez la page et recommencez.')
      }

      let reglement: ReglementRow | null = null
      for (let essai = 0; essai < ESSAIS_NUMERO && !reglement; essai++) {
        const numero = prochainNumeroReglement(await numerosDeLAnnee(yearId), annee.anneeDebut)
        const { data, error } = await supabase
          .from('club_reglements')
          .insert({
            annee_scolaire_id: yearId,
            numero,
            famille_cle: input.familleCle,
            famille_libelle: input.familleLibelle,
            date_reglement: input.dateReglement || aujourdhuiLocalISO(),
            mode: input.mode,
            reference: input.reference.trim(),
            montant_centimes: input.montantCentimes,
            created_by: getCurrentUserIdSnapshot(),
          })
          .select('*')
          .single()
        if (!error) reglement = data as ReglementRow
        else if (error.code !== POSTGRES_UNIQUE_VIOLATION) throw error
      }
      if (!reglement) throw new Error("Impossible d'attribuer un numéro de reçu : réessayez dans un instant.")

      const { error: imputationError } = await supabase.from('club_imputations').insert(input.imputations.map((i) => ({ reglement_id: reglement.id, echeance_id: i.echeanceId, montant_centimes: i.montantCentimes })))
      if (imputationError) {
        // Un règlement sans répartition n'a pas de sens : on l'efface plutôt que de laisser un reçu orphelin.
        await supabase.from('club_reglements').delete().eq('id', reglement.id)
        throw imputationError
      }
      await logAudit({
        tableName: 'club_reglements',
        recordId: reglement.id,
        action: 'insert',
        newData: { numero: reglement.numero, famille: input.familleLibelle, montant_centimes: input.montantCentimes, mode: input.mode, mensualites: input.imputations.length },
      })
      return { id: reglement.id, numero: reglement.numero }
    },
    onSuccess: invalidate,
  })
}

/** Annule un règlement avec son motif : il n'est jamais supprimé, garde son numéro, et ses mensualités redeviennent à payer. */
export function useAnnulerReglement() {
  const invalidate = useInvalidatePaiements()
  return useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif: string }) => {
      const motifNet = motif.trim()
      if (!motifNet) throw new Error("Le motif de l'annulation est obligatoire.")
      const avant = cachedReglements.find((r) => r.id === id)
      if (avant && avant.statut === 'annule') throw new Error('Ce règlement est déjà annulé.')
      const { error } = await supabase
        .from('club_reglements')
        .update({ statut: 'annule', motif_annulation: motifNet, annule_par: getCurrentUserIdSnapshot(), annule_le: new Date().toISOString() })
        .eq('id', id)
        .eq('statut', 'valide')
      if (error) throw error
      // Les mensualités qu'il payait redeviennent à payer : celles qui n'étaient conservées que par ce paiement (mois d'après
      // l'arrêt de l'élève, par exemple) doivent disparaître.
      const { data: payees, error: payeesError } = await supabase.from('club_imputations').select('club_echeances!inner(inscription_id)').eq('reglement_id', id)
      if (payeesError) throw payeesError
      const inscriptionIds = [...new Set((payees as unknown as { club_echeances: { inscription_id: string } }[]).map((p) => p.club_echeances.inscription_id))]
      await resynchroniserInscriptions(inscriptionIds)
      await logAudit({
        tableName: 'club_reglements',
        recordId: id,
        action: 'update',
        oldData: avant ? { statut: 'valide', numero: avant.numero, montant_centimes: avant.montantCentimes } : undefined,
        newData: { statut: 'annule', motif_annulation: motifNet },
      })
    },
    onSuccess: invalidate,
  })
}

// ───────────────────────── Relances ─────────────────────────

export interface RelanceInput {
  familleCle: string
  familleLibelle: string
  montantDuCentimes: number
  langue: LangueRelance
}

/** Garde la trace d'une relance envoyée à une famille (historique ; rien n'est envoyé automatiquement). */
export function useEnregistrerRelance() {
  const invalidate = useInvalidatePaiements()
  return useMutation({
    mutationFn: async (input: RelanceInput): Promise<void> => {
      const { data, error } = await supabase
        .from('club_relances')
        .insert({
          annee_scolaire_id: getViewedYearIdSnapshot(),
          famille_cle: input.familleCle,
          famille_libelle: input.familleLibelle,
          montant_du_centimes: input.montantDuCentimes,
          langue: input.langue,
          created_by: getCurrentUserIdSnapshot(),
        })
        .select('id')
        .single()
      if (error) throw error
      await logAudit({ tableName: 'club_relances', recordId: (data as { id: string }).id, action: 'insert', newData: { famille: input.familleLibelle, montant_du_centimes: input.montantDuCentimes, langue: input.langue } })
    },
    onSuccess: invalidate,
  })
}
