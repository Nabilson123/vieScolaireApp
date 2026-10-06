import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import type { SuiviProf } from '../../data/suiviProfs'
import { remarquesImprimees, type PointParClasse, type SuiviCompteRendu } from '../../data/suiviCompteRendu'
import type { SuiviClasseAction } from '../../data/suiviClasseActions'
import type { LogicalGroup } from '../../utils/suiviClasseGroups'
import { getReclamationNote, reclamationNoteKey, type RiskStudent, type OpenReclamation } from '../../utils/suiviClasseRisqueAggregation'
import { teacherName } from '../../data/teachers'
import { weekdayLabelFromDate } from './SuiviClasseTab'
import { minutesToTime, timeToMinutes } from '../../data/classSchedules'
import { STATUT_RDV_LABELS, statutRdv, type RdvLigne, type StatutRdv } from '../../utils/suiviClasseRdv'
import { todayLocalISO } from '../../utils/reclamationsLogic'

interface PrintableCompteRenduReunionProps {
  group: LogicalGroup
  suivi: SuiviProf
  compteRendu: SuiviCompteRendu
  riskStudents: RiskStudent[]
  reclamations: OpenReclamation[]
  /** Actions encore ouvertes du niveau (point 8 « Décisions & actions »). */
  actions?: SuiviClasseAction[]
  /** Rendez-vous avec les parents du niveau (point 6), déjà filtrés et triés : à venir et tenus, sans les annulés. */
  rendezVous?: RdvLigne[]
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
const RDV_ROWS_PER_BLOCK = 8

const RDV_STATUT_COLOR: Record<StatutRdv, string> = { a_venir: '#15803d', a_cloturer: '#b45309', tenu: '#4338ca', annule: '#6b7280' }

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

/** Libellé français à gauche, traduction arabe à l'extrémité droite de la zone : l'arabe se lit en partant de la droite.
 * Jamais en capitales ni espacée côté arabe. */
function Bi({ fr, ar, className = '' }: { fr: string; ar: string; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${className}`}>
      <span>{fr}</span>
      <span dir="rtl" className="normal-case leading-none">
        {ar}
      </span>
    </div>
  )
}

function SectionTitle({ n, title, ar, suite }: { n: number; title: string; ar: string; suite?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: C.accent }}>
        {n}
      </span>
      <span className="text-[12px] font-extrabold" style={{ color: C.ink }}>
        {title}
        {suite ? ' (suite)' : ''}
      </span>
      <span dir="rtl" className="ml-auto flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: C.accent }}>
          {n}
        </span>
        <span className="text-[12px] font-extrabold leading-none" style={{ color: C.ink }}>
          {suite ? `${ar} (تابع)` : ar}
        </span>
      </span>
    </div>
  )
}

function TextBlock({ text, guide, blank, label }: { text?: string; guide: string; blank?: boolean; label?: string }) {
  const empty = blank || !tidy(text)
  return (
    <div className="rounded-md px-2.5 py-1 text-[10.5px] leading-[1.4]" style={{ border: `1px solid ${C.rule}`, color: empty ? C.muted : C.ink }}>
      {label && !blank && (
        <div className="mb-0.5 text-[9.5px] font-bold" style={{ color: C.accent }}>
          {label}
        </div>
      )}
      <p className="whitespace-pre-line" style={{ fontStyle: empty ? 'italic' : 'normal' }}>
        {blank ? guide : tidy(text) || '—'}
      </p>
    </div>
  )
}

function Th({ children, ar, width }: { children: string; ar: string; width?: number }) {
  return (
    <th className="border px-1.5 py-[3px] text-left font-bold" style={{ borderColor: C.rule, width }}>
      <span className="flex flex-wrap items-baseline justify-between gap-x-1.5">
        <span>{children}</span>
        <span dir="rtl" className="text-[9.5px] font-semibold leading-none" style={{ color: C.muted }}>
          {ar}
        </span>
      </span>
    </th>
  )
}

const cell = 'border px-1.5 py-[3px] whitespace-pre-line'

export default function PrintableCompteRenduReunion({ group, suivi, compteRendu: cr, riskStudents, reclamations, actions = [], rendezVous = [], blank = false }: PrintableCompteRenduReunionProps) {
  const participants = [...group.teachers.map(teacherName), 'Direction de la vie scolaire']
  const heure = suivi.heure.slice(0, 5)
  const blocks: PaginatedBlock[] = []

  // 1. Retour sur les actions précédentes
  blocks.push({
    key: 's1',
    node: (
      <div>
        <SectionTitle n={1} title="Retour sur les actions précédentes" ar="مراجعة الإجراءات السابقة" />
        <TextBlock text={cr.point1Commentaire} guide="Actions décidées lors de la dernière réunion — état d'avancement." blank={blank} />
      </div>
    ),
  })

  // Points 2 et 4 : la remarque commune à toutes les classes (pleine largeur), puis ce qui est propre à chaque classe.
  // La version vierge garde une zone par classe, à remplir à la main.
  const classes = group.divisions.map((d) => d.classe.nom)
  const parClasse = (n: number, title: string, ar: string, field: PointParClasse, guide: (classe: string) => string) => {
    const entries = blank ? classes.map((c) => ({ label: c, text: '', commune: false })) : remarquesImprimees(cr, field, classes)
    const commune = entries.find((e) => e.commune)
    const propres = entries.filter((e) => !e.commune)
    return (
      <div>
        <SectionTitle n={n} title={title} ar={ar} />
        <div className="flex flex-col gap-1.5">
          {commune && <TextBlock label={commune.label} text={commune.text} guide="" />}
          {propres.length > 0 && (
            <div className={`grid gap-1.5 ${propres.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {propres.map((e) => (
                <TextBlock key={e.label} label={classes.length > 1 ? (commune ? `Propre à ${e.label}` : e.label) : undefined} text={e.text} guide={guide(e.label)} blank={blank} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 2. Avancement pédagogique
  blocks.push({ key: 's2', node: parClasse(2, 'Avancement pédagogique', 'التقدم البيداغوجي', 'point2', (c) => `${c} — avancement des programmes, difficultés rencontrées.`) })

  // 3. Élèves à suivre
  if (blank || riskStudents.length === 0) {
    blocks.push({
      key: 's3',
      node: (
        <div>
          <SectionTitle n={3} title="Élèves à suivre" ar="التلاميذ الذين يستوجبون المتابعة" />
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
            <SectionTitle n={3} title="Élèves à suivre" ar="التلاميذ الذين يستوجبون المتابعة" suite={i > 0} />
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr style={{ background: C.headBg }}>
                  <Th width={185} ar="التلميذ">Élève</Th>
                  <Th ar="الملاحظة">Constat</Th>
                  <Th width={190} ar="الإجراء المتخذ">Mesure décidée</Th>
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
  blocks.push({ key: 's4', node: parClasse(4, 'Assiduité & comportement', 'المواظبة والسلوك', 'point4', (c) => `${c} — absences, retards, incidents à signaler.`) })

  // 5. Traitement des réclamations
  if (blank || reclamations.length === 0) {
    blocks.push({
      key: 's5',
      node: (
        <div>
          <SectionTitle n={5} title="Traitement des réclamations" ar="معالجة الشكايات" />
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
            <SectionTitle n={5} title="Traitement des réclamations" ar="معالجة الشكايات" suite={i > 0} />
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr style={{ background: C.headBg }}>
                  <Th ar="التلميذ">Élève</Th>
                  <Th ar="الموضوع">Objet</Th>
                  <Th ar="الوقائع">Faits vérifiés</Th>
                  <Th ar="الجواب">Réponse / suite</Th>
                  <Th width={76} ar="الحالة">Statut</Th>
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

  // 6. Relation avec les familles : le tableau des rendez-vous avec les parents (version remplie seulement), puis les remarques.
  if (blank || rendezVous.length === 0) {
    blocks.push({
      key: 's6',
      node: (
        <div>
          <SectionTitle n={6} title="Relation avec les familles" ar="العلاقة مع الأسر" />
          <TextBlock text={cr.point6} guide="Contacts parents notables, rendez-vous programmés." blank={blank} />
        </div>
      ),
    })
  } else {
    const today = todayLocalISO()
    chunk(rendezVous, RDV_ROWS_PER_BLOCK).forEach((rows, i) => {
      blocks.push({
        key: `s6-${i}`,
        node: (
          <div>
            <SectionTitle n={6} title="Relation avec les familles — rendez-vous avec les parents" ar="العلاقة مع الأسر — مواعيد مع الأولياء" suite={i > 0} />
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr style={{ background: C.headBg }}>
                  <Th width={185} ar="التلميذ">Élève</Th>
                  <Th width={132} ar="التاريخ والساعة">Date et heure</Th>
                  <Th ar="السبب">Motif</Th>
                  <Th width={76} ar="الحالة">Statut</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, j) => {
                  const statut = statutRdv(l.record, today)
                  return (
                    <tr key={`${l.studentId}-${l.record.date}-${l.record.heure}-${j}`}>
                      <td className={cell} style={{ borderColor: C.rule }}>
                        {l.studentName} <span style={{ color: C.muted }}>({l.classe})</span>
                      </td>
                      <td className={cell} style={{ borderColor: C.rule }}>
                        {formatDDMMYYYY(l.record.date)} · {l.record.heure.slice(0, 5)}
                      </td>
                      <td className={cell} style={{ borderColor: C.rule }}>
                        {tidy(l.record.motif) || '—'}
                      </td>
                      <td className={`${cell} font-bold`} style={{ borderColor: C.rule, color: RDV_STATUT_COLOR[statut] }}>
                        {STATUT_RDV_LABELS[statut]}
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
    if (tidy(cr.point6)) blocks.push({ key: 's6-text', node: <TextBlock text={cr.point6} guide="" label="Remarques" /> })
  }
  blocks.push({
    key: 's7',
    node: (
      <div>
        <SectionTitle n={7} title="Vie de classe & organisation" ar="الحياة داخل القسم والتنظيم" />
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
        <SectionTitle n={8} title="Décisions & actions" ar="القرارات والإجراءات" />
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr style={{ background: C.headBg }}>
              <Th ar="القرار / الإجراء">Décision / action</Th>
              <Th width={130} ar="المسؤول">Responsable</Th>
              <Th width={90} ar="الأجل">Échéance</Th>
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
              <div className="text-[13px] font-extrabold leading-tight" style={{ color: C.accent }}>
                {blank ? 'Feuille de route — Suivi de Classe' : 'Compte-rendu — Réunion de suivi de classe'}
                {pageIndex > 0 ? ' (suite)' : ''}
              </div>
              <div dir="rtl" className="text-[12px] font-extrabold leading-[1.15]" style={{ color: C.accent }}>
                {blank ? 'ورقة الطريق — متابعة القسم' : 'محضر اجتماع متابعة القسم'}
                {pageIndex > 0 ? ' (تابع)' : ''}
              </div>
              <div className="text-[10px] leading-tight" style={{ color: C.muted }}>
                {pageIndex > 0 ? `Niveau ${group.label} · ` : ''}Édité le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {pageIndex === 0 && (
            <div className="grid grid-cols-[0.55fr_0.9fr_1.5fr_2.5fr] gap-2 rounded-md p-2" style={{ background: C.headBg }}>
              <div>
                <Bi fr="Niveau" ar="المستوى" className="text-[9px] font-bold uppercase" />
                <div className="text-[12px] font-bold">{group.label}</div>
              </div>
              <div>
                <Bi fr="Classes" ar="الأقسام" className="text-[9px] font-bold uppercase" />
                <div className="text-[12px] font-bold">{group.divisions.map((d) => d.classe.nom).join(', ')}</div>
              </div>
              <div>
                <Bi fr="Date" ar="التاريخ" className="text-[9px] font-bold uppercase" />
                <div className="text-[12px] font-bold">
                  {blank ? '____ / ____ / ______' : `${weekdayLabelFromDate(suivi.date)} ${formatDDMMYYYY(suivi.date)} · ${heure}–${minutesToTime(timeToMinutes(suivi.heure) + suivi.duree)}`}
                </div>
              </div>
              <div>
                <Bi fr="Présents" ar="الحاضرون" className="text-[9px] font-bold uppercase" />
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
              <div className="w-[170px]">
                <Bi fr="Prochaine réunion" ar="الاجتماع المقبل" className="font-bold uppercase" />
                <div>____ / ____ / ______</div>
              </div>
              <div className="w-[150px]">
                <Bi fr="Visa Direction" ar="تأشيرة الإدارة" className="font-bold uppercase" />
                <div className="mt-4 border-t" style={{ borderColor: C.rule }} />
              </div>
            </>
          ) : (
            <>
              <div>Direction de la Vie Scolaire — Groupe Scolaire Mondrian</div>
              <div dir="rtl">إدارة الحياة المدرسية — مجموعة مدارس موندريان</div>
            </>
          )}
          {pageCount > 1 && (
            <Bi fr={`Page ${pageIndex + 1}/${pageCount}`} ar="صفحة" className="font-semibold" />
          )}
        </div>
      )}
    />
  )
}
