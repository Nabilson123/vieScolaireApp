import { useEffect, useState } from 'react'
import {
  History,
  ArrowLeft,
  Loader2,
  ChevronRight,
  Shield,
  Activity,
  NotebookPen,
  BellOff,
  UtensilsCrossed,
  Target,
  MessageSquareWarning,
  CalendarClock,
  IdCard,
} from 'lucide-react'
import type { Student } from '../../data/students'
import { fetchStudentDossierHistory } from '../../services/studentsService'
import { getAnneesScolairesSnapshot } from '../../services/anneesScolairesService'
import { getStudentExtraSnapshot } from '../../services/studentDetailsService'
import { getStudentIdentitySnapshot } from '../../services/studentIdentityService'
import { computeMoyenneGenerale, computeSubjectMoyenne } from '../../utils/studentAggregation'

interface HistoriqueTabProps {
  dossierId?: string
  currentStudentId: string
}

interface HistoryYear {
  student: Student
  libelle: string
  anneeDebut: number
}

export default function HistoriqueTab({ dossierId, currentStudentId }: HistoriqueTabProps) {
  const [years, setYears] = useState<HistoryYear[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<HistoryYear | null>(null)

  useEffect(() => {
    if (!dossierId) {
      setYears([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchStudentDossierHistory(dossierId)
      .then((rows) => {
        if (cancelled) return
        const annees = getAnneesScolairesSnapshot()
        const list = rows
          .filter((s) => s.id !== currentStudentId)
          .map((s) => {
            const annee = annees.find((a) => a.id === s.anneeScolaireId)
            return { student: s, libelle: annee?.libelle ?? '—', anneeDebut: annee?.anneeDebut ?? 0 }
          })
          .sort((a, b) => b.anneeDebut - a.anneeDebut)
        setYears(list)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Erreur de chargement.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [dossierId, currentStudentId])

  if (loading || years === null) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-10 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement de l'historique…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
        Impossible de charger l'historique : {error}
      </div>
    )
  }

  if (selected) {
    return <HistoryYearDetail year={selected} onBack={() => setSelected(null)} />
  }

  if (years.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
        <History className="mx-auto mb-2 h-6 w-6 text-slate-300" />
        Aucune fiche antérieure trouvée pour cet élève. L'historique se construit automatiquement à
        la réinscription (rapprochement par code Massar).
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800">Fiches des années précédentes</h3>
      </div>
      <div className="space-y-2">
        {years.map((y) => (
          <button
            key={y.student.id}
            type="button"
            onClick={() => setSelected(y)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">Année {y.libelle}</p>
              <p className="text-xs text-slate-500">
                Classe {y.student.classe} · Taux de présence {y.student.taux.toFixed(1)}%
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  )
}

function HistoryYearDetail({ year, onBack }: { year: HistoryYear; onBack: () => void }) {
  const { student, libelle } = year
  const extra = getStudentExtraSnapshot(student.id)
  const identity = getStudentIdentitySnapshot(student.id)
  const allSubjects = Array.from(new Set(extra.notes.map((n) => n.subject)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Toutes les années
        </button>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
          Année {libelle} — Lecture seule
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Classe" value={student.classe} />
        <StatChip label="Taux de présence" value={`${student.taux.toFixed(1)}%`} />
        <StatChip label="Note de conduite" value={`${extra.conduite}/20`} />
        <StatChip label="Moyenne générale" value={`${extra.moyenne}/20`} />
      </div>

      <Section icon={IdCard} title="Informations générales">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <InfoRow label="Code Massar" value={identity.codeMassar || '—'} />
          <InfoRow label="Date de naissance" value={identity.dateNaissance || '—'} />
          <InfoRow label="Date d'entrée" value={identity.dateEntree || '—'} />
          <InfoRow label="Parent 1" value={[identity.parent1Prenom, identity.parent1Nom].filter(Boolean).join(' ') || '—'} />
          <InfoRow label="Tél. parent 1" value={identity.parent1Tel || '—'} />
          <InfoRow label="Parent 2" value={[identity.parent2Prenom, identity.parent2Nom].filter(Boolean).join(' ') || '—'} />
        </div>
      </Section>

      <Section icon={NotebookPen} title={`Notes (${extra.notes.length} matière${extra.notes.length > 1 ? 's' : ''})`}>
        {extra.notes.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-2">Matière</th>
                <th className="py-1.5 pr-2">Coef.</th>
                <th className="py-1.5">Moyenne</th>
              </tr>
            </thead>
            <tbody>
              {extra.notes.map((n) => (
                <tr key={n.subject} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5 pr-2 font-medium text-slate-700">{n.subject}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{n.coef}</td>
                  <td className="py-1.5 font-semibold text-indigo-600">{computeSubjectMoyenne(n)?.toFixed(2) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {allSubjects.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Moyenne générale calculée : <span className="font-semibold text-slate-700">{computeMoyenneGenerale(extra.notes)?.toFixed(2) ?? '—'}/20</span>
          </p>
        )}
      </Section>

      <Section icon={BellOff} title={`Absences & Retards (${extra.events.length})`}>
        {extra.events.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5">
            {extra.events.map((e, idx) => (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span>
                  <span className="font-semibold text-slate-700">{e.date}</span> · {e.type === 'ABSENCE' ? 'Absence' : 'Retard'} · {e.subject} · {e.duree}
                </span>
                <span className={e.justified ? 'font-semibold text-emerald-600' : 'font-semibold text-slate-400'}>
                  {e.justified ? 'Justifié' : 'Injustifié'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Shield} title={`Discipline (${extra.discipline.length})`}>
        {extra.discipline.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5">
            {extra.discipline.map((d, idx) => (
              <li key={idx} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">
                    {d.date} · {d.title}
                  </span>
                  <span className={d.points >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-500'}>
                    {d.points >= 0 ? '+' : ''}
                    {d.points}
                  </span>
                </div>
                <p className="text-slate-500">{d.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Activity} title="Santé & Infirmerie">
        {extra.sante.pai && (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <span className="font-semibold">PAI ({extra.sante.pai.niveau}) :</span> {extra.sante.pai.condition}
          </div>
        )}
        {extra.sante.visits.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5">
            {extra.sante.visits.map((v, idx) => (
              <li key={idx} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span className="font-semibold text-slate-700">
                  {v.date} {v.heure}
                </span>{' '}
                · {v.motif} · {v.action}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={UtensilsCrossed} title="Garde Repas / Cantine">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <InfoRow label="Formule" value={extra.cantine.formuleLunchbox || '—'} />
          <InfoRow label="Modalité de sortie" value={extra.cantine.modaliteSortie || '—'} />
          <InfoRow label="Décharge signée" value={extra.cantine.dechargeSignee ? 'Oui' : 'Non'} />
        </div>
      </Section>

      <Section icon={Target} title="Projet Personnel">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <InfoRow label="Filière visée" value={extra.projet.filiereVisee || '—'} />
          <InfoRow label="Rang" value={extra.projet.rang || '—'} />
          <InfoRow label="Progression" value={`${extra.projet.progressionPct}%`} />
        </div>
      </Section>

      <Section icon={MessageSquareWarning} title={`Réclamations (${extra.reclamations.length})`}>
        {extra.reclamations.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5">
            {extra.reclamations.map((r, idx) => (
              <li key={idx} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span className="font-semibold text-slate-700">
                  {r.date} · {r.type}
                </span>{' '}
                — {r.objet} <span className="text-slate-400">({r.statut})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={CalendarClock} title={`Rendez-vous (${extra.rendezVous.length})`}>
        {extra.rendezVous.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5">
            {extra.rendezVous.map((r, idx) => (
              <li key={idx} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span className="font-semibold text-slate-700">
                  {r.date} {r.heure}
                </span>{' '}
                · {r.motif} avec {r.enseignants.length > 0 ? r.enseignants.join(', ') : "l'administration"} <span className="text-slate-400">({r.statut})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm">
      <p className="text-sm font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof History; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value}</p>
    </div>
  )
}

function Empty() {
  return <p className="py-3 text-center text-xs text-slate-400">Aucune donnée pour cette année.</p>
}
