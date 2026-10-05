import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { defaultExtra, type ReclamationRecord, type StudentExtra } from '../data/studentDetails'
import {
  createReclamations,
  prendreEnChargeReclamation,
  resoudreReclamation,
  rouvrirReclamation,
  supprimerReclamation,
  updateReclamation,
  type CreateReclamationsInput,
  type ReclamationPatch,
} from '../services/studentDetailsService'

/**
 * Actions sur les réclamations, communes à la page Réclamations et à la fiche élève (jusqu'ici la même
 * logique était écrite deux fois). Chaque action : écrit via le service (réclamation retrouvée par son
 * id), met le cache à jour tout de suite — l'écran réagit sans attendre le réseau —, puis recharge.
 * Une erreur n'est plus avalée : elle est exposée dans `error` pour être affichée.
 */
export function useReclamationActions() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const run = async (studentId: string, action: () => Promise<ReclamationRecord[]>): Promise<boolean> => {
    setError(null)
    try {
      const updated = await action()
      queryClient.setQueryData<Record<string, StudentExtra>>(['studentExtras'], (old) =>
        old ? { ...old, [studentId]: { ...(old[studentId] ?? defaultExtra), reclamations: updated } } : old
      )
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué — réessayez.")
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      return false
    }
  }

  return {
    error,
    clearError: () => setError(null),
    creer: (input: CreateReclamationsInput) => run(input.studentId, () => createReclamations(input)),
    prendreEnCharge: (studentId: string, id: string) => run(studentId, () => prendreEnChargeReclamation(studentId, id)),
    resoudre: (studentId: string, id: string, resolution: string) => run(studentId, () => resoudreReclamation(studentId, id, resolution)),
    rouvrir: (studentId: string, id: string) => run(studentId, () => rouvrirReclamation(studentId, id)),
    supprimer: (studentId: string, id: string) => run(studentId, () => supprimerReclamation(studentId, id)),
    modifier: (studentId: string, id: string, patch: ReclamationPatch, detail?: string) =>
      run(studentId, () => updateReclamation(studentId, id, patch, { action: 'modifiee', detail })),
  }
}
