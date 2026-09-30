import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ProfileRole } from '../data/profiles'
import { canDraftType, type NoteType } from '../data/notesService'
import { getProfilesSnapshot } from './profilesService'

const PROFILES_QUERY_KEY = ['profiles']

/** Même mécanisme que le logo de l'établissement (schoolIdentityService.ts) : image encodée en
 * base64 stockée directement dans une colonne text, pas de stockage fichier séparé. */
export function useUploadSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, dataUrl }: { profileId: string; dataUrl: string }) => {
      const { error } = await supabase.from('profiles').update({ signature_image: dataUrl }).eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY }),
  })
}

export function useRemoveSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.from('profiles').update({ signature_image: null }).eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY }),
  })
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Profils habilités à signer un type de note donné (droit de rédaction = droit de signature dans
 * le tableau de rôles du README). Une image de signature déjà téléversée n'est pas requise pour
 * être désigné signataire : le document imprimé laisse une ligne à signer à la main si elle est
 * absente (cf. PrintableNoteService.tsx). */
export function getSignatairesForType(type: NoteType): { id: string; nomComplet: string; role: ProfileRole }[] {
  return getProfilesSnapshot()
    .filter((p) => p.actif && canDraftType(p.role, type))
    .map((p) => ({ id: p.id, nomComplet: p.nomComplet, role: p.role }))
}
