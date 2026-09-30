import type { CSSProperties, ReactNode } from 'react'
import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { useSchoolIdentity } from '../../services/schoolIdentityService'
import { NOTE_TYPE_CONFIG, type NoteService } from '../../data/notesService'
import { ROLE_LABELS, type ProfileRole } from '../../data/profiles'
import { sanitizeNoteHtml } from '../../utils/noteServiceHtml'

const ARCHIVO = "'Archivo', sans-serif"
const SOURCE_SANS = "'Source Sans 3', sans-serif"
const PAGE_PADDING_X = 68

const C = {
  ink: '#141414',
  textSecondary: '#5a5a5a',
  textTertiary: '#8a8a8a',
  ruleGray: '#cfcfcf',
  couponBlank: '#9a9a9a',
  paperGray: '#f7f6f2',
} as const

const FOOTER_STRIPES = ['#F6DF43', '#E1252B', '#1160AE', '#141414']

interface Signataire {
  nomComplet: string
  role: ProfileRole
  signatureImage?: string
}

interface PrintableNoteServiceProps {
  note: NoteService
  signataire?: Signataire
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function cibleLabel(note: NoteService): string {
  if (note.audience !== 'PARENTS') {
    if (note.cibleType === 'etablissement') return note.audience === 'ENSEIGNANTS' ? 'Tous les enseignants' : note.audience === 'ADMINISTRATIF' ? 'Tout le personnel' : 'Tout l\'établissement'
    return `${(note.ciblePersonneIds ?? []).length} destinataire(s)`
  }
  if (note.cibleType === 'etablissement') return 'Tout l\'établissement'
  if (note.cibleType === 'niveau') return note.cibleNiveau ?? '—'
  if (note.cibleType === 'classe') return note.cibleClasse ?? '—'
  return `${(note.cibleEleveIds ?? []).length} élève(s)`
}

const CORPS_HTML_CSS = `
  .note-corps-html p, .note-corps-html div { margin: 0 0 3px; }
  .note-corps-html strong, .note-corps-html b { font-weight: 700; }
  .note-corps-html em, .note-corps-html i { font-style: italic; }
  .note-corps-html u { text-decoration: underline; }
  .note-corps-html s, .note-corps-html strike { text-decoration: line-through; }
  .note-corps-html sup { vertical-align: super; font-size: 0.7em; }
  .note-corps-html sub { vertical-align: sub; font-size: 0.7em; }
  .note-corps-html mark { background: #FDE68A; padding: 0 2px; border-radius: 2px; }
  .note-corps-html ul, .note-corps-html ol { margin: 0 0 3px; padding-left: 22px; }
  .note-corps-html ul { list-style-type: disc; }
  .note-corps-html ol { list-style-type: decimal; }
  .note-corps-html li { margin-bottom: 6px; }
  .note-corps-html a { color: #1160AE; text-decoration: underline; }
  .note-corps-html h2 { font-family: ${ARCHIVO}; font-size: 19px; font-weight: 700; margin: 0 0 13px; color: ${C.ink}; }
  .note-corps-html h3 { font-family: ${ARCHIVO}; font-size: 16.5px; font-weight: 700; margin: 0 0 12px; color: ${C.ink}; }
  .note-corps-html h4 { font-family: ${ARCHIVO}; font-size: 14.5px; font-weight: 700; margin: 0 0 10px; color: ${C.ink}; }
  .note-corps-html blockquote { margin: 0 0 3px; padding: 4px 16px; border-left: 3px solid ${C.ruleGray}; color: ${C.textSecondary}; font-style: italic; }
  .note-corps-html hr { margin: 4px 0 3px; border: none; border-top: 1px solid ${C.ruleGray}; }
  .note-corps-html div[data-callout="1"] { background: #FFFBEB; border-left: 3px solid #F6DF43; padding: 10px 14px; border-radius: 4px; }
  .note-corps-html div[dir="rtl"] { text-align: right; }
  .note-corps-html div[data-bordered="1"] { border: 1px solid ${C.ruleGray}; padding: 8px 12px; border-radius: 4px; }
  .note-corps-html table { border-collapse: collapse; margin: 0 0 3px; width: 100%; }
  .note-corps-html td { border: 1px solid ${C.ruleGray}; padding: 6px 10px; }
`

/** Découpe le corps en fragments de haut niveau (un par <p>/<div>/<h2>.../<table>/<hr>... à la
 * racine du HTML assaini) pour pouvoir les répartir sur plusieurs pages A4 sans jamais couper un
 * paragraphe en deux — un texte long ne doit plus produire une page qui grandit indéfiniment, il
 * doit se poursuivre proprement sur une 2e, 3e... page, comme n'importe quel document paginé de
 * cette appli (Réclamations, Rendez-vous...). Un texte très court (0-1 paragraphe) retombe
 * naturellement sur une seule page, sans changement visible par rapport à avant. */
function splitCorpsIntoBlocks(corpsHtml: string): string[] {
  const doc = new DOMParser().parseFromString(corpsHtml, 'text/html')
  const blocks: string[] = []
  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push((node as HTMLElement).outerHTML)
      return
    }
    // Texte tapé sans jamais passer par un bouton de mise en forme reste un nœud texte brut, sans
    // balise de bloc englobante (cf. RichTextEditor) — on l'enveloppe nous-mêmes dans un <p> pour
    // qu'il ne disparaisse pas silencieusement (body.children, à la différence de childNodes,
    // ignore les nœuds texte).
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const p = doc.createElement('p')
      p.textContent = node.textContent
      blocks.push(p.outerHTML)
    }
  })
  return blocks
}

