import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CalendarPlus, FileText, Plus } from 'lucide-react'
import PlanifierRdvModal, { rdvFieldsFromPayload, type PlanifierRdvPayload } from '../PlanifierRdvModal'
import PartagerRdvModal from '../PartagerRdvModal'
import type { RendezVousRecord } from '../../data/studentDetails'
import { getStudentsSnapshot } from '../../services/studentsService'
import { getStudentExtraSnapshot, updateStudentRendezVous } from '../../services/studentDetailsService'
import { addDaysISO, formatDateFR } from '../../utils/reclamationsLogic'
import { buildRdvMessage } from '../../utils/whatsapp'
import type { OpenReclamation, RiskStudent } from '../../utils/suiviClasseRisqueAggregation'
import {
  STATUT_RDV_LABELS,
  compterParStatut,
  famillesAContacter,
  filtrerRendezVous,
  statutRdv,
  type FamilleAContacter,
  type RdvLigne,
  type StatutRdv,
} from '../../utils/suiviClasseRdv'

type Periode = 'reunion' | '30j' | 'annee'
type FiltreStatut = StatutRdv | 'tous'

const PERIODES: { key: Periode; label: string }[] = [
  { key: 'reunion', label: 'Depuis la dernière réunion' },
  { key: '30j', label: '30 derniers jours' },
  { key: 'annee', label: "Toute l'année" },
]

const STATUT_PILL: Record<StatutRdv, string> = {
  a_venir: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  a_cloturer: 'bg-amber-50 text-amber-700 ring-amber-200',
  tenu: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  annule: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition ${
    active ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
  }`

interface FamillesPanelProps {
  /** Classes du niveau : limitent le choix de l'élève quand on programme un rendez-vous. */
  classeNames: string[]
  rendezVous: RdvLigne[]
  riskStudents: RiskStudent[]
  reclamations: OpenReclamation[]
  /** Date (AAAA-MM-JJ) de la réunion précédente du niveau, ou à défaut aujourd'hui moins 30 jours. */
  depuisReunion: string
  today: string
  isEditable: boolean
}

function ContactLine({ famille }: { famille: FamilleAContacter }) {
  if (famille.prochain) {
    const r = famille.prochain.record
    return <p className="text-xs font-semibold text-emerald-700">{`Prochain rendez-vous le ${formatDateFR(r.date)} à ${r.heure}`}</p>
  }
  if (famille.dernier) {
    return <p className="text-xs text-slate-500">{`Dernier rendez-vous le ${formatDateFR(famille.dernier.record.date)} (tenu)`}</p>
  }
  return <p className="text-xs font-semibold text-amber-600">Jamais reçu(e) cette année</p>
}

function RdvRow({ ligne, today }: { ligne: RdvLigne; today: string }) {
  const r = ligne.record
  const statut = statutRdv(r, today)
  const avec = [...r.enseignants, ...(r.animateur ? [r.animateur] : [])]
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${STATUT_PILL[statut]}`}>{STATUT_RDV_LABELS[statut]}</span>
          <span className="text-sm font-semibold text-slate-800">{ligne.studentName}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{ligne.classe}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {`${formatDateFR(r.date)} · ${r.heure} · ${r.duree} min · ${r.mode === 'Virtuel' ? 'Visioconférence' : 'Présentiel'}`}
        </p>
        <p className="mt-0.5 text-sm text-slate-700">{r.motif}</p>
        <p className="mt-0.5 text-xs text-slate-400">{avec.length > 0 ? `Avec : ${avec.join(', ')}` : 'Rencontre avec l’administration'}</p>
      </div>
      {statut === 'tenu' && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            r.compteRendu ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          <FileText className="h-3 w-3" />
          {r.compteRendu ? 'C.R. rédigé' : 'C.R. à rédiger'}
        </span>
      )}
    </div>
  )
}

