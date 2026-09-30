import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Search,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
  CaseUpper,
  CaseLower,
  CaseSensitive,
  List,
  ListOrdered,
  ListTodo,
  IndentIncrease,
  IndentDecrease,
  ArrowDownAZ,
  Quote,
  Megaphone,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Mail,
  Phone,
  Unlink,
  Minus,
  CornerDownLeft,
  Space,
  CalendarDays,
  Clock,
  Building2,
  UserRound,
  Users,
  MessageCircle,
  Signature,
  CopyPlus,
  Trash,
  ArrowUp,
  ArrowDown,
  TextSelect,
  Trash2,
  Sparkles,
  RemoveFormatting,
  ClipboardCopy,
  Undo2,
  Redo2,
  Eraser,
  Copy,
  Scissors,
  ClipboardPaste,
  Paintbrush,
  Square,
  Eye,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react'
import { sanitizeNoteHtml, FONT_FAMILIES, FONT_SIZES_PT, LINE_HEIGHTS, TEXT_COLORS, HIGHLIGHT_COLORS, SHADING_COLORS } from '../../utils/noteServiceHtml'
import { useSchoolIdentity } from '../../services/schoolIdentityService'
import { useCurrentProfile } from '../../services/permissions'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  /** Libellé court de la cible déjà choisie plus haut dans le formulaire (ex. "CE2-A", "Tout
   * l'établissement") — permet le bouton "Insérer les destinataires" sans retaper l'audience. */
  cibleLabel?: string
}

interface ToolbarButtonSpec {
  onClick: () => void
  disabled?: boolean
  icon?: LucideIcon
  glyph?: string
  label: string
  /** Retour visuel "actif" pour un outil à état (Reproduire la mise en forme armé, Afficher les
   * marques activé) — distinct de :hover, reste affiché tant que l'état est vrai. */
  active?: boolean
}

