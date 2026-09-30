import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type AccountType = 'staff' | 'parent' | null

/**
 * Détermine si la session connectée est un compte staff (profiles) ou parent (parents). Consommé
 * uniquement dans App.tsx pour calculer les `enabled` des ~24 hooks année-scopés/globaux existants
 * — pas de snapshot hors-React nécessaire ici (contrairement à currentUserId/profiles), rien
 * d'autre ne le consulte.
 */
export function useAccountType(uid: string | null) {
  return useQuery({
    queryKey: ['accountType', uid],
    queryFn: async (): Promise<AccountType> => {
      const [staffRes, parentRes] = await Promise.all([
        supabase.from('profiles').select('id').eq('id', uid as string).maybeSingle(),
        supabase.from('parents').select('id').eq('id', uid as string).maybeSingle(),
      ])
      if (staffRes.error) throw staffRes.error
      if (parentRes.error) throw parentRes.error
      if (staffRes.data) return 'staff'
      if (parentRes.data) return 'parent'
      return null
    },
    enabled: !!uid,
  })
}
