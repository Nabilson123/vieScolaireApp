import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import type { SuiviProf } from '../../data/suiviProfs'
import type { SuiviCompteRendu } from '../../data/suiviCompteRendu'
import type { SuiviClasseAction } from '../../data/suiviClasseActions'
import type { LogicalGroup } from '../../utils/suiviClasseGroups'
import { getReclamationNote, reclamationNoteKey, type RiskStudent, type OpenReclamation } from '../../utils/suiviClasseRisqueAggregation'
import { teacherName } from '../../data/teachers'
import { weekdayLabelFromDate } from './SuiviClasseTab'
import { minutesToTime, timeToMinutes } from '../../data/classSchedules'

interface PrintableCompteRenduReunionProps {
  group: LogicalGroup
  suivi: SuiviProf
  compteRendu: SuiviCompteRendu
  riskStudents: RiskStudent[]
  reclamations: OpenReclamation[]
  /** Actions encore ouvertes du niveau (point 8 « Décisions & actions »). */
  actions?: SuiviClasseAction[]
  blank?: boolean
}

const C = {
  ink: '#141414',
  muted: '#5a5a5a',
  rule: '#e5e7eb',
  headBg: '#f5f3ff',
  accent: '#7c3aed',
}

/** Lignes de tableau par bloc : un tableau long est découpé en tranches, chacune avec son en-tête, pour qu'aucune
 * ligne ne soit jamais coupée entre deux pages A4. */
const RISK_ROWS_PER_BLOCK = 10
const RECLAMATION_ROWS_PER_BLOCK = 5

function formatDDMMYYYY(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** Texte saisi dans le formulaire : les retours à la ligne sont conservés (un paragraphe par ligne), sans les lignes vides
 * entre paragraphes qui feraient déborder la page. */
function tidy(text?: string): string {
  return (text ?? '').trim().replace(/\n\s*\n+/g, '\n')
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

function SectionTitle({ n, title, suite }: { n: number; title: string; suite?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: C.accent }}>
        {n}
      </span>
      <span className="text-[12px] font-extrabold" style={{ color: C.ink }}>
        {title}
        {suite ? ' (suite)' : ''}
      </span>
    </div>
  )
}

function TextBlock({ text, guide, blank }: { text?: string; guide: string; blank?: boolean }) {
  return (
    <p className="whitespace-pre-line rounded-md px-2.5 py-1 text-[10.5px] leading-[1.4]" style={{ border: `1px solid ${C.rule}`, color: blank || !text ? C.muted : C.ink, fontStyle: blank || !text ? 'italic' : 'normal' }}>
      {blank ? guide : tidy(text) || '—'}
    </p>
  )
}

function Th({ children, width }: { children: string; width?: number }) {
  return (
    <th className="border px-1.5 py-[3px] text-left font-bold" style={{ borderColor: C.rule, width }}>
      {children}
    </th>
  )
}

const cell = 'border px-1.5 py-[3px] whitespace-pre-line'

