import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { defaultExtra, type ReclamationRecord, type StudentExtra } from '../data/studentDetails'
import {
  assignerReclamation,
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
 * Une erreur n'est plus avalée : elle est exposée dans `error` pour être affichée. Les actions qui
 * produisent un enregistrement renvoient sa version à jour (ou `null` en cas d'échec).
 */
export function useReclamationActions() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const run = async (studentId: string, action: () => Promise<ReclamationRecord[]>): Promise<ReclamationRecord[] | null> => {
    setError(null)
    try {
      const updated = await action()
      queryClient.setQueryData<Record<string, StudentExtra>>(['studentExtras'], (old) =>
        old ? { ...old, [studentId]: { ...(old[studentId] ?? defaultExtra), reclamations: updated } } : old
      )
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      return updated
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué — réessayez.")
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      return null
    }
  }

  const one = async (studentId: string, id: string, action: () => Promise<ReclamationRecord[]>): Promise<ReclamationRecord | null> => {
    const list = await run(studentId, action)
    return list?.find((r) => r.id === id) ?? null
  }

  return {
    error,
    clearError: () => setError(null),
    /** Renvoie toute la liste de l'élève : les nouvelles réclamations sont en tête. */
    creer: (input: CreateReclamationsInput) => run(input.studentId, () => createReclamations(input)),
    prendreEnCharge: (studentId: string, id: string) => one(studentId, id, () => prendreEnChargeReclamation(studentId, id)),
    resoudre: (studentId: string, id: string, resolution: string) => one(studentId, id, () => resoudreReclamation(studentId, id, resolution)),
    rouvrir: (studentId: string, id: string) => one(studentId, id, () => rouvrirReclamation(studentId, id)),
    supprimer: (studentId: string, id: string) => run(studentId, () => supprimerReclamation(studentId, id)),
    modifier: (studentId: string, id: string, patch: ReclamationPatch, detail?: string) =>
      one(studentId, id, () => updateReclamation(studentId, id, patch, { action: 'modifiee', detail })),
    assigner: (studentId: string, id: string, responsable: string, echeance: string | undefined) =>
      one(studentId, id, () => assignerReclamation(studentId, id, responsable, echeance)),
    /** Trace dans la frise qu'une action a été créée dans un autre module (« Transformer en… »). */
    journaliserAction: (studentId: string, id: string, detail: string) =>
      one(studentId, id, () => updateReclamation(studentId, id, {}, { action: 'action_creee', detail })),
    /** Trace dans la frise qu'un message a été copié ou ouvert dans WhatsApp. */
    journaliserMessage: (studentId: string, id: string, detail: string) =>
      one(studentId, id, () => updateReclamation(studentId, id, {}, { action: 'message_parent', detail })),
  }
}
