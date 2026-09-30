export interface Cycle {
  key: string
  label: string
  niveaux: string[]
  /** Barème des notes chiffrées pour ce cycle (/10, /20...). `null` = pas de notation chiffrée (maternelle). */
  moyenneScale: number | null
}

export const CYCLES: Cycle[] = [
  { key: 'maternelle', label: 'Maternelle', niveaux: ['PS', 'MS', 'GS'], moyenneScale: null },
  { key: 'primaire', label: 'Primaire', niveaux: ['CE1', 'CE2', 'CE3', 'CE4', 'CE5', 'CE6'], moyenneScale: 10 },
  { key: 'college', label: 'Collège', niveaux: ['1APIC', '2APIC', '3APIC'], moyenneScale: 20 },
  { key: 'lycee', label: 'Lycée', niveaux: [], moyenneScale: 20 },
]

export const NIVEAUX: string[] = CYCLES.flatMap((c) => c.niveaux)

export function cycleOfNiveau(niveau: string): Cycle | undefined {
  return CYCLES.find((c) => c.niveaux.includes(niveau))
}

export function moyenneScale(cycleKey: string): number | null {
  return CYCLES.find((c) => c.key === cycleKey)?.moyenneScale ?? null
}

export interface MatiereNiveauConfig {
  active: boolean
  coefficient: number
  exporterMassar: boolean
  afficherBulletin: boolean
  exporterParChapitres: boolean
  horsMaxExamens: boolean
}

export interface MatiereConfig {
  id: string
  nom: string
  nomAr: string
  code: string
  rtl: boolean
  parNiveau: Record<string, MatiereNiveauConfig>
}

export function niveauxOf(m: MatiereConfig): string[] {
  return NIVEAUX.filter((n) => m.parNiveau[n]?.active)
}

export function getMatieresForNiveau(matieres: MatiereConfig[], niveau: string): MatiereConfig[] {
  return matieres.filter((m) => m.parNiveau[niveau]?.active)
}

export function colorForMatiere(nom: string): string {
  const palette = [
    'bg-amber-500',
    'bg-violet-500',
    'bg-rose-500',
    'bg-emerald-500',
    'bg-sky-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-slate-700',
  ]
  let hash = 0
  for (let i = 0; i < nom.length; i++) hash = (hash * 31 + nom.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}
