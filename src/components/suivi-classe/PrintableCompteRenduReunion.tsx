import SchoolLogo from '../print/SchoolLogo'
import type { SuiviProf } from '../../data/suiviProfs'
import type { SuiviCompteRendu } from '../../data/suiviCompteRendu'
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
  blank?: boolean
}

const C = {
  ink: '#141414',
  muted: '#5a5a5a',
  rule: '#e5e7eb',
  headBg: '#f5f3ff',
  accent: '#7c3aed',
}

function formatDDMMYYYY(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-2 first:mt-0">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: C.accent }}>
        {n}
      </span>
      <span className="text-[12px] font-extrabold" style={{ color: C.ink }}>
        {title}
      </span>
    </div>
  )
}

function TextBlock({ text, guide, blank }: { text?: string; guide: string; blank?: boolean }) {
  return (
    <p className="rounded-md px-2.5 py-1.5 text-[10.5px] leading-[1.5]" style={{ border: `1px solid ${C.rule}`, color: blank || !text ? C.muted : C.ink, fontStyle: blank || !text ? 'italic' : 'normal' }}>
      {blank ? guide : text || '—'}
    </p>
  )
}

export default function PrintableCompteRenduReunion({ group, suivi, compteRendu: cr, riskStudents, reclamations, blank = false }: PrintableCompteRenduReunionProps) {
  const participants = [...group.teachers.map(teacherName), 'Direction de la vie scolaire']

  return (
    <div id="printable-compte-rendu-reunion" className="print-page flex flex-col gap-3 px-9 py-7" style={{ background: '#fff', color: C.ink }}>
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
          </div>
          <div className="text-[10px]" style={{ color: C.muted }}>
            Édité le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-md p-2" style={{ background: C.headBg }}>
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
            {blank ? '____ / ____ / ______' : `${weekdayLabelFromDate(suivi.date)} ${formatDDMMYYYY(suivi.date)} · ${suivi.heure}–${minutesToTime(timeToMinutes(suivi.heure) + suivi.duree)}`}
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

      <SectionTitle n={1} title="Retour sur les actions précédentes" />
      <TextBlock text={cr.point1Commentaire} guide="Actions décidées lors de la dernière réunion — état d'avancement." blank={blank} />

      <SectionTitle n={2} title="Avancement pédagogique" />
      <div className="grid grid-cols-2 gap-1.5">
        {group.divisions.map((d) => (
          <TextBlock key={d.classe.id} text={cr.point2?.[d.classe.nom]} guide={`${d.classe.nom} — avancement des programmes, difficultés rencontrées.`} blank={blank} />
        ))}
      </div>

      <SectionTitle n={3} title="Élèves à suivre" />
      {blank || riskStudents.length === 0 ? (
        <TextBlock guide="Élèves nécessitant un suivi particulier — constat et mesure décidée." blank />
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr style={{ background: C.headBg }}>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
                Élève
              </th>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
                Constat
              </th>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
                Mesure décidée
              </th>
            </tr>
          </thead>
          <tbody>
            {riskStudents.map((r) => (
              <tr key={r.id}>
                <td className="border px-1.5 py-1" style={{ borderColor: C.rule }}>
                  {r.name} <span style={{ color: C.muted }}>({r.classe})</span>
                </td>
                <td className="border px-1.5 py-1" style={{ borderColor: C.rule }}>
                  {cr.point3?.[r.id]?.constat || r.reasons.join(' · ')}
                </td>
                <td className="border px-1.5 py-1" style={{ borderColor: C.rule }}>
                  {cr.point3?.[r.id]?.mesure || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!blank && cr.point3Extra && <TextBlock text={cr.point3Extra} guide="" blank={false} />}

      <SectionTitle n={4} title="Assiduité & comportement" />
      <div className="grid grid-cols-2 gap-1.5">
        {group.divisions.map((d) => (
          <TextBlock key={d.classe.id} text={cr.point4?.[d.classe.nom]} guide={`${d.classe.nom} — absences, retards, incidents à signaler.`} blank={blank} />
        ))}
      </div>

      <SectionTitle n={5} title="Traitement des réclamations" />
      {blank || reclamations.length === 0 ? (
        <TextBlock guide="Réclamations parents ouvertes — faits vérifiés et réponse apportée." blank />
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr style={{ background: C.headBg }}>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
                Élève
              </th>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
                Objet
              </th>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
                Faits vérifiés
              </th>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
                Réponse / suite
              </th>
              <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule, width: 64 }}>
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            {reclamations.map((r) => {
              const key = reclamationNoteKey(r)
              const note = getReclamationNote(cr.point5, r)
              const traitee = r.statut === 'Résolue'
              return (
                <tr key={key}>
                  <td className="border px-1.5 py-1" style={{ borderColor: C.rule }}>
                    {r.studentName} <span style={{ color: C.muted }}>({r.classe})</span>
                  </td>
                  <td className="border px-1.5 py-1" style={{ borderColor: C.rule }}>
                    {r.type} — {r.objet}
                  </td>
                  <td className="border px-1.5 py-1" style={{ borderColor: C.rule }}>
                    {note?.faits || '—'}
                  </td>
                  <td className="border px-1.5 py-1" style={{ borderColor: C.rule }}>
                    {note?.reponse || '—'}
                  </td>
                  <td className="border px-1.5 py-1 font-bold" style={{ borderColor: C.rule, color: traitee ? '#15803d' : '#b45309' }}>
                    {traitee ? 'Traitée' : 'Ouverte'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <SectionTitle n={6} title="Relation avec les familles" />
      <TextBlock text={cr.point6} guide="Contacts parents notables, rendez-vous programmés." blank={blank} />

      <SectionTitle n={7} title="Vie de classe & organisation" />
      <TextBlock text={cr.point7} guide="Organisation matérielle, sorties, événements de classe." blank={blank} />

      <SectionTitle n={8} title="Décisions & actions" />
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr style={{ background: C.headBg }}>
            <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule }}>
              Décision / action
            </th>
            <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule, width: 130 }}>
              Responsable
            </th>
            <th className="border px-1.5 py-1 text-left font-bold" style={{ borderColor: C.rule, width: 90 }}>
              Échéance
            </th>
          </tr>
        </thead>
        <tbody>
          {blank
            ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="border px-1.5" style={{ borderColor: C.rule, height: 22 }} />
                  <td className="border px-1.5" style={{ borderColor: C.rule }} />
                  <td className="border px-1.5" style={{ borderColor: C.rule }} />
                </tr>
              ))
            : null}
        </tbody>
      </table>

      <div className="mt-3 flex items-end justify-between border-t pt-2.5 text-[9px]" style={{ borderColor: C.rule, color: C.muted }}>
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
      </div>
    </div>
  )
}
