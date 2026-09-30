import { useSyncExternalStore } from 'react'

// En mémoire uniquement, pas de localStorage — aucune autre donnée de session ne persiste sur
// disque dans ce projet, et un compte parent est plus susceptible d'être utilisé sur un appareil
// partagé que les comptes staff.
let selectedChildId: string | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function getSelectedChildIdSnapshot(): string | null {
  return selectedChildId
}

export function setSelectedChildId(id: string | null): void {
  selectedChildId = id
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSelectedChildId(): string | null {
  return useSyncExternalStore(subscribe, getSelectedChildIdSnapshot)
}
