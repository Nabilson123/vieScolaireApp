const PALETTE = [
  'from-indigo-400 to-violet-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-500',
  'from-rose-400 to-pink-500',
  'from-fuchsia-400 to-purple-500',
]

/** Couleur stable par personne (hash simple sur l'id), pas de dépendance ajoutée. */
export function avatarGradient(seed: string): string {
  let hash = 0
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) % PALETTE.length
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
