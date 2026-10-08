import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Megaphone, Pause, Play, Printer, RotateCcw, Save, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useClasses } from '../../services/classesService'
import { getTeachersSnapshot } from '../../services/teachersService'
import { teacherName } from '../../data/teachers'
import type { SuiviProf } from '../../data/suiviProfs'
import { aUneZoneCommune, listeClasses, passerEnCommun, pointParClasseRempli, texteIdentiqueAToutesLesClasses, type PointParClasse, type SuiviCompteRendu } from '../../data/suiviCompteRendu'
import { useSuiviProfs, useSaveCompteRendu, useValidateCompteRendu } from '../../services/suiviProfsService'
import { computeLogicalGroups, type LogicalGroup } from '../../utils/suiviClasseGroups'
import {
  computeAtRiskStudentsForNiveaux,
  computeAllReclamationsForNiveaux,
  getReclamationNote,
  reclamationNoteKey,
  type OpenReclamation,
} from '../../utils/suiviClasseRisqueAggregation'
import { useAlertRules } from '../../services/alertRulesService'
import { useCurrentProfile } from '../../services/permissions'
import { markReclamationTraitee } from '../../services/studentDetailsService'
import { SUIVI_CLASSE_ACTION_STATUT_LABELS, type SuiviClasseAction, type SuiviClasseActionStatut } from '../../data/suiviClasseActions'
import { useSuiviClasseActions, useAddSuiviClasseAction, useUpdateSuiviClasseActionStatut } from '../../services/suiviClasseActionsService'
import { weekdayLabelFromDate } from './SuiviClasseTab'
import { minutesToTime, timeToMinutes } from '../../data/classSchedules'
import SuiviReunionPrintPreviewModal from './SuiviReunionPrintPreviewModal'
import PrintableCompteRenduReunion from './PrintableCompteRenduReunion'
import AutoGrowTextarea from '../AutoGrowTextarea'
import FamillesPanel from './FamillesPanel'
import AssiduitePanel from './AssiduitePanel'
import InscrireSoutienModal from '../soutien/InscrireSoutienModal'
import { useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { libelleCreneau } from '../../utils/soutienSeances'
import { useMeetingTimer } from '../../hooks/useMeetingTimer'
import { formatClock, statutTemps, type TempsStatut } from '../../utils/meetingTimer'
import { computeAssiduiteParClasse, elevesPlusSignales, reunionPrecedente, suiviPrecedent } from '../../utils/suiviClasseReunion'
import { useStudents } from '../../services/studentsService'
import { useStudentExtras } from '../../services/studentDetailsService'
import { todayLocalISO } from '../../utils/reclamationsLogic'
import { collectRendezVous, filtrerRendezVous, periodeDepuis, statutRdv } from '../../utils/suiviClasseRdv'

interface SuiviReunionTabProps {
  initialNiveau?: string
  initialSuiviId?: string
  isEditable: boolean
}

interface PointMeta {
  n: number
  title: string
  minutes: number
  guide: string[]
}

const POINTS: PointMeta[] = [
  {
    n: 1,
    title: 'Retour sur les actions précédentes',
    minutes: 3,
    guide: [
      'Chaque action décidée : faite, en cours, à relancer ?',
      'Parents contactés : réponse obtenue, rendez-vous fixé ?',
      'Effet des mesures prises (tutorat, changement de place, contrat de comportement).',
    ],
  },
  {
    n: 2,
    title: 'Avancement pédagogique',
    minutes: 5,
    guide: ['Progression par rapport à la programmation prévue.', "Difficultés rencontrées par les élèves ou l'enseignant.", 'Évaluations à venir, ajustements nécessaires.'],
  },
  {
    n: 3,
    title: 'Élèves à suivre',
    minutes: 7,
    guide: ['Élèves remontés automatiquement : constat partagé, mesure décidée.', 'Autres élèves à signaler (progrès notables, nouvelles difficultés).', "Qui fait quoi, et d'ici quand ?"],
  },
  {
    n: 4,
    title: 'Assiduité & comportement',
    minutes: 4,
    guide: ['Absences ou retards répétés à signaler.', 'Incidents disciplinaires récents et suite donnée.', 'Climat général de la classe.'],
  },
  {
    n: 5,
    title: 'Traitement des réclamations',
    minutes: 4,
    guide: ["Faits vérifiés auprès de l'enseignant concerné.", 'Réponse à apporter à la famille, délai.', 'Réclamation classée « Traitée » une fois la réponse actée.'],
  },
  {
    n: 6,
    title: 'Relation avec les familles',
    minutes: 3,
    guide: ['Parents à recontacter, rendez-vous à programmer.', 'Informations à communiquer à l’ensemble des familles.'],
  },
  {
    n: 7,
    title: 'Vie de classe & organisation',
    minutes: 2,
    guide: ['Organisation matérielle (salle, matériel, sorties).', 'Événements ou projets de classe à venir.'],
  },
  {
    n: 8,
    title: 'Décisions & actions',
    minutes: 2,
    guide: ['Une action = un texte clair, un responsable, une échéance.', 'Reprendre les décisions prises aux points précédents.'],
  },
]

function resolveRelevantSuivi(niveau: string, suivis: SuiviProf[], initialSuiviId?: string): SuiviProf | undefined {
  if (initialSuiviId) {
    const exact = suivis.find((sp) => sp.id === initialSuiviId && sp.niveau === niveau)
    if (exact) return exact
  }
  const todayIso = new Date().toISOString().slice(0, 10)
  const forNiveau = suivis.filter((sp) => sp.niveau === niveau && sp.statut !== 'Annulé')
  const upcoming = forNiveau.filter((sp) => sp.date >= todayIso).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (upcoming.length > 0) return upcoming[0]
  const past = forNiveau.filter((sp) => sp.date < todayIso).sort((a, b) => (a.date > b.date ? -1 : 1))
  return past[0]
}

/** Enregistrement automatique du brouillon après ce délai sans nouvelle saisie. */
const AUTOSAVE_DELAY_MS = 4000

const TOTAL_PLANNED_MINUTES = POINTS.reduce((sum, p) => sum + p.minutes, 0)

const TEMPS_COLOR: Record<TempsStatut, string> = { ok: 'text-slate-500', proche: 'text-amber-600', depasse: 'text-rose-600' }

function MeetingTimerChip({ running, total, onToggle, onReset }: { running: boolean; total: number; onToggle: () => void; onReset: () => void }) {
  const statut = statutTemps(total, TOTAL_PLANNED_MINUTES)
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5">
      <button
        type="button"
        onClick={onToggle}
        title={running ? 'Mettre le chrono en pause' : total > 0 ? 'Reprendre le chrono' : 'Démarrer la réunion'}
        className={`flex h-6 w-6 items-center justify-center rounded-md ${running ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <span className={`text-xs font-semibold tabular-nums ${TEMPS_COLOR[statut]}`}>
        {formatClock(total)} / {TOTAL_PLANNED_MINUTES}:00
      </span>
      {total > 0 && !running && (
        <button type="button" onClick={onReset} title="Remettre le chrono à zéro" className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600">
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDDMM(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function pointHasContent(n: number, cr: SuiviCompteRendu, group: LogicalGroup): boolean {
  switch (n) {
    case 1:
      return !!cr.point1Commentaire?.trim()
    case 2:
      return pointParClasseRempli(cr, 'point2', group.divisions.map((d) => d.classe.nom))
    case 3:
      return !!cr.point3Extra?.trim() || !!(cr.point3 && Object.values(cr.point3).some((e) => e.constat.trim() || e.mesure.trim()))
    case 4:
      return pointParClasseRempli(cr, 'point4', group.divisions.map((d) => d.classe.nom))
    case 5:
      return !!(cr.point5 && Object.values(cr.point5).some((e) => e.faits.trim() || e.reponse.trim()))
    case 6:
      return !!cr.point6?.trim()
    case 7:
      return !!cr.point7?.trim()
    default:
      return false
  }
}

const textareaClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400'

const STATUT_PILL_ACTIVE: Record<SuiviClasseActionStatut, string> = {
  a_faire: 'border-slate-400 bg-slate-400 text-white',
  en_cours: 'border-amber-500 bg-amber-500 text-white',
  a_relancer: 'border-rose-500 bg-rose-500 text-white',
  faite: 'border-emerald-500 bg-emerald-500 text-white',
}

function ActionsList({ actions, isEditable, onSetStatut }: { actions: SuiviClasseAction[]; isEditable: boolean; onSetStatut: (id: string, statut: SuiviClasseActionStatut) => void }) {
  const todayIso = new Date().toISOString().slice(0, 10)
  if (actions.length === 0) return <p className="text-xs text-slate-400">Aucune action enregistrée pour ce niveau.</p>
  return (
    <div className="flex flex-col gap-1.5">
      {actions.map((a) => {
        const overdue = a.statut !== 'faite' && a.echeance && a.echeance < todayIso
        return (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${a.statut === 'faite' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{a.texte}</p>
              <p className={`text-xs ${overdue ? 'text-rose-500' : 'text-slate-500'}`}>
                {a.ownerName}
                {a.echeance && ` · ${new Date(a.echeance + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {(['faite', 'en_cours', 'a_relancer'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSetStatut(a.id, s)}
                  disabled={!isEditable}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed ${
                    a.statut === s ? STATUT_PILL_ACTIVE[s] : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {SUIVI_CLASSE_ACTION_STATUT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SuiviReunionTab({ initialNiveau, initialSuiviId, isEditable }: SuiviReunionTabProps) {
  const queryClient = useQueryClient()
  const { data: classes = [] } = useClasses()
  const { data: suivis = [] } = useSuiviProfs()
  const { data: actions = [] } = useSuiviClasseActions()
  const { data: alertRules } = useAlertRules()
  const { data: students = [] } = useStudents()
  const { data: studentExtras = {} } = useStudentExtras()
  const profile = useCurrentProfile()
  const allTeachers = getTeachersSnapshot()

  const saveMutation = useSaveCompteRendu()
  const validateMutation = useValidateCompteRendu()
  const addActionMutation = useAddSuiviClasseAction()
  const setStatutMutation = useUpdateSuiviClasseActionStatut()

  const logicalGroups: LogicalGroup[] = computeLogicalGroups(classes, allTeachers)
  const directionName = profile?.nomComplet || profile?.email || 'Direction de la vie scolaire'

  const [selectedNiveau, setSelectedNiveau] = useState<string>(initialNiveau ?? logicalGroups[0]?.key ?? '')
  useEffect(() => {
    if (initialNiveau) setSelectedNiveau(initialNiveau)
  }, [initialNiveau])

  const group = logicalGroups.find((g) => g.key === selectedNiveau) ?? logicalGroups[0]
  const suivi = group ? resolveRelevantSuivi(group.key, suivis, initialSuiviId) : undefined

  const initialCr = (sp?: SuiviProf): SuiviCompteRendu => sp?.compteRendu ?? { redigePar: directionName }
  const [cr, setCr] = useState<SuiviCompteRendu>(() => initialCr(suivi))
  // Dernier contenu connu côté serveur : tout ce qui en diffère est « non enregistré ».
  const [baselineJson, setBaselineJson] = useState(() => JSON.stringify(initialCr(suivi)))
  useEffect(() => {
    const next = initialCr(suivi)
    setCr(next)
    setBaselineJson(JSON.stringify(next))
    setCurrentPoint(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivi?.id, group?.key])

  const [currentPoint, setCurrentPoint] = useState(1)
  const [viewMode, setViewMode] = useState<'wizard' | 'recap'>('wizard')
  const [showPrint, setShowPrint] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState<'validated' | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Chrono de la réunion : une nouvelle réunion repart de zéro.
  const timer = useMeetingTimer(currentPoint)
  useEffect(() => {
    timer.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivi?.id, group?.key])

  const isDirty = !!suivi && JSON.stringify(cr) !== baselineJson
  const persistDraft = (value: SuiviCompteRendu) => {
    if (!suivi) return
    saveMutation.mutate(
      { id: suivi.id, compteRendu: value },
      {
        onSuccess: () => {
          setBaselineJson(JSON.stringify(value))
          setSavedAt(new Date())
        },
      },
    )
  }

  // Enregistrement automatique du brouillon un court instant après la dernière saisie (jamais le statut « Réalisé »).
  useEffect(() => {
    if (!isEditable || !suivi || !isDirty || saveMutation.isPending) return
    const timeout = setTimeout(() => persistDraft(cr), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr, isDirty, isEditable, suivi?.id, saveMutation.isPending])

  // Rien ne se perd en quittant l'onglet ou en changeant de niveau : le brouillon en attente part avant.
  const latest = useRef({ cr, suivi, isDirty, isEditable })
  latest.current = { cr, suivi, isDirty, isEditable }
  useEffect(
    () => () => {
      const l = latest.current
      if (l.isDirty && l.isEditable && l.suivi) saveMutation.mutate({ id: l.suivi.id, compteRendu: l.cr })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  if (!group) {
    return <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">Aucune classe active.</div>
  }

  const niveauActions = actions.filter((a) => a.niveau === group.key)
  const riskStudents = alertRules ? computeAtRiskStudentsForNiveaux(group.niveauxBruts, alertRules) : []
  // Soutien : séances et inscriptions, pour afficher à qui il est déjà proposé et ouvrir l'inscription depuis le point 3.
  const { data: soutienSeances = [] } = useSoutienSeances()
  const { data: soutienInscriptions = [] } = useSoutienInscriptions()
  const [soutienPour, setSoutienPour] = useState<{ id: string; name: string; classe: string } | null>(null)
  // Une réclamation résolue ailleurs (hors de cette réunion) ne doit pas s'inviter ici, mais une
  // réclamation qu'on vient de marquer "Traitée" PENDANT cette réunion (donc déjà présente dans
  // cr.point5) doit rester visible — sinon elle disparaît du compte-rendu sans laisser de trace.
  const reclamations = computeAllReclamationsForNiveaux(group.niveauxBruts).filter((r) => r.statut !== 'Résolue' || !!getReclamationNote(cr.point5, r))
  // Point 6 : rendez-vous avec les parents des élèves du niveau, et période par défaut = depuis la réunion précédente.
  const today = todayLocalISO()
  const classeNames = group.divisions.map((d) => d.classe.nom)
  const rendezVous = collectRendezVous(students, studentExtras, classeNames)
  const depuisReunion = periodeDepuis(suivis, group.key, suivi, today)
  // Point 3 : ce qui avait été écrit pour chaque élève à la réunion précédente.
  const precedente = reunionPrecedente(suivis, group.key, suivi, today)
  const suiviPrev = suiviPrecedent(precedente?.compteRendu)
  const plusSignales = elevesPlusSignales(suiviPrev, riskStudents)
  // Sans rien d'écrit pour les élèves à la réunion précédente, « nouveau » ou « déjà suivi » n'aurait aucun sens.
  const comparerAvecPrecedente = !!precedente && suiviPrev.size > 0
  // Le compte-rendu imprimé reprend la vue par défaut : à venir et tenus depuis la dernière réunion, sans les annulés.
  const rendezVousImprimes = filtrerRendezVous(rendezVous, { depuis: depuisReunion, statut: 'tous' }, today).filter((l) => statutRdv(l.record, today) !== 'annule')
  const owners = [...group.teachers.map(teacherName), directionName]
  const participants = [
    ...group.divisions
      .filter((d) => d.pp)
      .reduce<{ name: string; classes: string[] }[]>((acc, d) => {
        const existing = acc.find((x) => x.name === teacherName(d.pp!))
        if (existing) existing.classes.push(d.classe.nom)
        else acc.push({ name: teacherName(d.pp!), classes: [d.classe.nom] })
        return acc
      }, [])
      .map((p) => ({ name: p.name, role: 'Prof. principal · ' + p.classes.join(', ') })),
    { name: directionName, role: 'Direction de la vie scolaire' },
  ]

  const filledCount = POINTS.filter((p) => pointHasContent(p.n, cr, group)).length

  const whenLabel = suivi
    ? `${weekdayLabelFromDate(suivi.date)} ${formatDDMM(suivi.date)} · ${suivi.heure.slice(0, 5)}–${minutesToTime(timeToMinutes(suivi.heure) + suivi.duree)} · ${suivi.lieu || 'Présentiel'} · ${group.divisions
        .map((d) => d.classe.nom)
        .join(' · ')}`
    : 'Aucun suivi planifié ou passé pour ce niveau.'

  const patch = (p: Partial<SuiviCompteRendu>) => setCr((prev) => ({ ...prev, ...p }))
  const patchRecord = (field: 'point2' | 'point4', key: string, value: string) => setCr((prev) => ({ ...prev, [field]: { ...prev[field], [key]: value } }))
  const patchRisk = (studentId: string, patch: Partial<{ constat: string; mesure: string }>) =>
    setCr((prev) => ({ ...prev, point3: { ...prev.point3, [studentId]: { constat: '', mesure: '', ...prev.point3?.[studentId], ...patch } } }))
  const patchReclamation = (r: OpenReclamation, patch: Partial<{ faits: string; reponse: string }>) =>
    setCr((prev) => ({ ...prev, point5: { ...prev.point5, [reclamationNoteKey(r)]: { faits: '', reponse: '', ...getReclamationNote(prev.point5, r), ...patch } } }))
  const togglePresence = (name: string) =>
    setCr((prev) => {
      const current = prev.presence?.[name] ?? 'present'
      const next: Record<string, 'present' | 'absent' | 'excuse'> = { ...prev.presence }
      next[name] = current === 'present' ? 'absent' : current === 'absent' ? 'excuse' : 'present'
      return { ...prev, presence: next }
    })

  const [newActionTexte, setNewActionTexte] = useState('')
  const [newActionOwner, setNewActionOwner] = useState(directionName)
  const [newActionEcheance, setNewActionEcheance] = useState('')
  const handleAddAction = () => {
    if (!newActionTexte.trim()) return
    addActionMutation.mutate({ niveau: group.key, texte: newActionTexte.trim(), ownerName: newActionOwner, echeance: newActionEcheance || undefined })
    setNewActionTexte('')
    setNewActionEcheance('')
  }

  const [reclamationBusy, setReclamationBusy] = useState<string | null>(null)
  // Marquer une réclamation "Traitée" doit rester vrai même si l'utilisateur quitte cet onglet sans
  // cliquer "Enregistrer le brouillon" juste après — sinon, au rechargement suivant, la réclamation
  // est déjà "Résolue" côté réel mais l'entrée cr.point5 qui la garde visible ici n'a jamais été
  // persistée, et elle disparaît purement et simplement du compte-rendu. On sauvegarde donc le
  // brouillon dans la foulée, pas seulement l'état local.
  const handleMarkTraitee = async (r: OpenReclamation) => {
    const key = reclamationNoteKey(r)
    const reponse = getReclamationNote(cr.point5, r)?.reponse?.trim()
    if (!reponse || !suivi) return
    setReclamationBusy(key)
    try {
      await markReclamationTraitee(r.studentId, r.id, reponse)
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      const updatedCr: SuiviCompteRendu = { ...cr, point5: { ...cr.point5, [key]: { faits: getReclamationNote(cr.point5, r)?.faits ?? '', reponse } } }
      setCr(updatedCr)
      await saveMutation.mutateAsync({ id: suivi.id, compteRendu: updatedCr })
      setBaselineJson(JSON.stringify(updatedCr))
      setSavedAt(new Date())
    } finally {
      setReclamationBusy(null)
    }
  }

  const handleSaveDraft = () => persistDraft(cr)
  const handleValidate = () => {
    if (!suivi) return
    const validated = cr
    validateMutation.mutate(
      { id: suivi.id, compteRendu: validated },
      {
        onSuccess: () => {
          setBaselineJson(JSON.stringify(validated))
          setSavedAt(new Date())
          setSavedFeedback('validated')
          setTimeout(() => setSavedFeedback(null), 2500)
        },
      },
    )
  }

  const point = POINTS[currentPoint - 1]

  // Points 2 et 4 : une zone commune à toutes les classes (mêmes enseignants, mêmes élèves) ET une zone propre à
  // chaque classe. On remplit l'une, l'autre ou les deux : le compte-rendu imprime le commun, puis ce qui est propre
  // à chaque classe.
  const renderParClasse = (field: PointParClasse): ReactNode => {
    const classes = group.divisions.map((d) => d.classe.nom)
    const communField = field === 'point2' ? 'point2Commun' : 'point4Commun'
    const plusieurs = aUneZoneCommune(classes)
    // Le même texte a déjà été copié dans toutes les classes : on propose de le passer en commun.
    const dejaIdentique = texteIdentiqueAToutesLesClasses(cr, field, classes) !== null
    return (
      <div className="flex flex-col gap-3">
        {plusieurs && dejaIdentique && isEditable && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>Toutes les classes ont exactement le même texte.</span>
            <button
              type="button"
              onClick={() => setCr((prev) => passerEnCommun(prev, field, classes))}
              className="rounded-lg bg-amber-500 px-3 py-1 font-semibold text-white hover:bg-amber-600"
            >
              Le passer en commun
            </button>
          </div>
        )}
        {plusieurs && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            <p className="mb-1 text-xs font-semibold text-indigo-700">
              Commun à {listeClasses(classes)}
              <span className="font-normal text-slate-500"> · valable pour toutes les classes{group.teachers.length > 0 ? ` · ${group.teachers.map(teacherName).join(', ')}` : ''}</span>
            </p>
            <AutoGrowTextarea
              value={cr[communField] ?? ''}
              onChange={(e) => patch({ [communField]: e.target.value })}
              disabled={!isEditable}
              minRows={3}
              placeholder="Mêmes remarques pour toutes les classes (mêmes enseignants, mêmes élèves)…"
              className={textareaClass}
            />
          </div>
        )}
        {group.divisions.map((d) => (
          <div key={d.classe.id}>
            <p className="mb-1 text-xs font-semibold text-slate-500">
              {plusieurs ? 'Propre à ' : ''}
              {d.classe.nom} {d.pp ? `· ${teacherName(d.pp)}` : ''}
            </p>
            <AutoGrowTextarea
              value={cr[field]?.[d.classe.nom] ?? ''}
              onChange={(e) => patchRecord(field, d.classe.nom, e.target.value)}
              disabled={!isEditable}
              minRows={plusieurs ? 2 : 3}
              placeholder={plusieurs ? `Ce qui est propre à ${d.classe.nom} (facultatif)…` : undefined}
              className={textareaClass}
            />
          </div>
        ))}
      </div>
    )
  }

  const renderPointBody = (): ReactNode => {
    switch (currentPoint) {
      case 1:
        return (
          <>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Actions de la dernière réunion</p>
            <div className="mb-3">
              <ActionsList actions={niveauActions} isEditable={isEditable} onSetStatut={(id, statut) => setStatutMutation.mutate({ id, statut })} />
            </div>
            <AutoGrowTextarea
              value={cr.point1Commentaire ?? ''}
              onChange={(e) => patch({ point1Commentaire: e.target.value })}
              disabled={!isEditable}
              minRows={3}
              placeholder="Commentaires sur le suivi des actions…"
              className={textareaClass}
            />
          </>
        )
      case 2:
        return renderParClasse('point2')
      case 3:
        return (
          <>
            {riskStudents.length === 0 ? (
              <p className="mb-2 text-xs text-slate-400">Aucun élève signalé pour ce niveau.</p>
            ) : (
              <div className="mb-2 flex flex-col gap-2.5">
                {riskStudents.map((r) => (
                  <div key={r.id} className="rounded-lg border border-rose-100 bg-rose-50/40 p-2.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                      <span className="text-xs text-slate-500">{r.classe}</span>
                      {comparerAvecPrecedente && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${suiviPrev.has(r.id) ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                          {suiviPrev.has(r.id) ? 'Déjà suivi' : 'Nouveau'}
                        </span>
                      )}
                      {soutienInscriptions
                        .filter((i) => i.studentId === r.id)
                        .map((i) => soutienSeances.find((s) => s.id === i.seanceId))
                        .flatMap((s) => (s ? [s] : []))
                        .map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                            <GraduationCap className="h-3 w-3" />
                            Soutien {s.matiere} · {libelleCreneau(s)}
                          </span>
                        ))}
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => setSoutienPour({ id: r.id, name: r.name, classe: r.classe })}
                          className="ml-auto inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
                        >
                          <GraduationCap className="h-3 w-3" />
                          Proposer le soutien
                        </button>
                      )}
                    </div>
                    <p className="mb-1.5 pl-3.5 text-xs text-slate-500">{r.reasons.join(' · ')}</p>
                    {comparerAvecPrecedente && suiviPrev.has(r.id) && (
                      <p className="mb-1.5 pl-3.5 text-xs text-amber-800">
                        {`Réunion du ${formatDDMM(precedente.date)}`}
                        {suiviPrev.get(r.id)!.constat && ` — constat : ${suiviPrev.get(r.id)!.constat}`}
                        {suiviPrev.get(r.id)!.mesure && ` · mesure décidée : ${suiviPrev.get(r.id)!.mesure}`}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <AutoGrowTextarea minRows={2} value={cr.point3?.[r.id]?.constat ?? ''}
                        onChange={(e) => patchRisk(r.id, { constat: e.target.value })}
                        disabled={!isEditable}
                        placeholder="Constat"
                        className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                      />
                      <AutoGrowTextarea minRows={2} value={cr.point3?.[r.id]?.mesure ?? ''}
                        onChange={(e) => patchRisk(r.id, { mesure: e.target.value })}
                        disabled={!isEditable}
                        placeholder="Mesure décidée"
                        className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {comparerAvecPrecedente && plusSignales.length > 0 && (
              <div className="mb-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5 text-xs text-emerald-800">
                <p className="mb-1 font-semibold">{`Suivis à la réunion du ${formatDDMM(precedente.date)} et plus signalés aujourd'hui (${plusSignales.length})`}</p>
                <ul className="flex flex-col gap-0.5">
                  {plusSignales.map((e) => (
                    <li key={e.studentId}>
                      <b>{students.find((st) => st.id === e.studentId)?.name ?? 'Élève'}</b>
                      {e.mesure ? ` — mesure décidée : ${e.mesure}` : e.constat ? ` — constat : ${e.constat}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AutoGrowTextarea
              value={cr.point3Extra ?? ''}
              onChange={(e) => patch({ point3Extra: e.target.value })}
              disabled={!isEditable}
              minRows={2}
              placeholder="Autres élèves / élèves en progrès…"
              className={textareaClass}
            />
          </>
        )
      case 4:
        return (
          <>
            <AssiduitePanel classes={computeAssiduiteParClasse(students, studentExtras, classeNames, depuisReunion, today)} depuis={depuisReunion} today={today} />
            {renderParClasse('point4')}
          </>
        )
      case 5:
        return reclamations.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune réclamation ouverte pour ce niveau.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reclamations.map((r) => {
              const key = reclamationNoteKey(r)
              const note = getReclamationNote(cr.point5, r)
              const reponse = note?.reponse ?? ''
              const traitee = r.statut === 'Résolue'
              return (
                <div key={key} className={`rounded-lg border p-2.5 ${traitee ? 'border-emerald-100 bg-emerald-50/40' : 'border-amber-100 bg-amber-50/40'}`}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Megaphone className={`h-3.5 w-3.5 shrink-0 ${traitee ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <span className="text-sm font-semibold text-slate-800">{r.studentName}</span>
                    <span className="text-xs text-slate-500">{r.classe}</span>
                    <span className="flex-1" />
                    <span className="text-xs text-slate-500">
                      {r.type} — {r.objet}
                    </span>
                    {traitee && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Traitée</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <AutoGrowTextarea minRows={2} value={note?.faits ?? ''}
                      onChange={(e) => patchReclamation(r, { faits: e.target.value })}
                      disabled={!isEditable}
                      placeholder="Faits vérifiés"
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                    <AutoGrowTextarea minRows={2} value={reponse}
                      onChange={(e) => patchReclamation(r, { reponse: e.target.value })}
                      disabled={!isEditable}
                      placeholder="Réponse / suite"
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  {!traitee && (
                    <button
                      type="button"
                      onClick={() => handleMarkTraitee(r)}
                      disabled={!isEditable || !reponse.trim() || reclamationBusy === key}
                      className="mt-1.5 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {reclamationBusy === key ? 'Enregistrement…' : 'Marquer traitée'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      case 6:
        return (
          <>
            <FamillesPanel
              classeNames={classeNames}
              rendezVous={rendezVous}
              riskStudents={riskStudents}
              reclamations={reclamations}
              depuisReunion={depuisReunion}
              today={today}
              isEditable={isEditable}
            />
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Remarques sur les familles</p>
            <AutoGrowTextarea value={cr.point6 ?? ''} onChange={(e) => patch({ point6: e.target.value })} disabled={!isEditable} minRows={6} className={textareaClass} />
          </>
        )
      case 7:
        return <AutoGrowTextarea value={cr.point7 ?? ''} onChange={(e) => patch({ point7: e.target.value })} disabled={!isEditable} minRows={6} className={textareaClass} />
      case 8:
        return (
          <>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Décisions de cette réunion</p>
            <ActionsList actions={niveauActions} isEditable={isEditable} onSetStatut={(id, statut) => setStatutMutation.mutate({ id, statut })} />
          </>
        )
      default:
        return null
    }
  }

  return (
    <>
      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Réunion de suivi de classe</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <select
                value={selectedNiveau}
                onChange={(e) => {
                  if (isDirty && isEditable && suivi) saveMutation.mutate({ id: suivi.id, compteRendu: cr })
                  setSelectedNiveau(e.target.value)
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700"
              >
                {logicalGroups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">{whenLabel}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {savedFeedback && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Compte-rendu validé.
              </span>
            )}
            {!savedFeedback && suivi && isEditable &&
              (saveMutation.isPending ? (
                <span className="text-xs font-semibold text-slate-400">Enregistrement…</span>
              ) : isDirty ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Modifications non enregistrées
                </span>
              ) : savedAt ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {`Enregistré à ${savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              ) : null)}
            {suivi && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!isEditable || saveMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                Enregistrer
              </button>
            )}
            <MeetingTimerChip running={timer.running} total={timer.total} onToggle={timer.toggle} onReset={timer.reset} />
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('wizard')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${viewMode === 'wizard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Déroulé de la réunion
              </button>
              <button
                type="button"
                onClick={() => setViewMode('recap')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${viewMode === 'recap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Compte-rendu A4
              </button>
            </div>
          </div>
        </div>
      </div>

      {!suivi ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Aucun suivi planifié ou passé n'existe pour {group.label}. Planifiez d'abord une réunion depuis l'onglet "Suivi de Classe".
        </div>
      ) : viewMode === 'recap' ? (
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer / Télécharger
          </button>
          {/* Une ou plusieurs pages A4 : chacune porte déjà son ombre, on les sépare simplement. */}
          <div className="flex flex-col gap-4">
            <PrintableCompteRenduReunion group={group} suivi={suivi} compteRendu={cr} riskStudents={riskStudents} reclamations={reclamations} actions={niveauActions} rendezVous={rendezVousImprimes} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[210px_1fr] 2xl:grid-cols-[220px_1fr_260px]">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:h-fit">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Feuille de route</p>
            <div className="flex flex-col gap-1">
              {POINTS.map((p) => {
                const active = p.n === currentPoint
                const filled = pointHasContent(p.n, cr, group)
                return (
                  <button
                    key={p.n}
                    type="button"
                    onClick={() => setCurrentPoint(p.n)}
                    className={`flex items-start gap-2 rounded-lg px-2 py-2 text-left ${active ? 'border border-indigo-200 bg-indigo-50' : 'border border-transparent hover:bg-slate-50'}`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        active ? 'bg-indigo-600 text-white' : filled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.n}
                    </span>
                    <span className="min-w-0">
                      <p className={`text-xs font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{p.title}</p>
                      <p className={`text-[10px] ${timer.perPoint[p.n] ? TEMPS_COLOR[statutTemps(timer.perPoint[p.n], p.minutes)] : 'text-slate-400'}`}>
                        {p.minutes} min
                        {timer.perPoint[p.n] ? ` · ${formatClock(timer.perPoint[p.n])}` : ''}
                      </p>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-2">
              <p className="mb-1 text-[10px] font-semibold text-slate-500">Compte-rendu rempli {filledCount}/8</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(filledCount / 8) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Point {currentPoint} / 8</span>
              <span className={`text-xs font-semibold tabular-nums ${TEMPS_COLOR[statutTemps(timer.perPoint[currentPoint] ?? 0, point.minutes)]}`}>
                {formatClock(timer.perPoint[currentPoint] ?? 0)} / {point.minutes}:00
              </span>
            </div>
            <h2 className="mb-3 text-lg font-bold text-slate-900">{point.title}</h2>
            <div className="mb-4 rounded-xl bg-indigo-50/70 p-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600">À aborder</p>
              <ul className="flex flex-col gap-0.5 text-xs text-indigo-900">
                {point.guide.map((g, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span>•</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>

            {renderPointBody()}

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setCurrentPoint((p) => Math.max(1, p - 1))}
                disabled={currentPoint === 1}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>
              {currentPoint < 8 ? (
                <button
                  type="button"
                  onClick={() => setCurrentPoint((p) => Math.min(8, p + 1))}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
                >
                  Point suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={!isEditable || saveMutation.isPending}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Enregistrer le brouillon
                  </button>
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={!isEditable || validateMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Valider · marquer réalisé
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2 2xl:col-span-1 2xl:grid-cols-1 2xl:sticky 2xl:top-4 2xl:h-fit">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Présence</p>
              <div className="flex flex-col gap-1">
                {participants.map((p) => {
                  const state = cr.presence?.[p.name] ?? 'present'
                  const dotColor = state === 'present' ? 'bg-emerald-500' : state === 'absent' ? 'bg-rose-500' : 'bg-amber-500'
                  const textColor = state === 'present' ? 'text-emerald-600' : state === 'absent' ? 'text-rose-600' : 'text-amber-600'
                  const label = state === 'present' ? 'Présent' : state === 'absent' ? 'Absent' : 'Excusé'
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => togglePresence(p.name)}
                      disabled={!isEditable}
                      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[10px] font-bold text-violet-700">{initialsOf(p.name)}</span>
                      <span className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{p.name}</p>
                        <p className="truncate text-[10px] text-slate-500">{p.role}</p>
                      </span>
                      <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${textColor}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Actions décidées</p>
              <div className="flex flex-col gap-1.5">
                <input
                  value={newActionTexte}
                  onChange={(e) => setNewActionTexte(e.target.value)}
                  placeholder="Nouvelle action…"
                  disabled={!isEditable}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
                <select
                  value={newActionOwner}
                  onChange={(e) => setNewActionOwner(e.target.value)}
                  disabled={!isEditable}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                >
                  {owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newActionEcheance}
                  onChange={(e) => setNewActionEcheance(e.target.value)}
                  disabled={!isEditable}
                  className="w-full rounded-md border border-slate-200 px-1.5 py-1.5 text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleAddAction}
                  disabled={!isEditable || !newActionTexte.trim()}
                  className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {soutienPour && <InscrireSoutienModal studentId={soutienPour.id} studentName={soutienPour.name} classe={soutienPour.classe} onClose={() => setSoutienPour(null)} />}

      {showPrint && suivi && group && (
        <SuiviReunionPrintPreviewModal group={group} suivi={suivi} compteRendu={cr} riskStudents={riskStudents} reclamations={reclamations} actions={niveauActions} rendezVous={rendezVousImprimes} onClose={() => setShowPrint(false)} />
      )}
    </>
  )
}