// getBoundingClientRect() (utilisé par PaginatedPrintDocument pour mesurer chaque bloc avant de les
// répartir sur les pages) n'inclut jamais la marge propre d'un élément, et une marge du bord peut en
// plus "s'échapper" (collapse) à travers un parent sans contexte de formatage propre — sans ce
// correctif, la hauteur mesurée de chaque bloc est systématiquement sous-estimée (de sa marge), et
// la pagination case donc trop de contenu par page. flow-root crée un nouveau contexte de formatage
// de bloc qui empêche cette fuite, sans rien changer au rendu visuel.
function flowRoot(node: ReactNode) {
  return <div style={{ display: 'flow-root' }}>{node}</div>
}

export default function PrintableNoteService({ note, signataire }: PrintableNoteServiceProps) {
  const { data: identity } = useSchoolIdentity()
  const typeConfig = NOTE_TYPE_CONFIG[note.type]
  const isBrouillon = note.statut === 'BROUILLON'

  const pastilleStyle: CSSProperties = typeConfig.bordered
    ? { background: '#FFFFFF', color: typeConfig.textOnColor, border: `1px solid ${C.ruleGray}` }
    : { background: typeConfig.color, color: typeConfig.textOnColor }

  const bandStyle: CSSProperties = typeConfig.bordered
    ? { background: '#FFFFFF', borderBottom: `1px solid ${C.ruleGray}` }
    : { background: typeConfig.color }

  const corpsHtml = sanitizeNoteHtml(note.corps)
  const corpsIsEmpty = !corpsHtml.replace(/<[^>]*>/g, '').trim()

  const blocks: PaginatedBlock[] = [
    {
      key: 'objet',
      node: flowRoot(
        <h1 style={{ fontFamily: ARCHIVO, fontSize: 29, fontWeight: 800, lineHeight: 1.22, letterSpacing: '-0.01em', margin: '0 0 18px', textAlign: 'center' }}>
          {note.objet || 'Objet de la note'}
        </h1>
      ),
    },
  ]

  if (corpsIsEmpty) {
    blocks.push({ key: 'corps-empty', node: flowRoot(<p style={{ fontSize: 15.5, lineHeight: 1.5, margin: '0 0 6px', color: C.textTertiary }}>—</p>) })
  } else {
    splitCorpsIntoBlocks(corpsHtml).forEach((html, i) => {
      blocks.push({
        key: `corps-${i}`,
        node: flowRoot(<div className="note-corps-html" style={{ fontSize: 15.5, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: html }} />),
      })
    })
  }

  if (note.couponActif) {
    blocks.push({
      key: 'coupon',
      node: flowRoot(
        <div style={{ borderTop: `2px dashed ${C.ruleGray}`, paddingTop: 14, marginTop: 8 }}>
          <div style={{ fontFamily: ARCHIVO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            Coupon-réponse à retourner
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.8, margin: '0 0 8px' }}>
            Je soussigné(e) <span style={{ display: 'inline-block', minWidth: 180, borderBottom: `1px solid ${C.couponBlank}` }} />, responsable de{' '}
            <span style={{ display: 'inline-block', minWidth: 150, borderBottom: `1px solid ${C.couponBlank}` }} />, classe{' '}
            <span style={{ display: 'inline-block', minWidth: 70, borderBottom: `1px solid ${C.couponBlank}` }} />.
          </p>
          {note.couponType === 'autorisation' && (
            <div style={{ display: 'flex', gap: 24, fontSize: 13, margin: '8px 0' }}>
              <span>☐ autorise</span>
              <span>☐ n'autorise pas</span>
            </div>
          )}
          {note.couponType === 'accuse_lecture' && <div style={{ fontSize: 13, margin: '8px 0' }}>☐ accusé de lecture</div>}
          {note.couponType === 'libre' && (
            <div style={{ fontSize: 13, margin: '8px 0' }}>
              Réponse : <span style={{ display: 'inline-block', minWidth: 220, borderBottom: `1px solid ${C.couponBlank}` }} />
            </div>
          )}
          {note.couponDateLimite && (
            <p style={{ fontSize: 12.5, color: C.textSecondary, margin: '4px 0 0' }}>À retourner avant le {new Date(note.couponDateLimite + 'T00:00:00').toLocaleDateString('fr-FR')}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
            <span>
              Date : <span style={{ display: 'inline-block', minWidth: 110, borderBottom: `1px solid ${C.couponBlank}` }} />
            </span>
            <span>
              Signature : <span style={{ display: 'inline-block', minWidth: 160, borderBottom: `1px solid ${C.couponBlank}` }} />
            </span>
          </div>
        </div>
      ),
    })
  }

  blocks.push({
    key: 'signature',
    node: flowRoot(
      <div style={{ marginTop: 10, marginLeft: 'auto', textAlign: 'right', width: 260 }}>
        {signataire && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{signataire.nomComplet}</div>
            <div style={{ fontSize: 13.5, color: C.textSecondary }}>{ROLE_LABELS[signataire.role]}</div>
          </div>
        )}
        <div style={{ height: 84, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {identity?.cachet && <img src={identity.cachet} alt="Cachet" style={{ maxHeight: 82, maxWidth: 82, objectFit: 'contain' }} />}
          {signataire?.signatureImage && <img src={signataire.signatureImage} alt="Signature" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />}
        </div>
      </div>
    ),
  })

  const renderHeader = (pageIndex: number, pageCount: number) => (
    <div style={{ display: 'flow-root' }}>
      {isBrouillon && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden" style={{ fontFamily: ARCHIVO }}>
          <span style={{ fontSize: 120, fontWeight: 800, color: 'rgba(20,20,20,0.08)', transform: 'rotate(-35deg)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            BROUILLON
          </span>
        </div>
      )}
      {/* Filet de tête plein-bleed — la page a un padding horizontal uniforme (PAGE_PADDING_X), donc
          ce filet doit s'en extraire par une marge négative pour rester bord à bord. */}
      <div style={{ height: 30, width: `calc(100% + ${PAGE_PADDING_X * 2}px)`, margin: `0 -${PAGE_PADDING_X}px`, ...bandStyle }} />
      <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 30, marginTop: 45, paddingBottom: 19, borderBottom: `1.5px solid ${C.ink}` }}>
        <div>
          <div style={{ fontFamily: ARCHIVO, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1.25 }}>
            {identity?.nom ?? 'Groupe Scolaire Mondrian'}
          </div>
          <div style={{ fontFamily: ARCHIVO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textSecondary, lineHeight: 1.5, marginTop: 4 }}>
            Service Vie scolaire
          </div>
        </div>
        <div style={{ justifySelf: 'center' }}>
          <SchoolLogo size={64} />
        </div>
        <div style={{ justifySelf: 'end' }}>
          <span
            style={{
              fontFamily: ARCHIVO,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '6px 13px',
              whiteSpace: 'nowrap',
              ...pastilleStyle,
            }}
          >
            {typeConfig.label}
          </span>
        </div>
      </header>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 38, margin: '19px 0 42px', fontSize: 12.5, color: C.textSecondary }}>
        <span>Réf. {note.reference}</span>
        <span>
          {cibleLabel(note)}
          {pageCount > 1 && pageIndex > 0 ? ' · (suite)' : ''}
        </span>
        <span>Le {todayFR()}</span>
      </div>
    </div>
  )

  const renderFooter = (pageIndex: number, pageCount: number) => (
    <footer style={{ paddingBottom: 20 }}>
      <div style={{ display: 'flex', marginBottom: 19 }}>
        {FOOTER_STRIPES.map((color, idx) => (
          <div key={idx} style={{ flex: 1, height: 6, background: color }} />
        ))}
      </div>
      <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{identity?.nom ?? 'Groupe Scolaire Mondrian'}</div>
        {identity?.nomAr && (
          <div dir="rtl" style={{ fontSize: 11, color: C.textSecondary }}>
            {identity.nomAr}
          </div>
        )}
        <div style={{ fontSize: 11, color: C.textSecondary }}>{identity?.adresse ?? ''}</div>
        <div style={{ fontSize: 11, color: C.textSecondary }}>{[identity?.tel1, identity?.tel2].filter(Boolean).join(' · ')}</div>
        <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 8 }}>
          Autorisation n° A.B.T.E 2018/51.200{pageCount > 1 ? ` — Page ${pageIndex + 1}/${pageCount}` : ''}
        </div>
      </div>
    </footer>
  )

  return (
    <>
      <style>{CORPS_HTML_CSS}</style>
      <PaginatedPrintDocument
        blocks={blocks}
        renderHeader={renderHeader}
        renderFooter={renderFooter}
        pageStyle={{ fontFamily: SOURCE_SANS, color: C.ink, position: 'relative' }}
        paddingXPx={PAGE_PADDING_X}
        paddingYPx={0}
        gapPx={0}
      />
    </>
  )
}
