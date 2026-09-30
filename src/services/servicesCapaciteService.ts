import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

/** Icônes disponibles pour un créneau fixe, même esprit visuel que les marqueurs transport (icône + heure). */
export type CreneauFixeIcon = 'cantine' | 'recreation' | 'etude' | 'transport' | 'autre'

/**
 * Créneau récurrent affiché sur la timeline du Cockpit (récréation, cantine, étude, transport de
 * sortie...) — pas une donnée du jour, une config qui s'applique par défaut tous les jours d'école.
 * `days` (sous-ensemble de SCHEDULE_DAYS, ex. ['LUNDI','MARDI','MERCREDI','JEUDI']) restreint le
 * créneau à certains jours — ex. cantine non assurée le vendredi (sortie à 12h), ou un transport de
 * sortie spécifique au vendredi uniquement. Vide/absent = tous les jours.
 */
export interface CreneauFixe {
  label: string
  start: string
  end: string
  icon?: CreneauFixeIcon
  days?: string[]
}

export interface ServicesCapacite {
  id: string
  transportCapacite: number
  /** Champ historique, obsolète depuis le découpage en deux réfectoires (voir cantineCapacite{SousSol,Terrasse}) — conservé, jamais renseigné par l'UI. */
  cantineCapacite: number
  cantineCapaciteSousSol: number
  cantineCapaciteTerrasse: number
  /** Sous-ensemble du Réfectoire Sous-Sol réservé à la maternelle (PS/MS/GS) — capacité dédiée pour la tuile « Cantine préscolaire ». */
  cantineCapacitePrescolaire: number
  gardeCapacite: number
  transportHeureMatin: string
  transportHeureSoirPrimaire: string
  transportHeureSoirCollege: string
  /** Horodatage de la dernière modification de la rotation collège (quelles lignes la font cette semaine). */
  transportRotationUpdatedAt: string | null
  /** Lien d'invitation du groupe WhatsApp de l'équipe transport (chat.whatsapp.com/...), utilisé
   * pour prévenir le groupe des sorties/retours anticipés d'élèves affectés à une ligne. */
  transportWhatsappGroupeUrl: string
  creneauxFixes: CreneauFixe[]
}

interface ServicesCapaciteRow {
  id: string
  transport_capacite: number
  cantine_capacite: number
  cantine_capacite_sous_sol: number
  cantine_capacite_terrasse: number
  cantine_capacite_prescolaire: number
  garde_capacite: number
  transport_heure_matin: string
  transport_heure_soir_primaire: string
  transport_heure_soir_college: string
  transport_rotation_updated_at: string | null
  transport_whatsapp_groupe_url: string
  creneaux_fixes: CreneauFixe[]
}

function rowToCapacite(row: ServicesCapaciteRow): ServicesCapacite {
  return {
    id: row.id,
    transportCapacite: row.transport_capacite,
    cantineCapacite: row.cantine_capacite,
    cantineCapaciteSousSol: row.cantine_capacite_sous_sol,
    cantineCapaciteTerrasse: row.cantine_capacite_terrasse,
    cantineCapacitePrescolaire: row.cantine_capacite_prescolaire,
    gardeCapacite: row.garde_capacite,
    transportHeureMatin: row.transport_heure_matin,
    transportHeureSoirPrimaire: row.transport_heure_soir_primaire,
    transportHeureSoirCollege: row.transport_heure_soir_college,
    transportRotationUpdatedAt: row.transport_rotation_updated_at,
    transportWhatsappGroupeUrl: row.transport_whatsapp_groupe_url ?? '',
    creneauxFixes: row.creneaux_fixes ?? [],
  }
}

const QUERY_KEY = ['servicesCapacite']
let cachedCapacite: ServicesCapacite | null = null

async function fetchServicesCapacite(): Promise<ServicesCapacite> {
  const { data, error } = await supabase.from('services_capacite').select('*').limit(1).single()
  if (error) throw error
  return rowToCapacite(data as ServicesCapaciteRow)
}

export function useServicesCapacite(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchServicesCapacite, enabled })
  // Affectation synchrone (pas un useEffect) : sinon getServicesCapaciteSnapshot() resterait en
  // retard d'un rendu par rapport à query.data (ex. buildDayTimeline() appelé dans le même rendu par
  // CockpitLive.tsx lirait encore l'ancienne valeur juste après une mutation). Voir le commentaire
  // détaillé dans classSchedulesService.ts (useClassSchedules), où ce décalage a été diagnostiqué.
  if (query.data) cachedCapacite = query.data
  return query
}

export function getServicesCapaciteSnapshot(): ServicesCapacite | null {
  return cachedCapacite
}

export function useUpdateServicesCapacite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<ServicesCapacite, 'id'>> & { id: string }) => {
      const {
        id,
        transportCapacite,
        cantineCapacite,
        cantineCapaciteSousSol,
        cantineCapaciteTerrasse,
        cantineCapacitePrescolaire,
        gardeCapacite,
        transportHeureMatin,
        transportHeureSoirPrimaire,
        transportHeureSoirCollege,
        transportRotationUpdatedAt,
        transportWhatsappGroupeUrl,
        creneauxFixes,
      } = patch
      const row: Record<string, number | string | null | CreneauFixe[]> = {}
      if (transportCapacite !== undefined) row.transport_capacite = transportCapacite
      if (cantineCapacite !== undefined) row.cantine_capacite = cantineCapacite
      if (cantineCapaciteSousSol !== undefined) row.cantine_capacite_sous_sol = cantineCapaciteSousSol
      if (cantineCapaciteTerrasse !== undefined) row.cantine_capacite_terrasse = cantineCapaciteTerrasse
      if (cantineCapacitePrescolaire !== undefined) row.cantine_capacite_prescolaire = cantineCapacitePrescolaire
      if (gardeCapacite !== undefined) row.garde_capacite = gardeCapacite
      if (transportHeureMatin !== undefined) row.transport_heure_matin = transportHeureMatin
      if (transportHeureSoirPrimaire !== undefined) row.transport_heure_soir_primaire = transportHeureSoirPrimaire
      if (transportHeureSoirCollege !== undefined) row.transport_heure_soir_college = transportHeureSoirCollege
      if (transportRotationUpdatedAt !== undefined) row.transport_rotation_updated_at = transportRotationUpdatedAt
      if (transportWhatsappGroupeUrl !== undefined) row.transport_whatsapp_groupe_url = transportWhatsappGroupeUrl
      if (creneauxFixes !== undefined) row.creneaux_fixes = creneauxFixes
      const { error } = await supabase.from('services_capacite').update(row).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
