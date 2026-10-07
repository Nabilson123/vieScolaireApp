import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ReservationSalle } from '../data/reservationsSalles'
import { timeToMinutes } from '../data/classSchedules'
import { getAllClassSchedulesSnapshot } from './classSchedulesService'
import { getWeekdayName } from '../utils/replacementAggregation'
import { getCurrentUserIdSnapshot } from './currentUser'
import { getViewedYearIdSnapshot } from './viewedYear'
import { getSoutienSeancesSnapshot } from './soutienService'
import { seanceActiveLe } from '../utils/soutienSeances'

interface ReservationSalleRow {
  id: string
  salle_id: string
  titre: string
  date: string
  heure_debut: string
  heure_fin: string
  reserve_par: string | null
}

function rowToReservation(row: ReservationSalleRow): ReservationSalle {
  return {
    id: row.id,
    salleId: row.salle_id,
    titre: row.titre,
    date: row.date,
    heureDebut: row.heure_debut,
    heureFin: row.heure_fin,
    reservePar: row.reserve_par,
  }
}

const QUERY_KEY = ['reservationsSalles']

async function fetchReservationsSalles(): Promise<ReservationSalle[]> {
  const { data, error } = await supabase
    .from('reservations_salles')
    .select('id, salle_id, titre, date, heure_debut, heure_fin, reserve_par')
    .order('date', { ascending: true })
    .order('heure_debut', { ascending: true })
  if (error) throw error
  return (data as ReservationSalleRow[]).map(rowToReservation)
}

export function useReservationsSalles(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchReservationsSalles, enabled })
  if (query.data) cachedReservations = query.data
  return query
}

let cachedReservations: ReservationSalle[] = []

export function getReservationsSallesSnapshot(): ReservationSalle[] {
  return cachedReservations
}

export function useAddReservationSalle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { salleId: string; titre: string; date: string; heureDebut: string; heureFin: string }) => {
      const { error } = await supabase.from('reservations_salles').insert({
        salle_id: input.salleId,
        titre: input.titre,
        date: input.date,
        heure_debut: input.heureDebut,
        heure_fin: input.heureFin,
        reserve_par: getCurrentUserIdSnapshot(),
        annee_scolaire_id: getViewedYearIdSnapshot(),
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteReservationSalle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reservations_salles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export interface SalleConflictResult {
  edtConflict: { classe: string; matiere: string } | null
  reservationConflict: ReservationSalle | null
  /** Séance de soutien qui a lieu dans la salle à cette date. */
  soutienConflict: { matiere: string; debut: string; fin: string } | null
}

/**
 * Avertissement non bloquant (décision validée) : vérifie le conflit contre l'EDT régulier
 * (class_schedules, toutes classes confondues) ET contre les autres réservations ponctuelles sur
 * la même salle/date. Ne bloque jamais la confirmation, juste informatif.
 */
export function detectConflictForSalle(salleId: string, date: string, heureDebut: string, heureFin: string, excludeId?: string): SalleConflictResult {
  const day = getWeekdayName(date)
  let edtConflict: { classe: string; matiere: string } | null = null
  if (day) {
    const startMin = timeToMinutes(heureDebut)
    const endMin = timeToMinutes(heureFin)
    for (const [classe, week] of Object.entries(getAllClassSchedulesSnapshot())) {
      const slot = (week[day] ?? []).find(
        (s) => s.salleId === salleId && timeToMinutes(s.start) < endMin && startMin < timeToMinutes(s.end)
      )
      if (slot) {
        edtConflict = { classe, matiere: slot.subject }
        break
      }
    }
  }

  const startMin = timeToMinutes(heureDebut)
  const endMin = timeToMinutes(heureFin)
  const reservationConflict =
    getReservationsSallesSnapshot().find(
      (r) =>
        r.id !== excludeId &&
        r.salleId === salleId &&
        r.date === date &&
        timeToMinutes(r.heureDebut) < endMin &&
        startMin < timeToMinutes(r.heureFin)
    ) ?? null

  const soutien = getSoutienSeancesSnapshot().find(
    (s) => s.salleId === salleId && seanceActiveLe(s, date) && timeToMinutes(s.heureDebut) < endMin && startMin < timeToMinutes(s.heureFin)
  )
  const soutienConflict = soutien ? { matiere: soutien.matiere, debut: soutien.heureDebut, fin: soutien.heureFin } : null

  return { edtConflict, reservationConflict, soutienConflict }
}
