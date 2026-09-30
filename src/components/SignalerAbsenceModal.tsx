import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NotebookPen, X } from 'lucide-react'
import { getClassOptions, recomputeStudentAttendance } from '../data/students'
import { useStudents } from '../services/studentsService'
import { useTeachers } from '../services/teachersService'
import { SCHEDULE_DAYS } from '../data/classSchedules'
import { getClassScheduleSnapshot, useClassSchedules } from '../services/classSchedulesService'
import { computeTeacherSchedule, formatHeures } from '../utils/teacherAggregation'
import { colorForSubject, defaultExtra, type EventRecord } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentEvents, useStudentExtras } from '../services/studentDetailsService'
import type { TeacherAbsenceRecord } from '../data/teacherExtras'
import { useTeacherExtras, useUpdateTeacherAbsences } from '../services/teacherExtrasService'
import { useAbsencesConfig } from '../services/absencesConfigService'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { enqueueNotification } from '../services/notificationQueueService'
import { defaultIdentity } from '../data/studentIdentity'
import { useStudentIdentities } from '../services/studentIdentityService'
import DeclarerSortieAnticipeeModal from './student-detail/DeclarerSortieAnticipeeModal'
import SortieAnticipeePrintPreviewModal from './sortie-anticipee-print/SortieAnticipeePrintPreviewModal'
import TransportSortieWhatsAppModal from './transport/TransportSortieWhatsAppModal'
import { useTransportLignes } from '../services/transportLignesService'
import { useChauffeurs } from '../services/chauffeursService'
import { useAidesMaitresses } from '../services/aidesMaitressesService'
import { useServicesCapacite } from '../services/servicesCapaciteService'
import { resolveStudentTransport } from '../utils/transportStudentResolver'
import { buildSortieAnticipeeTransportMessage } from '../utils/whatsapp'

interface SignalerAbsenceModalProps {
  onClose: () => void
  onSaved?: () => void
  initialTypeCible?: 'eleve' | 'professeur'
}

interface DaySlot {
  id: string
  subject: string
  start: string
  end: string
  hours: number
  classe?: string
}

const DAY_LABELS = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']

function dayNameFor(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return DAY_LABELS[d.getDay()] ?? ''
}

