export interface ReservationSalle {
  id: string
  salleId: string
  titre: string
  date: string
  heureDebut: string
  heureFin: string
  reservePar: string | null
}
