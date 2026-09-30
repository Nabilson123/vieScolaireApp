import type { CSSProperties } from 'react'
import type { Student } from '../../../data/students'
import type { StudentExtra } from '../../../data/studentDetails'
import { colorForSubject } from '../../../data/studentDetails'
import type { FilteredStudentView } from '../../../utils/studentAggregation'
import { parseDuration } from '../../../utils/studentAggregation'
import { moyenneScaleForClasse } from '../../../utils/alertEngine'
import { INK, MUTED, PAGE_BG, BORDER, INDIGO, TEAL, RED, AMBER, PAGE_FONT } from '../../print/reportTheme'
import ReportEmptyStateBox from '../../print/ReportEmptyStateBox'
import PaginatedPrintDocument, { type PaginatedBlock } from '../../print/PaginatedPrintDocument'

interface PrintableBilanProps {
  student: Student
  extra: StudentExtra
  view: FilteredStudentView
  periodLabel: string
  evaluationType: string
}

const CARD: CSSProperties = { background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
const PADDING_X = 46
const PADDING_Y = 36
const GAP = 16

const SUBJECT_HEX: Record<'blue' | 'cyan' | 'amber' | 'purple', string> = {
  blue: INDIGO,
  cyan: TEAL,
  amber: AMBER,
  purple: '#8B5FBF',
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

function CircularGauge({ value, label, detail, color, deg }: { value: string; label: string; detail: string; color: string; deg: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3.5 text-center" style={CARD}>
      <div
        className="flex h-[68px] w-[68px] items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${color} ${deg}deg, #EDECEB ${deg}deg)` }}
      >
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[13px] font-bold">{value}</div>
      </div>
      <div className="text-[9.5px] uppercase tracking-[0.03em]" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="text-[9px]" style={{ color: '#94969B' }}>
        {detail}
      </div>
    </div>
  )
}

export default function PrintableBilan({ student, extra, view, periodLabel, evaluationType }: PrintableBilanProps) {
  const scale = moyenneScaleForClasse(student.classe) ?? 20
  const notesRows = view.notes.filter((row) => row.moyenne !== null)
  const heuresParMatiere = [...view.subjectBreakdown].sort((a, b) => parseDuration(b.total) - parseDuration(a.total))
  const heuresManqueesDecimal = parseDuration(view.totalHeures) / 60

  const kpis = [
    {
      label: 'Présence',
      value: `${Math.round(student.taux)}%`,
      detail: 'Sur la période',
      color: TEAL,
      deg: Math.min(Math.max(student.taux, 0), 100) * 3.6,
    },
    {
      label: 'Conduite',
      value: `${extra.conduite}/20`,
      detail: view.faitsDisciplinaires > 0 ? `${view.discipline.length} fait(s)` : 'Aucun fait',
      color: INDIGO,
      deg: (Math.min(Math.max(extra.conduite, 0), 20) / 20) * 360,
    },
    {
      label: 'Moyenne',
      value: extra.moyenne.toFixed(1),
      detail: `/${scale} générale`,
      color: AMBER,
      deg: (Math.min(Math.max(extra.moyenne, 0), scale) / scale) * 360,
    },
    {
      label: 'Absences',
      value: view.totalHeures,
      detail: `${view.faitsDisciplinaires} fait(s) discipl.`,
      color: TEAL,
      deg: Math.min(heuresManqueesDecimal / 20, 1) * 360,
    },
  ]

  const blocks: PaginatedBlock[] = [
    {
      key: 'period-label',
      node: (
        <p className="text-center text-[10px]" style={{ color: MUTED }}>
          Période du bilan : <strong style={{ color: '#4B4D53' }}>{periodLabel}</strong>
        </p>
      ),
    },
    {
      key: 'kpis',
      node: (
        <div className="grid grid-cols-4 gap-3.5">
          {kpis.map((k) => (
            <CircularGauge key={k.label} {...k} />
          ))}
        </div>
      ),
    },
    {
      key: 'notes',
      node: (
        <div className="p-4" style={CARD}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: INDIGO }}>
              📚 Bilan des Notes &amp; Évaluations
            </p>
            <span className="rounded-full px-3 py-1 text-[9.5px] font-semibold" style={{ background: '#EDEBFB', color: INDIGO }}>
              {evaluationType}
            </span>
          </div>
          {notesRows.length === 0 ? (
            <ReportEmptyStateBox>Aucune note enregistrée sur la période.</ReportEmptyStateBox>
          ) : (
            <div className="flex flex-col gap-3">
              {notesRows.map((row) => {
                const moyenne = row.moyenne ?? 0
                const color = SUBJECT_HEX[colorForSubject(row.subject)]
                const elevePct = Math.min((moyenne / scale) * 100, 100)
                const classePct = row.classeAverage !== null ? Math.min((row.classeAverage / scale) * 100, 100) : null
                return (
                  <div key={row.subject}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                        {row.subject} <span className="font-normal" style={{ color: MUTED }}>· coeff {row.coef}</span>
                      </span>
                      <span className="font-bold">{moyenne.toFixed(1)}</span>
                    </div>
                    <div className="relative h-2.5 rounded-full" style={{ background: '#EDECEB' }}>
                      <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${elevePct}%`, background: color }} />
                      {classePct !== null && (
                        <div className="absolute -top-[3px] h-4 w-[2px]" style={{ left: `${classePct}%`, background: '#4D4F54' }} />
                      )}
                    </div>
                    <div className="mt-0.5 flex justify-between text-[9px]" style={{ color: MUTED }}>
                      <span>Élève : {moyenne.toFixed(1)}/{scale}</span>
                      <span>Classe : {classePct !== null ? `${(row.classeAverage as number).toFixed(1)}/${scale}` : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'heures-manquees',
      node: (
        <div className="p-3.5" style={CARD}>
          <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: RED }}>
            📉 Heures Manquées par Matière
          </p>
          {heuresParMatiere.length === 0 ? (
            <p className="text-center text-[10px] italic" style={{ color: MUTED }}>
              Aucune heure manquée sur la période.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {heuresParMatiere.map((row) => (
                <div key={row.subject} className="items-center gap-2" style={{ display: 'grid', gridTemplateColumns: '110px 1fr 44px' }}>
                  <div className="text-[10px] font-semibold">{row.subject}</div>
                  <div className="h-2.5 rounded-full" style={{ background: '#FBE4E2' }}>
                    <div className="h-full rounded-full" style={{ width: `${row.barPct}%`, background: RED }} />
                  </div>
                  <div className="text-right text-[10px] font-bold" style={{ color: RED }}>
                    {row.total}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'absences',
      node: (
        <div className="p-3.5" style={CARD}>
          <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: RED }}>
            ⏱️ Historique des Absences et Retards
          </p>
          {view.events.length === 0 ? (
            <ReportEmptyStateBox>Aucun événement sur la période sélectionnée.</ReportEmptyStateBox>
          ) : (
            <>
              <div
                className="border-b pb-1.5 text-[8.5px] uppercase tracking-[0.03em]"
                style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 1.3fr 0.9fr 1fr 0.9fr', borderColor: BORDER, color: MUTED }}
              >
                <div>Date</div>
                <div>Type</div>
                <div>Matière</div>
                <div>Durée</div>
                <div>Motif</div>
                <div>Justif.</div>
              </div>
              {view.events.map((e, idx) => (
                <div
                  key={idx}
                  className="items-center border-b py-1.5 text-[9.5px]"
                  style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 1.3fr 0.9fr 1fr 0.9fr', borderColor: '#F0EFEE' }}
                >
                  <div style={{ color: '#6E7075' }}>{e.date}</div>
                  <div>
                    <span
                      className="w-fit rounded-full px-1.5 py-0.5 text-[8.5px] font-bold"
                      style={{ background: e.type === 'ABSENCE' ? '#FBE4E2' : '#FBEDD6', color: e.type === 'ABSENCE' ? RED : AMBER }}
                    >
                      {e.type}
                    </span>
                  </div>
                  <div>{e.subject}</div>
                  <div>{e.duree}</div>
                  <div style={{ color: MUTED }}>{e.motif}</div>
                  <div className="text-[8.5px] font-bold" style={{ color: e.justified ? '#1F9D6B' : RED }}>
                    {e.justified ? 'JUSTIFIÉ' : 'INJUSTIFIÉ'}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'discipline',
      node: (
        <div className="p-3.5" style={CARD}>
          <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: TEAL }}>
            ⚖️ Historique Disciplinaire &amp; Conduite
          </p>
          {view.discipline.length === 0 ? (
            <ReportEmptyStateBox>Aucun fait disciplinaire sur la période sélectionnée.</ReportEmptyStateBox>
          ) : (
            <>
              <div
                className="border-b pb-1.5 text-[8.5px] uppercase tracking-[0.03em]"
                style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 1.6fr 0.6fr 1.4fr 1.2fr', borderColor: BORDER, color: MUTED }}
              >
                <div>Date</div>
                <div>Nature</div>
                <div>Fait</div>
                <div>Points</div>
                <div>Commentaire</div>
                <div>Enseignant</div>
              </div>
              {view.discipline.map((d, idx) => {
                const isIncident = d.points < 0
                return (
                  <div
                    key={idx}
                    className="items-center border-b py-1.5 text-[9.5px]"
                    style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 1.6fr 0.6fr 1.4fr 1.2fr', borderColor: '#F0EFEE' }}
                  >
                    <div style={{ color: '#6E7075' }}>{d.date}</div>
                    <div className="text-[8.5px] font-bold" style={{ color: isIncident ? RED : '#1F9D6B' }}>
                      {isIncident ? 'INCIDENT' : 'MÉRITE'}
                    </div>
                    <div className="font-semibold">{d.title}</div>
                    <div className="font-bold" style={{ color: isIncident ? RED : '#1F9D6B' }}>
                      {d.points > 0 ? '+' : ''}
                      {d.points}
                    </div>
                    <div style={{ color: MUTED }}>{d.description}</div>
                    <div style={{ color: MUTED }}>{d.author}</div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'reclamations-rdv',
      node: (
        <div className="p-3.5" style={CARD}>
          <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: '#6E7075' }}>
            📮 Réclamations &amp; Rendez-vous
          </p>
          <div className="flex flex-col gap-3 text-[10.5px]">
            <div>
              <p>
                <span style={{ color: MUTED }}>Réclamations : </span>
                <strong>{view.reclamations.length}</strong>
                {view.reclamations.length > 0 && (
                  <span style={{ color: MUTED }}>
                    {' '}
                    ({view.reclamations.filter((r) => r.statut === 'En cours').length} en cours,{' '}
                    {view.reclamations.filter((r) => r.statut === 'Résolue').length} résolue(s),{' '}
                    {view.reclamations.filter((r) => r.statut === 'En attente').length} en attente)
                  </span>
                )}
              </p>
              {view.reclamations.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {view.reclamations.map((r, idx) => (
                    <div key={idx} className="rounded-lg p-2" style={{ background: '#F7F6F5' }}>
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="font-semibold">
                          {r.date} · {r.type} — {r.objet}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[8.5px] font-bold"
                          style={{
                            background: r.statut === 'Résolue' ? '#DCF3E7' : r.statut === 'En cours' ? '#FBEDD6' : '#F0EFEE',
                            color: r.statut === 'Résolue' ? '#1F9D6B' : r.statut === 'En cours' ? AMBER : MUTED,
                          }}
                        >
                          {r.statut}
                        </span>
                      </div>
                      {r.description && (
                        <p className="mt-1 text-[9px]" style={{ color: MUTED }}>
                          {r.description}
                        </p>
                      )}
                      {r.resolution && (
                        <p className="mt-0.5 text-[9px]" style={{ color: '#4B4D53' }}>
                          <span style={{ color: MUTED }}>Résolution : </span>
                          {r.resolution}
                        </p>
                      )}
                      <p className="mt-0.5 text-[8.5px]" style={{ color: '#94969B' }}>
                        Enseignant : {r.enseignant}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p>
                <span style={{ color: MUTED }}>Rendez-vous : </span>
                <strong>{view.rendezVous.length}</strong>
                {view.rendezVous.length > 0 && (
                  <span style={{ color: MUTED }}>
                    {' '}
                    ({view.rendezVous.filter((r) => r.statut === 'Planifié').length} planifié(s),{' '}
                    {view.rendezVous.filter((r) => r.statut === 'Réalisé').length} réalisé(s),{' '}
                    {view.rendezVous.filter((r) => r.statut === 'Annulé').length} annulé(s))
                  </span>
                )}
              </p>
              {view.rendezVous.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {view.rendezVous.map((r, idx) => (
                    <div key={idx} className="rounded-lg p-2" style={{ background: '#F7F6F5' }}>
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="font-bold">{r.motif}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[8.5px] font-bold"
                          style={{
                            background: r.statut === 'Réalisé' ? '#DCF3E7' : r.statut === 'Planifié' ? '#DCEEEC' : '#F0EFEE',
                            color: r.statut === 'Réalisé' ? '#1F9D6B' : r.statut === 'Planifié' ? TEAL : MUTED,
                          }}
                        >
                          {r.statut}
                        </span>
                      </div>
                      <p className="mt-1 text-[9px]" style={{ color: MUTED }}>
                        Date : {r.date} à {r.heure} ({r.duree} min) · {r.mode} ({r.lieu})
                      </p>
                      {r.notesParents && (
                        <p className="mt-1 border-l-2 pl-2 text-[9px] italic" style={{ borderColor: '#D9D6D3', color: '#4B4D53' }}>
                          « {r.notesParents} »
                        </p>
                      )}
                      {r.compteRendu && (
                        <div className="mt-1.5 rounded-md p-2" style={{ background: '#FFFFFF', border: `1px solid ${BORDER}` }}>
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                            <p className="text-[8.5px] font-bold" style={{ color: '#4B4D53' }}>
                              📄 Compte-rendu
                            </p>
                            <div className="flex items-center gap-1">
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                                style={{ background: '#DCF3E7', color: '#1F9D6B' }}
                              >
                                Rédigé par {r.compteRendu.redacteur}
                              </span>
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                                style={{
                                  background: r.compteRendu.signeParent ? '#FBEDD6' : '#F0EFEE',
                                  color: r.compteRendu.signeParent ? AMBER : MUTED,
                                }}
                              >
                                {r.compteRendu.signeParent ? 'Signé par le parent' : 'En attente de signature'}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[8px] font-bold uppercase" style={{ color: '#8B5FBF' }}>
                                Administration
                              </p>
                              <p className="text-[8.5px]" style={{ color: '#4B4D53' }}>
                                {r.compteRendu.administration || '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-bold uppercase" style={{ color: '#C0508A' }}>
                                Parents
                              </p>
                              <p className="text-[8.5px]" style={{ color: '#4B4D53' }}>
                                {r.compteRendu.parents || '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-bold uppercase" style={{ color: '#1F9D6B' }}>
                                Enseignant
                              </p>
                              <p className="text-[8.5px]" style={{ color: '#4B4D53' }}>
                                {r.compteRendu.enseignant || '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="mt-1 text-[8.5px]" style={{ color: '#94969B' }}>
                        Enseignant : {r.enseignant}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <PaginatedPrintDocument
      blocks={blocks}
      paddingXPx={PADDING_X}
      paddingYPx={PADDING_Y}
      gapPx={GAP}
      pageStyle={{ background: PAGE_BG, color: INK, fontFamily: PAGE_FONT }}
      renderHeader={(pageIndex) => (
        <header className="flex items-baseline justify-between border-b pb-2.5" style={{ borderColor: '#D9D8D6' }}>
          <div>
            <p className="text-[14px] font-bold">Suivi Pédagogique et Disciplinaire{pageIndex > 0 ? ' — suite' : ''}</p>
            <p className="text-[10px]" style={{ color: MUTED }}>
              {student.name} — Classe {student.classe}
            </p>
          </div>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </header>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <div className="border-t pt-1.5 text-[8.5px]" style={{ borderColor: '#EBEAE9', color: '#A6A8AC' }}>
          <div className="flex justify-between">
            <span>Groupe Scolaire Mondrian — Suivi pédagogique et disciplinaire</span>
            <span>
              Page {pageIndex + 1} / {pageCount}
            </span>
          </div>
          <div className="mt-0.5 font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
        </div>
      )}
    />
  )
}