function eachDateInRange(startIso: string, endIso: string): string[] {
  const result: string[] = []
  const current = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso}T00:00:00`)
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) return result
  while (current <= end) {
    result.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  return result
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function timeToMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** Retard réellement écoulé pour ce créneau : différence entre l'heure d'arrivée et le début du cours, plafonnée à la durée du créneau. */
function retardHoursForSlot(slot: DaySlot, heureArrivee: string): number {
  const arrivalMin = timeToMinutes(heureArrivee)
  const startMin = timeToMinutes(slot.start)
  if (arrivalMin === null || startMin === null) return 0
  const minutes = Math.min(Math.max(0, arrivalMin - startMin), slot.hours * 60)
  return minutes / 60
}

type QuickFilter = 'full' | 'matin' | 'apresmidi'

export default function SignalerAbsenceModal({ onClose, onSaved, initialTypeCible = 'eleve' }: SignalerAbsenceModalProps) {
  const queryClient = useQueryClient()
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const { data: absencesConfig } = useAbsencesConfig()
  const motifOptions = absencesConfig?.motifs ?? []
  const { data: teachers = [] } = useTeachers()
  const { data: teacherExtras = {} } = useTeacherExtras()
  const updateAbsences = useUpdateTeacherAbsences()
  const { data: students = [] } = useStudents()
  // Référence captée (pas juste un abonnement muet) : elevesDeLaClasse/daySlots/periodSlotsByDay
  // en dépendent pour recalculer au bon moment. Un id d'année consulté ne suffirait pas : il
  // change avant la fin du fetch réseau, donc un useMemo qui n'en dépendrait que lui recalculerait
  // trop tôt (encore les données de l'année précédente) et jamais une seconde fois une fois le
  // fetch résolu.
  const { data: schedules } = useClassSchedules()
  const isEditable = useIsViewedYearEditable()
  const { data: identities = {} } = useStudentIdentities()
  const { data: extrasMap = {} } = useStudentExtras()
  const { data: lignes = [] } = useTransportLignes()
  const { data: chauffeurs = [] } = useChauffeurs()
  const { data: aides = [] } = useAidesMaitresses()
  const { data: capacite } = useServicesCapacite()

  const [typeCible, setTypeCible] = useState<'eleve' | 'professeur'>(initialTypeCible)
  const [classe, setClasse] = useState(realClasses[0])
  const [groupe, setGroupe] = useState('Tous les groupes')
  const [eleveId, setEleveId] = useState('')
  const [professeurId, setProfesseurId] = useState(teachers[0]?.id ?? '')
  const [typeSignalement, setTypeSignalement] = useState<'absence' | 'retard' | 'sortie_anticipee'>('absence')
  const [heureArrivee, setHeureArrivee] = useState('')
  const [periode, setPeriode] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [dateFin, setDateFin] = useState(todayISO())
  const [justifie, setJustifie] = useState(false)
  const [motif, setMotif] = useState('')
  // Sortie anticipée : déléguée entièrement au même flux riche que la fiche élève (récupéré par
  // sourcé sur les vrais contacts/responsables, vérifications, marquage auto des cours restants,
  // impression) plutôt que dupliqué ici en version appauvrie — cf. DeclarerSortieAnticipeeModal.
  const [showSortieFlow, setShowSortieFlow] = useState(false)
  type SortiePrintData = {
    date: string
    heure: string
    recuperePar: string
    lienParente: string
    motif: string
    verifIdentite: boolean
    verifAccordResponsable: boolean
    verifSurListe: boolean
    reference: string
  }
  const [sortiePrintData, setSortiePrintData] = useState<SortiePrintData | null>(null)
  // Sortie anticipée déclarée mais dont l'aperçu d'impression est retardé le temps que le staff
  // gère (ou ignore) le popup WhatsApp de prévenance du transport — même garde-fou que
  // InformationsGeneralesTab.tsx, évite d'empiler les deux modaux.
  const [pendingSortiePrint, setPendingSortiePrint] = useState<SortiePrintData | null>(null)

  const selectedEleve = students.find((s) => s.id === eleveId) ?? null
  const eleveIdentity = identities[eleveId] ?? defaultIdentity
  const eleveCantine = extrasMap[eleveId]?.cantine ?? defaultExtra.cantine

  const elevesDeLaClasse = useMemo(() => students.filter((s) => s.classe === classe), [classe, students])

  const slotsForDay = (iso: string): DaySlot[] => {
    const day = dayNameFor(iso)
    if (!SCHEDULE_DAYS.includes(day)) return []
    if (typeCible === 'eleve') {
      return (getClassScheduleSnapshot(classe)[day] ?? []).map((s) => ({ id: s.id, subject: s.subject, start: s.start, end: s.end, hours: s.hours }))
    }
    const teacher = teachers.find((t) => t.id === professeurId)
    if (!teacher) return []
    return computeTeacherSchedule(teacher)[day] ?? []
  }

  const daySlots = useMemo(() => slotsForDay(date), [date, typeCible, classe, professeurId, teachers, schedules])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('full')

  useEffect(() => {
    setSelected(new Set(daySlots.map((s) => s.id)))
    setQuickFilter('full')
  }, [daySlots])

  const applyQuickFilter = (filter: QuickFilter) => {
    setQuickFilter(filter)
    if (filter === 'full') {
      setSelected(new Set(daySlots.map((s) => s.id)))
    } else {
      setSelected(new Set(daySlots.filter((s) => (filter === 'matin' ? s.start < '13:00' : s.start >= '13:00')).map((s) => s.id)))
    }
  }

  const toggleSlot = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allChecked = daySlots.length > 0 && selected.size === daySlots.length
  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(daySlots.map((s) => s.id)) : new Set())
  }

  const periodSlotsByDay = useMemo(() => {
    if (!periode) return []
    return eachDateInRange(date, dateFin).map((iso) => ({ iso, slots: slotsForDay(iso) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, date, dateFin, typeCible, classe, professeurId, teachers, schedules])

  const effectiveHours = (slot: DaySlot) => (typeSignalement === 'retard' ? retardHoursForSlot(slot, heureArrivee) : slot.hours)

  const periodTotalHours = periodSlotsByDay.reduce((sum, d) => sum + d.slots.reduce((s, sl) => s + effectiveHours(sl), 0), 0)
  const periodTotalCount = periodSlotsByDay.reduce((sum, d) => sum + d.slots.length, 0)

  const selectedTotalHours = daySlots.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + effectiveHours(s), 0)
  const previewHours = periode ? periodTotalHours : selectedTotalHours

  // Un prof peut être absent un jour où il n'a justement aucun cours prévu (jour hors de son
  // emploi du temps personnel) — la case est alors vide, mais l'absence reste un fait réel à
  // tracer (indisponibilité pour un remplacement, historique du prof), pas un blocage.
  const noCourseTeacherAbsence = typeCible === 'professeur' && !periode && typeSignalement === 'absence' && daySlots.length === 0
  const hasSelection = periode ? periodTotalCount > 0 : selected.size > 0 || noCourseTeacherAbsence
  const canSubmit =
    typeSignalement === 'sortie_anticipee'
      ? isEditable && !!eleveId
      : isEditable &&
        (typeCible === 'eleve' ? !!eleveId : !!professeurId) &&
        hasSelection &&
        (typeSignalement !== 'retard' || !!heureArrivee)

  const handleSubmit = async () => {
    if (!canSubmit) return

    if (typeSignalement === 'sortie_anticipee') {
      setShowSortieFlow(true)
      return
    }

    const type: 'ABSENCE' | 'RETARD' = typeSignalement === 'absence' ? 'ABSENCE' : 'RETARD'
    const newTeacherAbsences: TeacherAbsenceRecord[] = []
    const newStudentEvents: EventRecord[] = []

    const createEvent = (iso: string, slot: DaySlot) => {
      const hours = effectiveHours(slot)
      if (type === 'RETARD' && hours <= 0) return
      if (typeCible === 'eleve') {
        newStudentEvents.push({
          date: iso,
          type,
          justified: justifie,
          subject: slot.subject,
          subjectColor: colorForSubject(slot.subject),
          duree: formatHeures(hours),
          motif,
          // Pour un retard, l'heure qui compte est celle à laquelle l'élève est réellement
          // arrivé (saisie ci-dessus) — pas le début du cours manqué, qui n'apporte rien de plus
          // que la durée déjà affichée. Pour une absence, le début du cours reste la seule heure
          // significative (l'élève n'était simplement pas là).
          start: type === 'RETARD' ? heureArrivee : slot.start,
        })
      } else {
        newTeacherAbsences.push({ date: iso, type, justified: justifie, classe: slot.classe ?? '', duree: hours, motif, slotId: slot.id })
      }
    }

    if (periode) {
      periodSlotsByDay.forEach(({ iso, slots }) => slots.forEach((slot) => createEvent(iso, slot)))
    } else if (noCourseTeacherAbsence) {
      newTeacherAbsences.push({ date, type: 'ABSENCE', justified: justifie, classe: '', duree: 0, motif })
    } else {
      daySlots.filter((s) => selected.has(s.id)).forEach((slot) => createEvent(date, slot))
    }

    if (typeCible === 'eleve') {
      const allEvents = [...getStudentExtraSnapshot(eleveId).events, ...newStudentEvents]
      if (newStudentEvents.length > 0) {
        await updateStudentEvents(eleveId, allEvents)
        const eleve = students.find((s) => s.id === eleveId)
        if (eleve) {
          await Promise.all(
            newStudentEvents.map((e) =>
              enqueueNotification({
                studentId: eleveId,
                templateCode: e.type === 'ABSENCE' ? 'absence' : 'retard',
                variables: { eleve: eleve.name, classe: eleve.classe, date: e.date, motif: e.motif },
              })
            )
          )
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      await recomputeStudentAttendance(eleveId, allEvents)
      await queryClient.invalidateQueries({ queryKey: ['students'] })
    } else {
      const teacher = teachers.find((t) => t.id === professeurId)
      if (teacher && newTeacherAbsences.length > 0) {
        const extra = teacherExtras[teacher.id] ?? { absences: [], remplacements: [] }
        updateAbsences.mutate({ teacherId: teacher.id, absences: [...extra.absences, ...newTeacherAbsences] })
      }
    }

    onSaved?.()
    onClose()
  }

  if (showSortieFlow && selectedEleve) {
    return (
      <DeclarerSortieAnticipeeModal
        studentId={selectedEleve.id}
        classe={selectedEleve.classe}
        studentName={selectedEleve.name}
        identity={eleveIdentity}
        cantine={eleveCantine}
        onClose={() => setShowSortieFlow(false)}
        onDeclared={(input) => {
          setShowSortieFlow(false)
          const transport = resolveStudentTransport(selectedEleve, eleveIdentity, lignes, chauffeurs, aides, capacite)
          if (eleveIdentity.transport && transport.ligneSoirNom && !transport.soirParents) {
            setPendingSortiePrint(input)
          } else {
            setSortiePrintData(input)
          }
        }}
      />
    )
  }

  if (pendingSortiePrint && selectedEleve) {
    const transport = resolveStudentTransport(selectedEleve, eleveIdentity, lignes, chauffeurs, aides, capacite)
    return (
      <TransportSortieWhatsAppModal
        mode="sortie"
        studentName={selectedEleve.name}
        ligneSoirNom={transport.ligneSoirNom}
        chauffeurNom={transport.chauffeurSoir?.nom ?? null}
        chauffeurTel={transport.chauffeurSoir?.telephone ?? null}
        aideNom={transport.aideSoir?.nom ?? null}
        aideTel={transport.aideSoir?.telephone ?? null}
        groupeUrl={capacite?.transportWhatsappGroupeUrl ?? ''}
        message={buildSortieAnticipeeTransportMessage({
          studentName: selectedEleve.name,
          sexe: selectedEleve.sexe,
          classe: selectedEleve.classe,
          ligneSoirNom: transport.ligneSoirNom,
          heure: pendingSortiePrint.heure,
          date: pendingSortiePrint.date,
        })}
        onClose={() => {
          setSortiePrintData(pendingSortiePrint)
          setPendingSortiePrint(null)
        }}
      />
    )
  }

  if (sortiePrintData && selectedEleve) {
    return (
      <SortieAnticipeePrintPreviewModal
        student={selectedEleve}
        identity={eleveIdentity}
        date={sortiePrintData.date}
        heure={sortiePrintData.heure}
        recuperePar={sortiePrintData.recuperePar}
        lienParente={sortiePrintData.lienParente}
        motif={sortiePrintData.motif}
        verifIdentite={sortiePrintData.verifIdentite}
        verifAccordResponsable={sortiePrintData.verifAccordResponsable}
        verifSurListe={sortiePrintData.verifSurListe}
        reference={sortiePrintData.reference}
        onClose={() => {
          setSortiePrintData(null)
          onSaved?.()
          onClose()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            Signaler une Absence / Retard
            <NotebookPen className="h-5 w-5 text-slate-700" />
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!isEditable && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Année en lecture seule — basculez sur l'année active pour enregistrer un signalement.
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type de cible</label>
            <select
              value={typeCible}
              onChange={(e) => {
                const next = e.target.value as 'eleve' | 'professeur'
                setTypeCible(next)
                if (next === 'professeur' && typeSignalement === 'sortie_anticipee') setTypeSignalement('absence')
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="eleve">Élève</option>
              <option value="professeur">Professeur</option>
            </select>
          </div>

          {typeCible === 'eleve' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classe</label>
                  <select
                    value={classe}
                    onChange={(e) => {
                      setClasse(e.target.value)
                      setEleveId('')
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                  >
                    {realClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Groupe</label>
                  <select
                    value={groupe}
                    onChange={(e) => setGroupe(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                  >
                    <option>Tous les groupes</option>
                    <option>Groupe A</option>
                    <option>Groupe B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élève concerné</label>
                <select
                  value={eleveId}
                  onChange={(e) => setEleveId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">Sélectionner un élève...</option>
                  {elevesDeLaClasse.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Professeur concerné</label>
              <select
                value={professeurId}
                onChange={(e) => setProfesseurId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.prenom} {t.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type de signalement</label>
              <select
                value={typeSignalement}
                onChange={(e) => setTypeSignalement(e.target.value as 'absence' | 'retard' | 'sortie_anticipee')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="absence">Absence</option>
                <option value="retard">Retard</option>
                {typeCible === 'eleve' && <option value="sortie_anticipee">Sortie anticipée</option>}
              </select>
            </div>
            {typeSignalement === 'retard' && (
              <div className="min-w-[160px] flex-1">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure d'arrivée</label>
                <input
                  type="time"
                  value={heureArrivee}
                  onChange={(e) => setHeureArrivee(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            )}
            {typeSignalement !== 'sortie_anticipee' && (
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={periode}
                onChange={(e) => setPeriode(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              Saisie sur une période
            </label>
            )}
          </div>
          {typeSignalement === 'retard' && !heureArrivee && (
            <p className="-mt-2 text-xs text-amber-600">
              Indiquez l'heure d'arrivée de l'élève pour calculer la durée exacte du retard.
            </p>
          )}

          {typeSignalement !== 'sortie_anticipee' && (periode ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Du</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Au</label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          ))}

          {typeSignalement === 'sortie_anticipee' ? (
            <p className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 text-xs text-teal-700">
              L'étape suivante permet de choisir qui récupère l'élève, de vérifier son identité et
              d'imprimer directement le document à faire signer — comme depuis la fiche élève.
            </p>
          ) : (
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            {periode ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Séances sur la période</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {date} → {dateFin}
                  </span>
                </div>
                {periodTotalCount === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">Aucun cours programmé sur cette période.</p>
                ) : (
                  <p className="text-sm text-slate-600">
                    <span className="font-bold text-indigo-600">{periodTotalCount} séance{periodTotalCount > 1 ? 's' : ''}</span> réparties sur{' '}
                    {periodSlotsByDay.filter((d) => d.slots.length > 0).length} jour(s) seront enregistrées automatiquement, matière par matière,
                    selon l'emploi du temps réel.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Cours du jour</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{dayNameFor(date)}</span>
                </div>

                {daySlots.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">
                    Aucun cours prévu ce jour.
                    {noCourseTeacherAbsence && (
                      <>
                        {' '}
                        L'absence sera tout de même enregistrée (0h de cours manqué), et le professeur sera marqué indisponible ce jour-là.
                      </>
                    )}
                  </p>
                ) : (
                  <>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => applyQuickFilter('full')}
                        className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                          quickFilter === 'full'
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        ☀️ Toute la journée
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickFilter('matin')}
                        className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                          quickFilter === 'matin'
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        🌄 Matinée (Matin)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickFilter('apresmidi')}
                        className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                          quickFilter === 'apresmidi'
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        🌆 Après-midi (Soir)
                      </button>
                    </div>

                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                      />
                      Toute la journée (Tous les cours)
                    </label>

                    <div className="space-y-1.5 pl-1">
                      {daySlots.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggleSlot(s.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                          />
                          {s.subject} ({s.start} - {s.end}, {s.hours}h){s.classe ? ` · ${s.classe}` : ''}
                          {typeSignalement === 'retard' && heureArrivee && (
                            <span className="font-semibold text-amber-600">
                              {' '}
                              → {formatHeures(retardHoursForSlot(s, heureArrivee))} de retard
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          )}

          {typeSignalement !== 'sortie_anticipee' && (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={justifie}
                onChange={(e) => setJustifie(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              Signalement Justifié
            </label>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motif / Commentaire</label>
              <select
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Sélectionner un motif...</option>
                {motifOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          )}

          {typeSignalement !== 'sortie_anticipee' && (
          <div className="rounded-lg border-l-4 border-l-indigo-500 bg-indigo-50/50 px-4 py-3 text-center">
            <p className="text-sm text-slate-600">
              {typeSignalement === 'retard' ? 'Durée de retard calculée :' : "Cumul d'heures manquées calculé :"}
            </p>
            <p className="text-xl font-bold text-indigo-600">{formatHeures(previewHours)}</p>
          </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {typeSignalement === 'sortie_anticipee' ? 'Continuer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