function ToolbarButton({ onClick, disabled, icon: Icon, glyph, label, active }: ToolbarButtonSpec) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'
      }`}
    >
      {Icon ? <Icon className="h-3 w-3" /> : <span className="text-[9px] font-semibold leading-none">{glyph}</span>}
    </button>
  )
}

function ToolbarSelect({ options, onPick, disabled, title, width = 68 }: { options: { label: string; value: string }[]; onPick: (v: string) => void; disabled?: boolean; title: string; width?: number }) {
  return (
    <select
      defaultValue=""
      disabled={disabled}
      title={title}
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value)
        e.target.value = ''
      }}
      style={{ width }}
      className="h-5 shrink-0 rounded border border-slate-200 bg-white px-1 text-[9px] leading-none text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <option value="" disabled>
        {title}
      </option>
      {options.map((o) => (
        <option key={o.value || o.label} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// Groupe façon ruban (Word) : icônes toujours visibles, regroupées dans un cadre avec une étiquette
// en dessous — demandé explicitement par l'utilisateur à la place de catégories à déplier, pour que
// tous les outils restent accessibles en un seul clic malgré leur nombre. Pas de largeur maximale
// imposée par groupe (chaque groupe tient sur une seule ligne) : avec le corps en pleine largeur, ça
// évite un double repli (dans le groupe ET dans la rangée) qui gonflait inutilement la hauteur.
function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5 border-r border-slate-200 px-1.5 pb-0.5 pt-1 last:border-r-0">
      <div className="flex flex-nowrap items-center justify-center gap-0.5">{children}</div>
      <span className="whitespace-nowrap text-[8px] font-medium leading-none text-slate-500">{label}</span>
    </div>
  )
}

const BLOCK_TAGS = ['P', 'DIV', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL']
const FORMULE_APPEL = 'Mesdames, Messieurs,'
const FORMULE_POLITESSE = "Nous vous prions d'agréer, Mesdames, Messieurs, l'expression de nos salutations distinguées."

/** Éditeur riche : jeu de commandes volontairement fermé à ce que execCommand (+ quelques
 * manipulations DOM ciblées) sait faire sans nouvelle dépendance — jamais de choix de police/
 * taille/couleur libre (cf. charte graphique, "la charte impose tout"). Élargi par vagues
 * successives à la demande explicite de l'utilisateur : la barre est organisée en catégories
 * repliables (plutôt qu'une seule longue rangée d'icônes) pour rester lisible malgré le nombre
 * d'outils. Le collage est forcé en texte brut — la seule source de HTML est nos propres
 * commandes, jamais un copier-coller externe — sanitizeNoteHtml() reste un filet de sécurité en
 * plus, pas le seul rempart. */
export default function RichTextEditor({ value, onChange, disabled, placeholder, cibleLabel }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const savedRange = useRef<Range | null>(null)
  const { data: schoolIdentity } = useSchoolIdentity()
  const profile = useCurrentProfile()

  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showMarks, setShowMarks] = useState(false)
  const [paintedFormat, setPaintedFormat] = useState<{ bold: boolean; italic: boolean; underline: boolean; strikeThrough: boolean } | null>(null)

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value
      initialized.current = true
    }
  }, [value])

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const handleInput = () => {
    onChange(sanitizeNoteHtml(ref.current?.innerHTML ?? ''))
  }

  // La sélection du navigateur ne survit pas de façon fiable au clic sur un bouton de la barre
  // d'outils (perdue avant que le gestionnaire onClick ne s'exécute) — on la sauvegarde donc nous-
  // mêmes à chaque changement et on la restaure explicitement avant toute commande, plutôt que de
  // compter sur le comportement implicite du navigateur.
  const withSelection = (run: () => void) => {
    if (disabled) return
    ref.current?.focus()
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    run()
    saveSelection()
    handleInput()
  }

  const exec = (command: string, commandValue?: string) =>
    withSelection(() => {
      document.execCommand('defaultParagraphSeparator', false, 'p')
      document.execCommand(command, false, commandValue)
    })

  const insertText = (text: string) => withSelection(() => document.execCommand('insertText', false, text))

  // formatBlock ne bascule pas tout seul — on rebascule nous-mêmes vers un paragraphe normal si le
  // bloc courant porte déjà ce tag, pour que le bouton se comporte comme un vrai interrupteur.
  const toggleBlock = (tag: string) =>
    withSelection(() => {
      const current = document.queryCommandValue('formatBlock').toLowerCase()
      document.execCommand('formatBlock', false, current === tag ? 'p' : tag)
    })

  const transformCase = (fn: (s: string) => string) =>
    withSelection(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      document.execCommand('insertText', false, fn(sel.toString()))
    })

  // Enrobe la sélection dans un <span style="..."> pour porter police/taille/couleur/surlignage —
  // remonte d'abord vérifier si elle est déjà dans un span portant CETTE MÊME propriété (pour la
  // mettre à jour ou, si value est vide, retirer l'enrobage) plutôt que d'en imbriquer un second.
  // surroundContents échoue si la sélection chevauche partiellement une frontière d'élément, d'où le
  // repli sur extractContents/insertNode.
  const applyInlineStyleCore = (styleProp: 'fontFamily' | 'fontSize' | 'color' | 'backgroundColor', value: string) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    let node: Node | null = range.commonAncestorContainer
    let existing: HTMLElement | null = null
    while (node && node !== ref.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'SPAN' && (node as HTMLElement).style[styleProp]) {
        existing = node as HTMLElement
        break
      }
      node = node.parentNode
    }
    if (existing && ref.current?.contains(existing)) {
      if (!value) {
        const parent = existing.parentNode
        if (parent) {
          while (existing.firstChild) parent.insertBefore(existing.firstChild, existing)
          parent.removeChild(existing)
        }
        // Une manipulation manuelle du DOM (pas execCommand) ne tient pas la Selection du navigateur
        // à jour toute seule — sans ce reset, saveSelection() capterait une plage désormais invalide.
        sel.removeAllRanges()
        return
      }
      existing.style[styleProp] = value
      return
    }
    if (!value) return
    const wrapper = document.createElement('span')
    wrapper.style[styleProp] = value
    try {
      range.surroundContents(wrapper)
    } catch {
      const content = range.extractContents()
      wrapper.appendChild(content)
      range.insertNode(wrapper)
    }
    // Repointe la sélection sur le contenu désormais enveloppé, pour que saveSelection() (appelé
    // juste après par withSelection) capture une plage valide à l'intérieur du span — sans ça, un
    // second réglage immédiat ne retrouverait pas le span et en imbriquerait un second.
    const newRange = document.createRange()
    newRange.selectNodeContents(wrapper)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }

  const applyInlineStyle = (styleProp: 'fontFamily' | 'fontSize' | 'color' | 'backgroundColor', value: string) =>
    withSelection(() => applyInlineStyleCore(styleProp, value))

  const growShrinkFont = (direction: 1 | -1) =>
    withSelection(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
      let node: Node | null = sel.getRangeAt(0).commonAncestorContainer
      let currentSize = 10.5
      while (node && node !== ref.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).style.fontSize) {
          currentSize = parseFloat((node as HTMLElement).style.fontSize)
          break
        }
        node = node.parentNode
      }
      const idx = FONT_SIZES_PT.findIndex((s) => s >= currentSize)
      const from = idx === -1 ? FONT_SIZES_PT.length - 1 : idx
      const nextIdx = Math.min(FONT_SIZES_PT.length - 1, Math.max(0, from + direction))
      applyInlineStyleCore('fontSize', `${FONT_SIZES_PT[nextIdx]}pt`)
    })

  const applyParagraphStyle = (styleProp: 'backgroundColor' | 'lineHeight', value: string) =>
    withSelection(() => {
      document.execCommand('formatBlock', false, 'div')
      const sel = window.getSelection()
      const node = sel?.anchorNode
      const el = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement) as HTMLElement | null
      const block = el?.closest('div')
      if (block && ref.current?.contains(block)) {
        if (value) block.style[styleProp] = value
        else block.style.removeProperty(styleProp === 'backgroundColor' ? 'background-color' : 'line-height')
      }
    })

  // Bascule un attribut booléen fixe (data-callout, dir=rtl ou data-bordered) sur le bloc courant,
  // converti en DIV au passage — formatBlock (natif) tient déjà la Selection à jour tout seul, pas
  // besoin de la repositionner nous-mêmes après coup comme pour les manipulations DOM manuelles.
  const toggleBlockAttr = (attr: string, value: string) =>
    withSelection(() => {
      document.execCommand('formatBlock', false, 'div')
      const sel = window.getSelection()
      const node = sel?.anchorNode
      const el = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement) as HTMLElement | null
      const block = el?.closest('div')
      if (block && ref.current?.contains(block)) {
        if (block.getAttribute(attr) === value) block.removeAttribute(attr)
        else block.setAttribute(attr, value)
      }
    })

  const getCurrentBlock = (): HTMLElement | null => {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    let el = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement) as HTMLElement | null
    while (el && el !== ref.current && !BLOCK_TAGS.includes(el.tagName)) {
      el = el.parentElement
    }
    return el && el !== ref.current && ref.current?.contains(el) ? el : null
  }

  // Du texte tapé au clavier sans jamais passer par un bouton de mise en forme peut rester un
  // simple flux de texte/<br> sans aucun bloc englobant (surtout avant le tout premier appel à
  // execCommand, qui est ce qui fixe defaultParagraphSeparator sur 'p') — les outils "Organiser le
  // texte" ont besoin d'un vrai bloc à manipuler, donc on en force un au besoin avant de le chercher.
  const ensureCurrentBlock = (): HTMLElement | null => {
    const existing = getCurrentBlock()
    if (existing) return existing
    document.execCommand('formatBlock', false, 'p')
    return getCurrentBlock()
  }

  const selectBlockStart = (block: HTMLElement) => {
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(block)
    range.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  const duplicateCurrentBlock = () =>
    withSelection(() => {
      const block = ensureCurrentBlock()
      if (!block?.parentNode) return
      const clone = block.cloneNode(true) as HTMLElement
      block.parentNode.insertBefore(clone, block.nextSibling)
      selectBlockStart(clone)
    })

  const deleteCurrentBlock = () =>
    withSelection(() => {
      const block = ensureCurrentBlock()
      if (!block) return
      const target = (block.nextElementSibling ?? block.previousElementSibling) as HTMLElement | null
      block.remove()
      if (target) selectBlockStart(target)
      else window.getSelection()?.removeAllRanges()
    })

  const moveBlockUp = () =>
    withSelection(() => {
      const block = ensureCurrentBlock()
      const prev = block?.previousElementSibling
      if (!block || !prev || !block.parentNode) return
      block.parentNode.insertBefore(block, prev)
      selectBlockStart(block)
    })

  const moveBlockDown = () =>
    withSelection(() => {
      const block = ensureCurrentBlock()
      const next = block?.nextElementSibling
      if (!block || !next || !block.parentNode) return
      block.parentNode.insertBefore(next, block)
      selectBlockStart(block)
    })

  const sortCurrentList = () =>
    withSelection(() => {
      const sel = window.getSelection()
      const node = sel?.anchorNode
      const el = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement) as HTMLElement | null
      const list = el?.closest('ul, ol')
      if (!list || !ref.current?.contains(list)) return
      const items = Array.from(list.children) as HTMLElement[]
      items.sort((a, b) => (a.textContent ?? '').localeCompare(b.textContent ?? '', 'fr'))
      items.forEach((li) => list.appendChild(li))
    })

  const insertTable = () =>
    withSelection(() => {
      const row = '<tr><td> </td><td> </td><td> </td></tr>'
      document.execCommand('insertHTML', false, `<table><tbody>${row}${row}${row}</tbody></table>`)
    })

  const cleanWhitespace = () =>
    withSelection(() => {
      if (!ref.current) return
      const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent) node.textContent = node.textContent.replace(/[ \t]{2,}/g, ' ')
      }
    })

  const copyPlainText = () => {
    if (!ref.current) return
    navigator.clipboard?.writeText(ref.current.innerText)
  }

  const stripAllFormatting = () => {
    if (disabled || !ref.current) return
    if (!window.confirm('Retirer toute la mise en forme de la note (titres, gras, listes...) ?')) return
    const lines = ref.current.innerText.split('\n').filter((l) => l.trim())
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    ref.current.innerHTML = lines.length ? lines.map((l) => `<p>${escape(l)}</p>`).join('') : ''
    handleInput()
  }

  const handleReplaceAll = () => {
    if (!findText || !ref.current) return
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'gi')
    const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node.textContent) {
        re.lastIndex = 0
        if (re.test(node.textContent)) {
          re.lastIndex = 0
          node.textContent = node.textContent.replace(re, replaceText)
        }
      }
    }
    handleInput()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
    handleInput()
  }

  const handleLink = () => {
    const url = window.prompt("Adresse du lien (https://...) :")
    if (url && /^https?:\/\//i.test(url.trim())) exec('createLink', url.trim())
  }

  const handleEmailLink = () => {
    const email = window.prompt('Adresse e-mail :')
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) exec('createLink', `mailto:${email.trim()}`)
  }

  const handlePhoneLink = () => {
    const phone = window.prompt('Numéro de téléphone :')
    if (phone && phone.trim()) exec('createLink', `tel:${phone.trim().replace(/[\s.-]/g, '')}`)
  }

  const handleGuillemets = () =>
    withSelection(() => {
      document.execCommand('insertText', false, '« »')
      const sel = window.getSelection()
      sel?.modify('move', 'backward', 'character')
    })

  const handleSelectAll = () => {
    if (disabled || !ref.current) return
    ref.current.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(ref.current)
    sel?.removeAllRanges()
    sel?.addRange(range)
    saveSelection()
  }

  const handleClearAll = () => {
    if (disabled || !ref.current) return
    if (!window.confirm('Effacer tout le contenu de la note ?')) return
    ref.current.innerHTML = ''
    handleInput()
  }

  const handleCopy = () => withSelection(() => document.execCommand('copy'))
  const handleCut = () => withSelection(() => document.execCommand('cut'))
  // Coller en texte brut, cohérent avec le collage Ctrl+V déjà forcé en texte brut ailleurs dans cet
  // éditeur — l'API Clipboard async (pas l'ancien execCommand('paste'), bloqué par défaut par les
  // navigateurs pour la lecture) fonctionne ici car déclenchée par un vrai clic utilisateur. Pas de
  // withSelection ici : sa restauration de sélection est synchrone, alors que la lecture du presse-
  // papiers ne l'est pas — la restauration et l'insertion doivent donc rester dans la même suite
  // d'opérations asynchrones plutôt que d'être séparées par le retour immédiat de withSelection.
  const handlePasteButton = () => {
    if (disabled) return
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    navigator.clipboard
      ?.readText()
      .then((text) => {
        if (!text) return
        ref.current?.focus()
        document.execCommand('insertText', false, text)
        saveSelection()
        handleInput()
      })
      .catch(() => {
        window.alert("Impossible d'accéder au presse-papiers — vérifiez l'autorisation du navigateur, ou collez avec Ctrl+V directement dans le texte.")
      })
  }

  // Reproduire la mise en forme : un premier clic capture l'état gras/italique/souligné/barré de la
  // sélection courante ; le bouton reste "armé" (fond teinté) jusqu'à ce qu'une nouvelle sélection
  // soit faite, à laquelle cet état est appliqué en un coup — même principe en deux temps que l'outil
  // Word, simplifié à ces 4 attributs plutôt qu'à la totalité police/taille/couleur.
  const handleFormatPainter = () => {
    if (disabled) return
    if (paintedFormat) {
      const sel = window.getSelection()
      if (sel && savedRange.current) {
        sel.removeAllRanges()
        sel.addRange(savedRange.current)
      }
      if (sel && !sel.isCollapsed) {
        ;(['bold', 'italic', 'underline', 'strikeThrough'] as const).forEach((cmd) => {
          const key = cmd === 'strikeThrough' ? 'strikeThrough' : (cmd as 'bold' | 'italic' | 'underline')
          if (document.queryCommandState(cmd) !== paintedFormat[key]) document.execCommand(cmd)
        })
        saveSelection()
        handleInput()
      }
      setPaintedFormat(null)
      return
    }
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    setPaintedFormat({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
    })
  }

  const handleInsertCoordonnees = () =>
    withSelection(() => {
      if (!schoolIdentity) return
      const parts = [schoolIdentity.nom, schoolIdentity.adresse, schoolIdentity.tel1 && `Tél : ${schoolIdentity.tel1}`, schoolIdentity.email].filter(Boolean)
      document.execCommand('insertText', false, parts.join(' — '))
    })

  const handleInsertMyName = () =>
    withSelection(() => {
      if (profile?.nomComplet) document.execCommand('insertText', false, profile.nomComplet)
    })

  const isEmpty = !value.replace(/<[^>]*>/g, '').trim()
  const plainText = value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0
  const charCount = plainText.replace(/\s/g, '').length

  const categories: { key: string; label: string; buttons: ToolbarButtonSpec[] }[] = [
    {
      key: 'presse-papiers',
      label: 'Presse-papiers',
      buttons: [
        { disabled, onClick: handlePasteButton, icon: ClipboardPaste, label: 'Coller' },
        { disabled, onClick: handleCut, icon: Scissors, label: 'Couper' },
        { disabled, onClick: handleCopy, icon: Copy, label: 'Copier' },
        { disabled, onClick: handleFormatPainter, icon: Paintbrush, label: 'Reproduire la mise en forme', active: !!paintedFormat },
      ],
    },
    {
      key: 'titres',
      label: 'Titres & paragraphe',
      buttons: [
        { disabled, onClick: () => toggleBlock('h2'), icon: Heading2, label: 'Titre principal' },
        { disabled, onClick: () => toggleBlock('h3'), icon: Heading3, label: 'Titre' },
        { disabled, onClick: () => toggleBlock('h4'), icon: Heading4, label: 'Sous-titre' },
        { disabled, onClick: () => withSelection(() => document.execCommand('formatBlock', false, 'p')), icon: Pilcrow, label: 'Paragraphe normal' },
      ],
    },
    {
      key: 'casse',
      label: 'Casse',
      buttons: [
        { disabled, onClick: () => transformCase((s) => s.toUpperCase()), icon: CaseUpper, label: 'MAJUSCULES' },
        { disabled, onClick: () => transformCase((s) => s.toLowerCase()), icon: CaseLower, label: 'minuscules' },
        {
          disabled,
          onClick: () => transformCase((s) => s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())),
          icon: CaseSensitive,
          label: 'Première Lettre En Majuscule',
        },
        {
          disabled,
          onClick: () => transformCase((s) => s.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (c) => c.toUpperCase())),
          glyph: 'Aa.',
          label: 'Phrase commençante (casse de phrase)',
        },
      ],
    },
    {
      key: 'listes',
      label: 'Listes & retrait',
      buttons: [
        { disabled, onClick: () => exec('insertUnorderedList'), icon: List, label: 'Liste à puces' },
        { disabled, onClick: () => exec('insertOrderedList'), icon: ListOrdered, label: 'Liste numérotée' },
        { disabled, onClick: () => insertText('☐ '), icon: ListTodo, label: 'Case à cocher' },
        { disabled, onClick: () => exec('outdent'), icon: IndentDecrease, label: 'Diminuer le retrait' },
        { disabled, onClick: () => exec('indent'), icon: IndentIncrease, label: 'Augmenter le retrait' },
        { disabled, onClick: sortCurrentList, icon: ArrowDownAZ, label: 'Trier la liste (A→Z)' },
      ],
    },
    {
      key: 'blocs',
      label: 'Blocs spéciaux',
      buttons: [
        { disabled, onClick: () => toggleBlock('blockquote'), icon: Quote, label: 'Citation' },
        { disabled, onClick: () => toggleBlockAttr('data-callout', '1'), icon: Megaphone, label: 'Encadré (mise en évidence)' },
        { disabled, onClick: insertTable, icon: Table, label: 'Insérer un tableau' },
        { disabled, onClick: () => toggleBlockAttr('dir', 'rtl'), glyph: 'RTL', label: 'Sens du texte à droite (arabe)' },
      ],
    },
    {
      key: 'alignement',
      label: 'Alignement',
      buttons: [
        { disabled, onClick: () => exec('justifyLeft'), icon: AlignLeft, label: 'Aligner à gauche' },
        { disabled, onClick: () => exec('justifyCenter'), icon: AlignCenter, label: 'Centrer' },
        { disabled, onClick: () => exec('justifyRight'), icon: AlignRight, label: 'Aligner à droite' },
        { disabled, onClick: () => exec('justifyFull'), icon: AlignJustify, label: 'Justifier' },
      ],
    },
    {
      key: 'liens',
      label: 'Liens & insertions',
      buttons: [
        { disabled, onClick: handleLink, icon: LinkIcon, label: 'Lien web' },
        { disabled, onClick: handleEmailLink, icon: Mail, label: 'Lien e-mail' },
        { disabled, onClick: handlePhoneLink, icon: Phone, label: 'Lien téléphone' },
        { disabled, onClick: () => exec('unlink'), icon: Unlink, label: 'Retirer le lien' },
        { disabled, onClick: () => exec('insertHorizontalRule'), icon: Minus, label: 'Ligne de séparation' },
        { disabled, onClick: () => insertText('—'), glyph: '—', label: 'Tiret cadratin' },
        { disabled, onClick: handleGuillemets, glyph: '« »', label: 'Guillemets français' },
        { disabled, onClick: () => exec('insertLineBreak'), icon: CornerDownLeft, label: 'Saut de ligne' },
        { disabled, onClick: () => insertText(' '), icon: Space, label: 'Espace insécable' },
      ],
    },
    {
      key: 'insertions-rapides',
      label: 'Insertions rapides',
      buttons: [
        {
          disabled,
          onClick: () => insertText(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })),
          icon: CalendarDays,
          label: 'Insérer la date du jour',
        },
        {
          disabled,
          onClick: () => insertText(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })),
          icon: Clock,
          label: "Insérer l'heure actuelle",
        },
        { disabled: disabled || !schoolIdentity, onClick: handleInsertCoordonnees, icon: Building2, label: "Insérer les coordonnées de l'établissement" },
        { disabled: disabled || !profile?.nomComplet, onClick: handleInsertMyName, icon: UserRound, label: 'Insérer mon nom' },
        { disabled: disabled || !cibleLabel, onClick: () => insertText(cibleLabel ?? ''), icon: Users, label: 'Insérer les destinataires déjà choisis' },
        { disabled, onClick: () => insertText(FORMULE_APPEL), icon: MessageCircle, label: "Formule d'appel (Mesdames, Messieurs,)" },
        { disabled, onClick: () => insertText(FORMULE_POLITESSE), icon: Signature, label: 'Formule de politesse' },
      ],
    },
    {
      key: 'organiser',
      label: 'Organiser le texte',
      buttons: [
        { disabled, onClick: duplicateCurrentBlock, icon: CopyPlus, label: 'Dupliquer le paragraphe' },
        { disabled, onClick: deleteCurrentBlock, icon: Trash, label: 'Supprimer le paragraphe' },
        { disabled, onClick: moveBlockUp, icon: ArrowUp, label: 'Déplacer le paragraphe vers le haut' },
        { disabled, onClick: moveBlockDown, icon: ArrowDown, label: 'Déplacer le paragraphe vers le bas' },
      ],
    },
    {
      key: 'edition',
      label: 'Nettoyage & édition',
      buttons: [
        { disabled, onClick: handleSelectAll, icon: TextSelect, label: 'Tout sélectionner' },
        { disabled, onClick: handleClearAll, icon: Trash2, label: 'Tout effacer' },
        { disabled, onClick: cleanWhitespace, icon: Sparkles, label: 'Nettoyer les espaces multiples' },
        { disabled, onClick: stripAllFormatting, icon: RemoveFormatting, label: 'Tout mettre en texte brut' },
        { disabled, onClick: copyPlainText, icon: ClipboardCopy, label: 'Copier le texte brut' },
        { disabled, onClick: () => exec('undo'), icon: Undo2, label: 'Annuler' },
        { disabled, onClick: () => exec('redo'), icon: Redo2, label: 'Rétablir' },
        { disabled, onClick: () => setShowMarks((v) => !v), icon: Eye, label: 'Afficher les marques de mise en forme', active: showMarks },
      ],
    },
  ]

  return (
    <div>
      <style>{`
        .note-editor-html div[data-callout="1"] { background: #FFFBEB; border-left: 3px solid #F6DF43; padding: 8px 12px; border-radius: 4px; }
        .note-editor-html div[data-bordered="1"] { border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px; }
        .note-editor-html table { border-collapse: collapse; margin: 0 0 12px; }
        .note-editor-html td { border: 1px solid #cbd5e1; padding: 4px 8px; min-width: 60px; }
        .note-editor-html.show-marks p::after, .note-editor-html.show-marks div::after { content: '¶'; color: #94a3b8; margin-left: 2px; }
      `}</style>
      <div className="rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 px-1.5 pt-1.5">
        <div className="flex flex-wrap items-stretch">
          <RibbonGroup label="Police">
            <ToolbarSelect title="Police" width={92} options={FONT_FAMILIES.map((f) => ({ label: f, value: f }))} disabled={disabled} onPick={(v) => applyInlineStyle('fontFamily', v)} />
            <ToolbarSelect title="Taille" width={44} options={FONT_SIZES_PT.map((n) => ({ label: String(n), value: `${n}pt` }))} disabled={disabled} onPick={(v) => applyInlineStyle('fontSize', v)} />
            <ToolbarButton disabled={disabled} onClick={() => growShrinkFont(1)} icon={ChevronsUp} label="Agrandir la police" />
            <ToolbarButton disabled={disabled} onClick={() => growShrinkFont(-1)} icon={ChevronsDown} label="Réduire la police" />
            <ToolbarButton disabled={disabled} onClick={() => exec('bold')} icon={Bold} label="Gras" />
            <ToolbarButton disabled={disabled} onClick={() => exec('italic')} icon={Italic} label="Italique" />
            <ToolbarButton disabled={disabled} onClick={() => exec('underline')} icon={Underline} label="Souligné" />
            <ToolbarButton disabled={disabled} onClick={() => exec('strikeThrough')} icon={Strikethrough} label="Barré" />
            <ToolbarButton disabled={disabled} onClick={() => exec('superscript')} icon={Superscript} label="Exposant" />
            <ToolbarButton disabled={disabled} onClick={() => exec('subscript')} icon={Subscript} label="Indice" />
            <ToolbarButton disabled={disabled} onClick={() => exec('removeFormat')} icon={Eraser} label="Effacer la mise en forme" />
            <ToolbarSelect title="Surlignage" width={82} options={[{ label: 'Aucun surlignage', value: '' }, ...HIGHLIGHT_COLORS]} disabled={disabled} onPick={(v) => applyInlineStyle('backgroundColor', v)} />
            <ToolbarSelect title="Couleur" width={82} options={[{ label: 'Couleur du texte', value: '' }, ...TEXT_COLORS]} disabled={disabled} onPick={(v) => applyInlineStyle('color', v)} />
          </RibbonGroup>
          {categories.map((cat) => (
            <RibbonGroup key={cat.key} label={cat.label}>
              {cat.buttons.map((b, i) => (
                <ToolbarButton key={i} {...b} />
              ))}
            </RibbonGroup>
          ))}
          <RibbonGroup label="Espacement & trame">
            <ToolbarSelect title="Interligne" width={72} options={LINE_HEIGHTS.map((n) => ({ label: `× ${n}`, value: String(n) }))} disabled={disabled} onPick={(v) => applyParagraphStyle('lineHeight', v)} />
            <ToolbarSelect title="Trame de fond" width={82} options={[{ label: 'Aucune trame', value: '' }, ...SHADING_COLORS]} disabled={disabled} onPick={(v) => applyParagraphStyle('backgroundColor', v)} />
            <ToolbarButton disabled={disabled} onClick={() => toggleBlockAttr('data-bordered', '1')} icon={Square} label="Bordure de paragraphe" />
          </RibbonGroup>
          <RibbonGroup label="Rechercher">
            <ToolbarButton onClick={() => setShowFindReplace((v) => !v)} icon={Search} label="Rechercher & remplacer" />
          </RibbonGroup>
        </div>

        <div className="flex items-center justify-end border-t border-slate-200 py-0.5">
          <span className="whitespace-nowrap text-[9px] text-slate-400">
            {wordCount} mot{wordCount !== 1 ? 's' : ''} · {charCount} caractère{charCount !== 1 ? 's' : ''}
          </span>
        </div>

        {showFindReplace && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 py-1.5">
            <input
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Rechercher..."
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
            />
            <input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Remplacer par..."
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
            />
            <button type="button" disabled={disabled || !findText} onClick={handleReplaceAll} className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              Tout remplacer
            </button>
            <button type="button" onClick={() => setShowFindReplace(false)} className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Fermer
            </button>
          </div>
        )}
      </div>
      <div className="relative">
        {isEmpty && placeholder && <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">{placeholder}</span>}
        <div
          ref={ref}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
          onInput={handleInput}
          onPaste={handlePaste}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          className={`note-editor-html min-h-[55vh] w-full rounded-b-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none [&_a]:text-indigo-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-500 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:text-sm [&_h4]:font-bold [&_hr]:my-3 [&_hr]:border-slate-300 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc ${showMarks ? 'show-marks' : ''}`}
        />
      </div>
    </div>
  )
}
