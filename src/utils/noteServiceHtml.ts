/** Corps des Notes de Service : éditeur riche volontairement bridé à un jeu fixe de commandes
 * execCommand + manipulations DOM ciblées (pas de HTML issu d'un copier-coller externe, forcé en
 * texte brut côté éditeur) — cette fonction reste un filet de sécurité en profondeur, appliqué à la
 * sauvegarde et avant tout rendu. `style`/attributs ne sont jamais recopiés tels quels : seules des
 * valeurs prises dans des listes fermées (alignement, polices, tailles, couleurs de la palette de
 * l'établissement, interligne, marqueurs booléens fixes) sont reconstruites à la main. Polices/
 * tailles/couleurs sont désormais réellement au choix (demande explicite de l'utilisateur, "toutes
 * les options comme dans Word") mais restées bornées à des listes vérifiées plutôt qu'arbitraires,
 * pour ne pas casser entièrement la cohérence visuelle des notes officielles. */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'MARK', 'SUP', 'SUB', 'SPAN',
  'UL', 'OL', 'LI', 'A', 'DIV', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'HR',
  'TABLE', 'TBODY', 'TR', 'TD',
])
const ALLOWED_TEXT_ALIGN = new Set(['left', 'center', 'right', 'justify'])
const ALLOWED_HREF = /^(https?:|mailto:|tel:)/i

export const FONT_FAMILIES = ['Source Sans 3', 'Archivo', 'Arial', 'Georgia', 'Times New Roman', 'Courier New']
export const FONT_SIZES_PT = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36]
export const LINE_HEIGHTS = [1, 1.15, 1.5, 1.8, 2]

// Palette bornée à l'identité visuelle déjà utilisée dans les documents de l'établissement (couleurs
// de marque + variantes pâles pour les fonds) — jamais une couleur totalement libre. Les valeurs sont
// stockées en rgb() (pas en hex) car c'est la forme que `el.style.color` renvoie déjà normalisée une
// fois relue depuis le DOM : appliquer et vérifier la même chaîne évite tout problème de conversion.
export const TEXT_COLORS = [
  { label: 'Noir', value: 'rgb(20, 20, 20)' },
  { label: 'Bleu Mondrian', value: 'rgb(17, 96, 174)' },
  { label: 'Rouge Mondrian', value: 'rgb(225, 37, 43)' },
  { label: 'Gris', value: 'rgb(90, 90, 90)' },
]
export const HIGHLIGHT_COLORS = [
  { label: 'Jaune', value: 'rgb(253, 230, 138)' },
  { label: 'Bleu clair', value: 'rgb(191, 219, 254)' },
  { label: 'Vert clair', value: 'rgb(187, 247, 208)' },
  { label: 'Rose clair', value: 'rgb(251, 207, 232)' },
]
export const SHADING_COLORS = [
  { label: 'Gris clair', value: 'rgb(241, 245, 249)' },
  { label: 'Jaune pâle', value: 'rgb(255, 251, 235)' },
  { label: 'Bleu pâle', value: 'rgb(239, 246, 255)' },
]

const ALLOWED_FONT_FAMILIES = new Set(FONT_FAMILIES)
const ALLOWED_FONT_SIZES = new Set(FONT_SIZES_PT.map((n) => `${n}pt`))
const ALLOWED_LINE_HEIGHTS = new Set(LINE_HEIGHTS.map(String))
const ALLOWED_TEXT_COLORS = new Set(TEXT_COLORS.map((c) => c.value))
const ALLOWED_HIGHLIGHTS = new Set(HIGHLIGHT_COLORS.map((c) => c.value))
const ALLOWED_SHADINGS = new Set(SHADING_COLORS.map((c) => c.value))

export function sanitizeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const walk = (node: ParentNode) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return
      if (child.nodeType !== Node.ELEMENT_NODE) {
        node.removeChild(child)
        return
      }
      const el = child as HTMLElement
      if (!ALLOWED_TAGS.has(el.tagName)) {
        const parent = el.parentNode
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
        return
      }
      const href = el.tagName === 'A' ? el.getAttribute('href') : null
      const textAlign = el.style.textAlign
      const fontFamily = el.style.fontFamily.replace(/^["']|["']$/g, '')
      const fontSize = el.style.fontSize
      const color = el.style.color
      const backgroundColor = el.style.backgroundColor
      const lineHeight = el.style.lineHeight
      const isCallout = el.tagName === 'DIV' && el.getAttribute('data-callout') === '1'
      const isRtl = el.tagName === 'DIV' && el.getAttribute('dir') === 'rtl'
      const isBordered = el.tagName === 'DIV' && el.getAttribute('data-bordered') === '1'
      Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name))
      if (el.tagName === 'A' && href && ALLOWED_HREF.test(href)) {
        el.setAttribute('href', href)
        if (/^https?:/i.test(href)) {
          el.setAttribute('target', '_blank')
          el.setAttribute('rel', 'noopener noreferrer')
        }
      }
      const styleParts: string[] = []
      if (textAlign && ALLOWED_TEXT_ALIGN.has(textAlign)) styleParts.push(`text-align: ${textAlign}`)
      if (fontFamily && ALLOWED_FONT_FAMILIES.has(fontFamily)) styleParts.push(`font-family: '${fontFamily}'`)
      if (fontSize && ALLOWED_FONT_SIZES.has(fontSize)) styleParts.push(`font-size: ${fontSize}`)
      if (color && (el.tagName === 'SPAN' || el.tagName === 'DIV') && ALLOWED_TEXT_COLORS.has(color)) styleParts.push(`color: ${color}`)
      if (backgroundColor && el.tagName === 'SPAN' && ALLOWED_HIGHLIGHTS.has(backgroundColor)) styleParts.push(`background-color: ${backgroundColor}`)
      if (backgroundColor && el.tagName === 'DIV' && ALLOWED_SHADINGS.has(backgroundColor)) styleParts.push(`background-color: ${backgroundColor}`)
      if (lineHeight && ALLOWED_LINE_HEIGHTS.has(lineHeight)) styleParts.push(`line-height: ${lineHeight}`)
      if (styleParts.length) el.setAttribute('style', styleParts.join('; '))
      if (isCallout) el.setAttribute('data-callout', '1')
      if (isRtl) el.setAttribute('dir', 'rtl')
      if (isBordered) el.setAttribute('data-bordered', '1')
      walk(el)
    })
  }

  walk(doc.body)
  return doc.body.innerHTML
}

/** Estimation du nombre de paragraphes pour l'avertissement "une page maximum" — compte les blocs
 * de haut niveau (p/div, selon le navigateur qui a produit le HTML) plutôt que des lignes brutes. */
export function countNoteParagraphs(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = doc.body.querySelectorAll('p, div, h2, h3, h4, blockquote')
  if (blocks.length > 0) return blocks.length
  return doc.body.textContent?.trim() ? 1 : 0
}