/** Point 6 de la réunion de suivi : familles à rencontrer, rendez-vous parents du niveau et programmation d'un rendez-vous. */
export default function FamillesPanel({ classeNames, rendezVous, riskStudents, reclamations, depuisReunion, today, isEditable }: FamillesPanelProps) {
  const queryClient = useQueryClient()
  const [periode, setPeriode] = useState<Periode>('reunion')
  const [statut, setStatut] = useState<FiltreStatut>('tous')
  const [planifier, setPlanifier] = useState<{ studentId?: string; motif?: string } | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const depuis = periode === 'reunion' ? depuisReunion : periode === '30j' ? addDaysISO(today, -30) : null
  const dansPeriode = filtrerRendezVous(rendezVous, { depuis, statut: 'tous' }, today)
  const counts = compterParStatut(dansPeriode, today)
  const affiches = statut === 'tous' ? dansPeriode : filtrerRendezVous(rendezVous, { depuis, statut }, today)
  const familles = famillesAContacter(riskStudents, reclamations, rendezVous, today)

  const filtres: { key: FiltreStatut; label: string; count: number }[] = [
    { key: 'tous', label: 'Tous', count: dansPeriode.length },
    { key: 'a_venir', label: 'À venir', count: counts.a_venir },
    ...(counts.a_cloturer > 0 || statut === 'a_cloturer' ? [{ key: 'a_cloturer' as const, label: 'À clôturer', count: counts.a_cloturer }] : []),
    { key: 'tenu', label: 'Tenus', count: counts.tenu },
    { key: 'annule', label: 'Annulés', count: counts.annule },
  ]

  const handleCreate = async (payload: PlanifierRdvPayload) => {
    setErreur(null)
    try {
      const record: RendezVousRecord = { ...rdvFieldsFromPayload(payload), statut: 'Planifié' }
      await updateStudentRendezVous(payload.studentId, [record, ...getStudentExtraSnapshot(payload.studentId).rendezVous])
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      const student = getStudentsSnapshot().find((s) => s.id === payload.studentId)
      setShareMessage(buildRdvMessage({ studentName: student?.name ?? '', classe: student?.classe ?? '', record }))
      setPlanifier(null)
    } catch (e) {
      setErreur(`Le rendez-vous n’a pas pu être enregistré : ${(e as Error).message}`)
    }
  }

  const motifDepuisRaisons = (f: FamilleAContacter) => {
    const motif = `Suivi : ${f.raisons.join(' ; ')}`
    return motif.length > 140 ? `${motif.slice(0, 137)}…` : motif
  }

  return (
    <div className="mb-5 flex flex-col gap-5">
      {erreur && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erreur}</p>}

      <section>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{`Familles à contacter (${familles.length})`}</p>
        {familles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
            Aucun élève à suivre ni réclamation ouverte dans ce niveau.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {familles.map((f) => (
              <div key={f.studentId} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{f.studentName}</span>
                    <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{f.classe}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {f.raisons.map((raison, i) => (
                      <span key={i} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200">
                        {raison}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5">
                    <ContactLine famille={f} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanifier({ studentId: f.studentId, motif: motifDepuisRaisons(f) })}
                  disabled={!isEditable}
                  title={isEditable ? undefined : 'Année en lecture seule'}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                    f.prochain ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'bg-indigo-500 text-white hover:bg-indigo-600'
                  }`}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {f.prochain ? 'Programmer un autre' : 'Programmer'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{`Rendez-vous parents du niveau (${dansPeriode.length})`}</p>
          <button
            type="button"
            onClick={() => setPlanifier({})}
            disabled={!isEditable}
            title={isEditable ? undefined : 'Année en lecture seule'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau rendez-vous
          </button>
        </div>

        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {PERIODES.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriode(p.key)} className={chipClass(periode === p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {filtres.map((f) => (
            <button key={f.key} type="button" onClick={() => setStatut(f.key)} className={chipClass(statut === f.key)}>
              {`${f.label} (${f.count})`}
            </button>
          ))}
        </div>
        <p className="mb-2 text-[11px] text-slate-400">
          {depuis ? `Rendez-vous passés depuis le ${formatDateFR(depuis)}` : 'Tous les rendez-vous de l’année'} · les rendez-vous à venir sont toujours affichés.
        </p>

        {affiches.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
            <CalendarCheck className="h-4 w-4" />
            Aucun rendez-vous pour ce filtre.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {affiches.map((l, i) => (
              <RdvRow key={`${l.studentId}-${l.record.date}-${l.record.heure}-${i}`} ligne={l} today={today} />
            ))}
          </div>
        )}
      </section>

      {planifier && (
        <PlanifierRdvModal
          fixedStudentId={planifier.studentId}
          prefillMotif={planifier.motif}
          classes={classeNames}
          onClose={() => setPlanifier(null)}
          onSubmit={handleCreate}
        />
      )}
      {shareMessage && <PartagerRdvModal message={shareMessage} justCreated onClose={() => setShareMessage(null)} />}
    </div>
  )
}
