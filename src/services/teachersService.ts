import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Teacher } from '../data/teachers'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

interface TeacherRow {
  id: string
  prenom: string
  nom: string
  email: string
  telephone_mobile: string
  telephone_domicile: string
  matricule: string
  plateforme: string
  id_meeting: string
  lien_visio: string
  statut: Teacher['statut']
  type: Teacher['type']
  niveaux: string[]
  matieres: string[]
  classes: string[]
  annee_scolaire_id: string
}

function rowToTeacher(row: TeacherRow): Teacher {
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    email: row.email,
    telephoneMobile: row.telephone_mobile,
    telephoneDomicile: row.telephone_domicile,
    matricule: row.matricule,
    plateforme: row.plateforme,
    idMeeting: row.id_meeting,
    lienVisio: row.lien_visio,
    statut: row.statut,
    type: row.type,
    niveaux: row.niveaux ?? [],
    matieres: row.matieres ?? [],
    classes: row.classes ?? [],
    anneeScolaireId: row.annee_scolaire_id,
  }
}

function teacherToRow(t: Omit<Teacher, 'id'>) {
  return {
    prenom: t.prenom,
    nom: t.nom,
    email: t.email,
    telephone_mobile: t.telephoneMobile,
    telephone_domicile: t.telephoneDomicile,
    matricule: t.matricule,
    plateforme: t.plateforme,
    id_meeting: t.idMeeting,
    lien_visio: t.lienVisio,
    statut: t.statut,
    type: t.type,
    niveaux: t.niveaux,
    matieres: t.matieres,
    classes: t.classes,
  }
}

export async function fetchTeachers(yearId: string): Promise<Teacher[]> {
  const { data, error } = await supabase.from('teachers').select('*').eq('annee_scolaire_id', yearId).order('nom', { ascending: true })
  if (error) throw error
  return (data as TeacherRow[]).map(rowToTeacher)
}

export function useTeachers(enabled = true) {
  // Attend que la liste des années ait réellement chargé avant de filtrer par année : sinon
  // getViewedYearIdSnapshot() retombe sur l'id de secours (non-UUID), rejeté par Postgres.
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({ queryKey: ['teachers', viewedYearId], queryFn: () => fetchTeachers(viewedYearId), enabled: enabled && anneesLoaded })
  // Affectation synchrone (pas un useEffect) : sinon getTeachersSnapshot() resterait en retard
  // d'un rendu par rapport à query.data à chaque changement d'année. Voir le commentaire détaillé
  // dans classSchedulesService.ts (useClassSchedules), où ce décalage a été diagnostiqué.
  if (query.data) cachedTeachers = query.data
  return query
}

let cachedTeachers: Teacher[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getTeachersSnapshot(): Teacher[] {
  return cachedTeachers
}

/** Écriture directe (hors hook React) pour l'import Excel en masse. */
export async function insertTeacher(data: Omit<Teacher, 'id'>): Promise<string> {
  const { data: row, error } = await supabase
    .from('teachers')
    .insert({ ...teacherToRow(data), annee_scolaire_id: getViewedYearIdSnapshot() })
    .select('id')
    .single()
  if (error) throw error
  return row.id as string
}

export async function updateTeacherRow(id: string, data: Omit<Teacher, 'id'>): Promise<void> {
  const { error } = await supabase.from('teachers').update(teacherToRow(data)).eq('id', id)
  if (error) throw error
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['teachers'] })
}

export function useAddTeacher() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (data: Omit<Teacher, 'id'>) => insertTeacher(data),
    onSuccess: invalidate,
  })
}

export function useUpdateTeacher() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Teacher, 'id'> }) => updateTeacherRow(id, data),
    onSuccess: invalidate,
  })
}

export function useDeleteTeacher() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teachers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
