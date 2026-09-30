import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { TypeControleNote, NiveauAcquisition, Objectif, Competence, Appreciation } from '../data/controlesConfig'

const QUERY_KEY = ['controlesConfig']

interface ControlesConfigData {
  typesControleNotes: TypeControleNote[]
  niveauxAcquisition: NiveauAcquisition[]
  objectifs: Objectif[]
  competences: Competence[]
  appreciations: Appreciation[]
}

async function fetchControlesConfig(): Promise<ControlesConfigData> {
  const [typesRes, niveauxRes, objectifsRes, competencesRes, appreciationsRes] = await Promise.all([
    supabase.from('types_controle_notes').select('*'),
    supabase.from('niveaux_acquisition').select('*'),
    supabase.from('objectifs_pedagogiques').select('*'),
    supabase.from('competences').select('*'),
    supabase.from('appreciations').select('*'),
  ])
  if (typesRes.error) throw typesRes.error
  if (niveauxRes.error) throw niveauxRes.error
  if (objectifsRes.error) throw objectifsRes.error
  if (competencesRes.error) throw competencesRes.error
  if (appreciationsRes.error) throw appreciationsRes.error
  return {
    typesControleNotes: typesRes.data as TypeControleNote[],
    niveauxAcquisition: niveauxRes.data as NiveauAcquisition[],
    objectifs: objectifsRes.data as Objectif[],
    competences: competencesRes.data as Competence[],
    appreciations: appreciationsRes.data as Appreciation[],
  }
}

export function useControlesConfig(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchControlesConfig, enabled })
  useEffect(() => {
    if (query.data) cachedControlesConfig = query.data
  }, [query.data])
  return query
}

/** Instantané synchrone pour les utilitaires hors-React (backupExport.ts). */
let cachedControlesConfig: ControlesConfigData = {
  typesControleNotes: [],
  niveauxAcquisition: [],
  objectifs: [],
  competences: [],
  appreciations: [],
}

export function getControlesConfigSnapshot(): ControlesConfigData {
  return cachedControlesConfig
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
}

// Types de contrôle
export function useAddTypeControleNote() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (t: { nom: string; ponderation: number }) => {
      const { error } = await supabase.from('types_controle_notes').insert(t)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateTypeControleNote() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (t: TypeControleNote) => {
      const { error } = await supabase
        .from('types_controle_notes')
        .update({ nom: t.nom, ponderation: t.ponderation })
        .eq('id', t.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteTypeControleNote() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('types_controle_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Niveaux d'acquisition
export function useAddNiveauAcquisition() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (n: { nom: string; couleur: NiveauAcquisition['couleur'] }) => {
      const { error } = await supabase.from('niveaux_acquisition').insert(n)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteNiveauAcquisition() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('niveaux_acquisition').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Objectifs pédagogiques
export function useAddObjectif() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (o: { matiere: string; niveau: string; texte: string }) => {
      const { error } = await supabase.from('objectifs_pedagogiques').insert(o)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteObjectif() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objectifs_pedagogiques').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Compétences
export function useAddCompetence() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (c: { matiere: string; niveau: string; texte: string }) => {
      const { error } = await supabase.from('competences').insert(c)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteCompetence() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('competences').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Appréciations
export function useAddAppreciation() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (a: { categorie: Appreciation['categorie']; texte: string }) => {
      const { error } = await supabase.from('appreciations').insert(a)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteAppreciation() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appreciations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
