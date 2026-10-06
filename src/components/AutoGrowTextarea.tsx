import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

interface AutoGrowTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  /** Hauteur minimale, en lignes. */
  minRows?: number
  /** Au-delà de cette hauteur (en % de la hauteur de la fenêtre) le champ défile au lieu de grandir. */
  maxHeightVh?: number
}

/**
 * Zone de texte qui s'agrandit avec son contenu : on voit tout ce qu'on a écrit sans défiler dans un petit cadre,
 * jusqu'à une hauteur maximale au-delà de laquelle elle défile. Reste redimensionnable à la main.
 */
export default function AutoGrowTextarea({ minRows = 3, maxHeightVh = 65, className = '', value, style, ...rest }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // + 2 px : la bordure (box-sizing: border-box).
    el.style.height = `${el.scrollHeight + 2}px`
  }

  useLayoutEffect(fit, [value, minRows])
  // La largeur change (fenêtre, panneau) : les retours à la ligne aussi.
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return <textarea ref={ref} rows={minRows} value={value} className={`w-full resize-y overflow-y-auto ${className}`} style={{ maxHeight: `${maxHeightVh}vh`, ...style }} {...rest} />
}