export default function PrintableCompteRenduReunion({ group, suivi, compteRendu: cr, riskStudents, reclamations, actions = [], blank = false }: PrintableCompteRenduReunionProps) {
  const participants = [...group.teachers.map(teacherName), 'Direction de la vie scolaire']
  const heure = suivi.heure.slice(0, 5)
  const blocks: PaginatedBlock[] = []

  // 1. Retour sur les actions précédentes
  blocks.push({
    key: 's1',
    node: (
      <div>
        <SectionTitle n={1} title="Retour sur les actions précédentes" />
        <TextBlock text={cr.point1Commentaire} guide="Actions décidées lors de la dernière réunion — état d'avancement." blank={blank} />
      </div>
    ),
  })

  // 2. Avancement pédagogique
  blocks.push({
    key: 's2',
    node: (
      <div>
        <SectionTitle n={2} title="Avancement pédagogique" />
        <div className="grid grid-cols-2 gap-1.5">
          {group.divisions.map((d) => (
            <TextBlock key={d.classe.id} text={cr.point2?.[d.classe.nom]} guide={`${d.classe.nom} — avancement des programmes, difficultés rencontrées.`} blank={blank} />
          ))}
        </div>
      </div>
    ),
  })

  // 3. Élèves à suivre
  if (blank || riskStudents.length === 0) {
    blocks.push({
      key: 's3',
      node: (
        <div>
          <SectionTitle n={3} title="Élèves à suivre" />
          <TextBlock guide="Élèves nécessitant un suivi particulier — constat et mesure décidée." blank />
        </div>
      ),
    })
  } else {
    chunk(riskStudents, RISK_ROWS_PER_BLOCK).forEach((rows, i) => {
      blocks.push({
        key: `s3-${i}`,
        node: (
          <div>
            <SectionTitle n={3} title="Élèves à suivre" suite={i > 0} />
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr style={{ background: C.headBg }}>
                  <Th width={185}>Élève</Th>
                  <Th>Constat</Th>
                  <Th width={190}>Mesure décidée</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={cell} style={{ borderColor: C.rule }}>
                      {r.name} <span style={{ color: C.muted }}>({r.classe})</span>
                    </td>
                    <td className={cell} style={{ borderColor: C.rule }}>
                      {tidy(cr.point3?.[r.id]?.constat) || r.reasons.join(' · ')}
                    </td>
                    <td className={cell} style={{ borderColor: C.rule }}>
                      {tidy(cr.point3?.[r.id]?.mesure) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      })
    })
    if (cr.point3Extra) blocks.push({ key: 's3-extra', node: <TextBlock text={cr.point3Extra} guide="" blank={false} /> })
  }

  // 4. Assiduité & comportement
  blocks.push({
    key: 's4',
    node: (
      <div>
        <SectionTitle n={4} title="Assiduité & comportement" />
        <div className="grid grid-cols-2 gap-1.5">
          {group.divisions.map((d) => (
            <TextBlock key={d.classe.id} text={cr.point4?.[d.classe.nom]} guide={`${d.classe.nom} — absences, retards, incidents à signaler.`} blank={blank} />
          ))}
        </div>
      </div>
    ),
  })

  // 5. Traitement des réclamations
  if (blank || reclamations.length === 0) {
    blocks.push({
      key: 's5',
      node: (
        <div>
          <SectionTitle n={5} title="Traitement des réclamations" />
          <TextBlock guide="Réclamations parents ouvertes — faits vérifiés et réponse apportée." blank />
        </div>
      ),
    })
  } else {
    chunk(reclamations, RECLAMATION_ROWS_PER_BLOCK).forEach((rows, i) => {
      blocks.push({
        key: `s5-${i}`,
        node: (
          <div>
            <SectionTitle n={5} title="Traitement des réclamations" suite={i > 0} />
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr style={{ background: C.headBg }}>
                  <Th>Élève</Th>
                  <Th>Objet</Th>
                  <Th>Faits vérifiés</Th>
                  <Th>Réponse / suite</Th>
                  <Th width={64}>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const note = getReclamationNote(cr.point5, r)
                  const traitee = r.statut === 'Résolue'
                  return (
                    <tr key={reclamationNoteKey(r)}>
                      <td className={cell} style={{ borderColor: C.rule }}>
                        {r.studentName} <span style={{ color: C.muted }}>({r.classe})</span>
                      </td>
                      <td className={cell} style={{ borderColor: C.rule }}>
                        {r.type} — {r.objet}
                      </td>
                      <td className={cell} style={{ borderColor: C.rule }}>
                        {tidy(note?.faits) || '—'}
                      </td>
                      <td className={cell} style={{ borderColor: C.rule }}>
                        {tidy(note?.reponse) || '—'}
                      </td>
                      <td className={`${cell} font-bold`} style={{ borderColor: C.rule, color: traitee ? '#15803d' : '#b45309' }}>
                        {traitee ? 'Traitée' : 'Ouverte'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ),
      })
    })
  }

  // 6 et 7
  blocks.push({
    key: 's6',
    node: (
      <div>
        <SectionTitle n={6} title="Relation avec les familles" />
        <TextBlock text={cr.point6} guide="Contacts parents notables, rendez-vous programmés." blank={blank} />
      </div>
    ),
  })
  blocks.push({
    key: 's7',
    node: (
      <div>
        <SectionTitle n={7} title="Vie de classe & organisation" />
        <TextBlock text={cr.point7} guide="Organisation matérielle, sorties, événements de classe." blank={blank} />
      </div>
    ),
  })

  // 8. Décisions & actions : les actions ouvertes du niveau, ou des lignes à remplir à la main (version vierge)
  const openActions = blank ? [] : actions.filter((a) => a.statut !== 'faite')
  blocks.push({
    key: 's8',
    node: (
      <div>
        <SectionTitle n={8} title="Décisions & actions" />
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr style={{ background: C.headBg }}>
              <Th>Décision / action</Th>
              <Th width={130}>Responsable</Th>
              <Th width={90}>Échéance</Th>
            </tr>
          </thead>
          <tbody>
            {openActions.map((a) => (
              <tr key={a.id}>
                <td className={cell} style={{ borderColor: C.rule }}>
                  {tidy(a.texte)}
                </td>
                <td className={cell} style={{ borderColor: C.rule }}>
                  {a.ownerName || '—'}
                </td>
                <td className={cell} style={{ borderColor: C.rule }}>
                  {a.echeance ? formatDDMMYYYY(a.echeance) : '—'}
                </td>
              </tr>
            ))}
            {(blank || openActions.length === 0) &&
              Array.from({ length: blank ? 4 : 2 }).map((_, i) => (
                <tr key={`vide-${i}`}>
                  <td className="border px-1.5" style={{ borderColor: C.rule, height: 22 }} />
                  <td className="border px-1.5" style={{ borderColor: C.rule }} />
                  <td className="border px-1.5" style={{ borderColor: C.rule }} />
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    ),
  })

  // Les clés changent avec la version (remplie / vierge) : la pagination se recalcule quand on bascule, même si les
  // sections restent les mêmes mais plus ou moins hautes.
  const keyed = blocks.map((b) => ({ ...b, key: `${blank ? 'vierge' : 'rempli'}-${b.key}` }))

  return (
    <PaginatedPrintDocument
      blocks={keyed}
      paddingXPx={36}
      paddingYPx={24}
      gapPx={7}
      pageStyle={{ background: '#fff', color: C.ink }}
      renderHeader={(pageIndex) => (
        <>
          <div className="flex items-start justify-between border-b pb-2.5" style={{ borderColor: C.ink }}>
            <div className="flex items-center gap-2.5">
              <SchoolLogo size={40} />
              <div>
                <div className="text-[15px] font-extrabold">Groupe Scolaire Mondrian</div>
                <div className="text-[10px]" style={{ color: C.muted }}>
                  Direction de la Vie Scolaire
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-extrabold" style={{ color: C.accent }}>
                {blank ? 'Feuille de route — Suivi de Classe' : 'Compte-rendu — Réunion de suivi de classe'}
                {pageIndex > 0 ? ' (suite)' : ''}
              </div>
              <div className="text-[10px]" style={{ color: C.muted }}>
                {pageIndex > 0 ? `Niveau ${group.label} · ` : ''}Édité le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {pageIndex === 0 && (
            <div className="grid grid-cols-[0.55fr_0.9fr_1.5fr_2.5fr] gap-2 rounded-md p-2" style={{ background: C.headBg }}>
              <div>
                <div className="text-[9px] font-bold uppercase" style={{ color: C.muted }}>
                  Niveau
                </div>
                <div className="text-[12px] font-bold">{group.label}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase" style={{ color: C.muted }}>
                  Classes
                </div>
                <div className="text-[12px] font-bold">{group.divisions.map((d) => d.classe.nom).join(', ')}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase" style={{ color: C.muted }}>
                  Date
                </div>
                <div className="text-[12px] font-bold">
                  {blank ? '____ / ____ / ______' : `${weekdayLabelFromDate(suivi.date)} ${formatDDMMYYYY(suivi.date)} · ${heure}–${minutesToTime(timeToMinutes(suivi.heure) + suivi.duree)}`}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase" style={{ color: C.muted }}>
                  Présents
                </div>
                <div className="text-[11px] font-semibold">
                  {participants
                    .map((p) => {
                      const state = cr.presence?.[p]
                      return blank ? p : `${p}${state === 'absent' ? ' (absent)' : state === 'excuse' ? ' (excusé)' : ''}`
                    })
                    .join(', ')}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <div className="flex items-end justify-between border-t pt-2.5 text-[9px]" style={{ borderColor: C.rule, color: C.muted }}>
          {pageIndex === pageCount - 1 ? (
            <>
              <div>
                <div className="font-bold uppercase" style={{ color: C.ink }}>
                  Prochaine réunion
                </div>
                <div>____ / ____ / ______</div>
              </div>
              <div className="text-center">
                <div className="font-bold uppercase" style={{ color: C.ink }}>
                  Visa Direction
                </div>
                <div className="mt-4 w-[140px] border-t" style={{ borderColor: C.rule }} />
              </div>
            </>
          ) : (
            <div>Direction de la Vie Scolaire — Groupe Scolaire Mondrian</div>
          )}
          {pageCount > 1 && (
            <div className="font-semibold">
              Page {pageIndex + 1}/{pageCount}
            </div>
          )}
        </div>
      )}
    />
  )
}
