import type { ReactNode } from 'react'
import { useAssociationIdentity } from '../../services/schoolIdentityService'

// Éléments visuels communs aux documents imprimables des clubs (liste d'inscrits, feuille de présence, reçu, états).

export const INK = 'oklch(0.24 0.01 260)'
export const MUTED = 'oklch(0.55 0.01 260)'
export const MUTED2 = 'oklch(0.45 0.01 260)'
export const RULE = 'oklch(0.93 0.005 90)'
export const HEAD_BG = 'oklch(0.96 0.005 264)'
export const ACCENT = 'oklch(0.55 0.15 70)'
export const ACCENT_SOFT = 'oklch(0.92 0.06 80)'
export const RED = 'oklch(0.55 0.2 25)'
export const GREEN = 'oklch(0.45 0.14 160)'
export const AMBER = 'oklch(0.5 0.14 60)'

export const PAGE_STYLE = { background: 'oklch(0.99 0.003 90)', color: INK, fontFamily: 'Helvetica, Arial, sans-serif' } as const

/** Nombre de lignes d'un tableau avant de le continuer (avec son titre répété) sur la page suivante. */
export const LIGNES_PAR_BLOC = 24

export function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function dateLongue(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function morceaux<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

export function Fait({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: ACCENT_SOFT }}>
      <p className="text-[8px] font-bold uppercase tracking-[0.05em]" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold" style={{ color: INK }}>
        {valeur || '—'}
      </p>
    </div>
  )
}

/** Tableau avec barre de titre colorée et compteur, réutilisé sur chaque page de suite. */
export function TableauClub({ titre, compteur, suite, head, couleur = ACCENT, bordure = ACCENT_SOFT, children }: { titre: string; compteur: string; suite: boolean; head: string[]; couleur?: string; bordure?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: couleur }}>
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">
          {titre}
          {suite ? ' (suite)' : ''}
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
          {compteur}
        </span>
      </div>
      <div className="overflow-hidden rounded-b-[10px] border" style={{ borderColor: bordure }}>
        <table className="w-full border-collapse text-[9.5px]">
          <thead>
            <tr className="text-left font-bold uppercase tracking-[0.03em]" style={{ background: HEAD_BG, color: 'oklch(0.5 0.01 260)' }}>
              {head.map((h) => (
                <th key={h} className="px-3 py-1 text-[8px] font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

/** En-tête de page : l'école, le logo, puis le type de document et son objet (nom du club…) à droite. */
export function EnTeteClubs({ document, objet, pageIndex }: { document: string; objet: string; pageIndex: number }) {
  // Les documents des clubs portent le nom et le logo de l'association sportive, pas ceux de l'école.
  const association = useAssociationIdentity()
  return (
    <header className="grid grid-cols-3 items-start border-b-2 pb-3" style={{ borderColor: INK }}>
      <div className="flex flex-col gap-0.5">
        <p className="text-[17px] font-bold uppercase leading-tight tracking-tight" style={{ color: INK }}>
          {association.nom}
        </p>
      </div>
      {association.logo ? <img src={association.logo} alt="Logo" className="justify-self-center object-contain" style={{ height: 70, maxWidth: 110 }} /> : <div />}
      <div className="flex flex-col items-end gap-0.5 text-right">
        <p className="text-[12.5px] font-bold" style={{ color: INK }}>
          {document}
          {pageIndex > 0 ? ' (suite)' : ''}
        </p>
        <p className="text-[20px] font-extrabold leading-none" style={{ color: ACCENT }}>
          {objet}
        </p>
        <p className="text-[10px]" style={{ color: MUTED }}>
          Édité le {new Date().toLocaleDateString('fr-FR')}
        </p>
      </div>
    </header>
  )
}

export function PiedClubs({ libelle, pageIndex, pageCount }: { libelle: string; pageIndex: number; pageCount: number }) {
  const association = useAssociationIdentity()
  return (
    <div className="border-t pt-1.5 text-[8px]" style={{ borderColor: 'oklch(0.92 0.005 90)', color: 'oklch(0.65 0.01 260)' }}>
      <div className="flex justify-between">
        <span>
          {association.nom} — {libelle}
        </span>
        <span>
          Page {pageIndex + 1} / {pageCount}
        </span>
      </div>
    </div>
  )
}
