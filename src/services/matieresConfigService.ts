import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { NIVEAUX, type MatiereConfig, type MatiereNiveauConfig } from '../data/referentiel'

const QUERY_KEY = ['matieresConfig']

interface MatiereRow {
  id: string
  nom: string
  nom_ar: string
  code: string
  rtl: boolean
}

interface MatiereNiveauConfigRow {
  matiere_id: string
  niveau: string
  active: boolean
  coefficient: number
  exporter_massar: boolean
  afficher_bulletin: boolean
  exporter_par_chapitres: boolean
  hors_max_examens: boolean
}

function rowToNiveauConfig(row: MatiereNiveauConfigRow): MatiereNiveauConfig {
  return {
    active: row.active,
    coefficient: row.coefficient,
    exporterMassar: row.exporter_massar,
    afficherBulletin: row.afficher_bulletin,
    exporterParChapitres: row.exporter_par_chapitres,
    horsMaxExamens: row.hors_max_examens,
  }
}

async function fetchMatieresConfig(): Promise<MatiereConfig[]> {
  const [matieresRes, configRes] = await Promise.all([
    supabase.from('matieres').select('*'),
    supabase.from('matiere_niveau_config').select('*'),
  ])
  if (matieresRes.error) throw matieresRes.error
  if (configRes.error) throw configRes.error
  const matieres = matieresRes.data as MatiereRow[]
  const configs = configRes.data as MatiereNiveauConfigRow[]
  return matieres.map((m) => {
    const parNiveau: Record<string, MatiereNiveauConfig> = {}
    configs
      .filter((c) => c.matiere_id === m.id)
      .forEach((c) => {
        parNiveau[c.niveau] = rowToNiveauConfig(c)
      })
    return { id: m.id, nom: m.nom, nomAr: m.nom_ar, code: m.code, rtl: m.rtl, parNiveau }
  })
}

export function useMatieresConfig(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchMatieresConfig, enabled })
  useEffect(() => {
    if (query.data) cachedMatieresConfig = query.data
  }, [query.data])
  return query
}

let cachedMatieresConfig: MatiereConfig[] = []

/** Instantané synchrone pour les utilitaires hors-React (excelImport.ts). */
export function getMatieresConfigSnapshot(): MatiereConfig[] {
  return cachedMatieresConfig
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
}

function defaultNiveauConfigRow(coefficient = 2) {
  return {
    active: true,
    coefficient,
    exporter_massar: true,
    afficher_bulletin: true,
    exporter_par_chapitres: false,
    hors_max_examens: false,
  }
}

export function useAddMatiere() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ nom, code }: { nom: string; code: string }) => {
      const { data, error } = await supabase.from('matieres').insert({ nom, nom_ar: '', code, rtl: false }).select('id').single()
      if (error) throw error
      const rows = NIVEAUX.map((niveau) => ({ matiere_id: data.id, niveau, ...defaultNiveauConfigRow() }))
      const { error: configError } = await supabase.from('matiere_niveau_config').insert(rows)
      if (configError) throw configError
      return data.id as string
    },
    onSuccess: invalidate,
  })
}

export function useUpdateMatiereInfo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (m: { id: string; nom: string; nomAr: string; code: string; rtl: boolean }) => {
      const { error } = await supabase.from('matieres').update({ nom: m.nom, nom_ar: m.nomAr, code: m.code, rtl: m.rtl }).eq('id', m.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateMatiereNiveauConfig() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ matiereId, parNiveau }: { matiereId: string; parNiveau: Record<string, MatiereNiveauConfig> }) => {
      const rows = Object.entries(parNiveau).map(([niveau, c]) => ({
        matiere_id: matiereId,
        niveau,
        active: c.active,
        coefficient: c.coefficient,
        exporter_massar: c.exporterMassar,
        afficher_bulletin: c.afficherBulletin,
        exporter_par_chapitres: c.exporterParChapitres,
        hors_max_examens: c.horsMaxExamens,
      }))
      const { error } = await supabase.from('matiere_niveau_config').upsert(rows, { onConflict: 'matiere_id,niveau' })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useToggleMatiereNiveau() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ matiereId, niveau, active }: { matiereId: string; niveau: string; active: boolean }) => {
      const { error } = await supabase
        .from('matiere_niveau_config')
        .update({ active })
        .eq('matiere_id', matiereId)
        .eq('niveau', niveau)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMatiere() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('matieres').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
