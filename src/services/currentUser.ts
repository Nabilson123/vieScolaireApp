import { useSyncExternalStore } from 'react'

let currentUserId: string | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

/** Instantané synchrone pour les utilitaires hors-React. */
export function getCurrentUserIdSnapshot(): string | null {
  return currentUserId
}

export function setCurrentUserId(id: string | null): void {
  currentUserId = id
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCurrentUserId(): string | null {
  return useSyncExternalStore(subscribe, getCurrentUserIdSnapshot)
}
