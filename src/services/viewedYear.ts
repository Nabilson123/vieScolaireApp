import { useSyncExternalStore } from 'react'
import { getActiveYearIdSnapshot } from './anneesScolairesService'

const STORAGE_KEY = 'vieScolaire.viewedYearId'

let viewedYearId: string | null = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

/** Instantané synchrone pour les fetchX() des services année-scopés (hors React). */
export function getViewedYearIdSnapshot(): string {
  return viewedYearId ?? getActiveYearIdSnapshot()
}

export function setViewedYearId(id: string): void {
  viewedYearId = id
  window.localStorage.setItem(STORAGE_KEY, id)
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useViewedYearId(): string {
  return useSyncExternalStore(subscribe, getViewedYearIdSnapshot)
}

export function useIsViewedYearEditable(): boolean {
  const viewed = useViewedYearId()
  return viewed === getActiveYearIdSnapshot()
}
