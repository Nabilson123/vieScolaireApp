import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList,
  FileSpreadsheet,
  Layers,
  Printer,
  CalendarDays,
  MapPin,
  Sunrise,
  Sunset,
  Circle,
  Check,
  Undo2,
  Building2,
  DoorOpen,
  LogIn,
  Trash2,
  X,
} from 'lucide-react'
import { getClassOptions, parseDuration, type Student } from '../data/students'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { useClasses } from '../services/classesService'
import type { EventRecord } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentEvents } from '../services/studentDetailsService'
import { useSortiesAnticipees, useDeleteSortieAnticipee, useReintegrerSortieAnticipee } from '../services/sortiesAnticipeesService'
import { useAbsencesConfig, getAbsencesConfigSnapshot } from '../services/absencesConfigService'
import { useStudentIdentities } from '../services/studentIdentityService'
import { useTransportLignes } from '../services/transportLignesService'
import { useChauffeurs } from '../services/chauffeursService'
import { useAidesMaitresses } from '../services/aidesMaitressesService'
import { useServicesCapacite } from '../services/servicesCapaciteService'
import { resolveStudentTransport } from '../utils/transportStudentResolver'
import { buildRetourSortieAnticipeeTransportMessage } from '../utils/whatsapp'
import TransportSortieWhatsAppModal from '../components/transport/TransportSortieWhatsAppModal'
import { formatHeures } from '../utils/teacherAggregation'
import { downloadCSV } from '../utils/csvExport'
import { buildCycleSummaries, type CycleSummaryRow, type CycleClasseRow } from '../utils/absencesCycleSummary'
import { cycleOfNiveau } from '../data/referentiel'
import { TOUTE_ETABLISSEMENT } from '../utils/absencesScope'
import AbsencesPrintPreviewModal from '../components/absences-print/AbsencesPrintPreviewModal'
import type { SortiePrintRow } from '../components/absences-print/PrintableAbsencesBilan'
import ClasseDossiersPreviewModal from '../components/absences-print/ClasseDossiersPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

function todayISO() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isMatin(start: string | undefined, heureDebutApresMidi: string): boolean {
  return (start ?? '08:00') < heureDebutApresMidi
}

/** "08:30" → "08h30", convention française déjà utilisée partout ailleurs dans ce fichier. */
function toHeureFR(t: string): string {
  return t.replace(':', 'h')
}

interface BilanRow {
  studentId: string
  studentName: string
  classe: string
  totalMinutes: number
  motifs: string[]
  justified: boolean
  /** Heure de début réelle, affichée sur le Bilan Journalier uniquement quand elle diffère du
   * début du créneau lui-même (08:30/13:00) — la plupart des absences couvrent tout le créneau
   * dès son premier cours, donc répéter cette heure par défaut pour chaque élève n'apporte rien ;
   * elle ne devient utile que pour signaler un départ/retard partiel en cours de créneau. */
  heure?: string
  events: EventRecord[]
}

function buildRows(
  classe: string,
  date: string,
  type: 'ABSENCE' | 'RETARD',
  matin: boolean,
  heureDebutMatin: string,
  heureDebutApresMidi: string
): BilanRow[] {
  const rows: BilanRow[] = []
  const creneauDebut = matin ? heureDebutMatin : heureDebutApresMidi
  getStudentsSnapshot()
    .filter((s) => classe === TOUTE_ETABLISSEMENT || s.classe === classe)
    .forEach((s) => {
      const events = getStudentExtraSnapshot(s.id).events.filter((e) => e.date === date && e.type === type && isMatin(e.start, heureDebutApresMidi) === matin)
      if (events.length === 0) return
      const totalMinutes = events.reduce((sum, e) => sum + parseDuration(e.duree), 0)
      const motifs = Array.from(new Set(events.map((e) => e.motif).filter(Boolean)))
      const justified = events.every((e) => e.justified)
      const premiereHeure = events
        .map((e) => e.start)
        .filter((h): h is string => !!h)
        .sort()[0]
      // Pour un retard, l'heure est toujours l'arrivée réelle de l'élève — donc toujours
      // significative, même si elle tombe pile sur le début du créneau. Pour une absence, elle ne
      // vaut la peine d'être affichée que si elle diffère du créneau (absence partielle) : sinon
      // elle ne fait que répéter "Matin"/"Après-midi", déjà visible juste au-dessus.
      const heure = type === 'RETARD' ? premiereHeure : premiereHeure && premiereHeure !== creneauDebut ? premiereHeure : undefined
      rows.push({ studentId: s.id, studentName: s.name, classe: s.classe, totalMinutes, motifs, justified, heure, events })
    })
  return rows
}

export default function AbsencesRetards() {
  const queryClient = useQueryClient()
  // Toutes les fonctions ci-dessous lisent getStudentsSnapshot() : sans la référence `students`
  // (celle réellement retournée par useStudents(), pas juste viewedYearId) dans les deps, les
  // useMemo resteraient bloqués sur les données d'avant le changement d'année. viewedYearId seul
  // ne suffit pas : il change UNE fois, avant la fin du fetch réseau, donc un useMemo qui ne
  // dépend que de lui recalcule trop tôt (encore les anciennes données) et jamais une seconde
  // fois une fois le fetch résolu. `students` change deux fois (requête vidée, puis données
  // fraîches), ce qui déclenche le recalcul au bon moment.
  const { data: students } = useStudents()
  const { data: classes } = useClasses()
  const { data: absencesConfig } = useAbsencesConfig()
  const heureDebutMatin = absencesConfig?.heureDebutMatin ?? getAbsencesConfigSnapshot().heureDebutMatin
  const heureFinMatin = absencesConfig?.heureFinMatin ?? getAbsencesConfigSnapshot().heureFinMatin
  const heureDebutApresMidi = absencesConfig?.heureDebutApresMidi ?? getAbsencesConfigSnapshot().heureDebutApresMidi
  const heureFinApresMidi = absencesConfig?.heureFinApresMidi ?? getAbsencesConfigSnapshot().heureFinApresMidi
  const { data: identities } = useStudentIdentities()
  const { data: transportLignes = [] } = useTransportLignes()
  const { data: chauffeurs = [] } = useChauffeurs()
  const { data: aides = [] } = useAidesMaitresses()
  const { data: capacite } = useServicesCapacite()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'absences').canEdit
  const isEditable = canEditYear && canEditModule
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [selectedClasse, setSelectedClasse] = useState(TOUTE_ETABLISSEMENT)
  const [refreshTick, setRefreshTick] = useState(0)
  const [showBilanPrint, setShowBilanPrint] = useState(false)
  const [showBatchPrint, setShowBatchPrint] = useState(false)
  const [confirmDeleteSortieId, setConfirmDeleteSortieId] = useState<string | null>(null)
  const [reintegrerSortieId, setReintegrerSortieId] = useState<string | null>(null)
  const [heureRetour, setHeureRetour] = useState('')
  const [retourWhatsApp, setRetourWhatsApp] = useState<{ student: Student; heure: string } | null>(null)
  const deleteSortie = useDeleteSortieAnticipee()
  const reintegrerSortie = useReintegrerSortieAnticipee()
  const bump = () => setRefreshTick((v) => v + 1)

  const toggleRow = async (row: BilanRow) => {
    const next = !row.justified
    const rowEvents = new Set(row.events)
    const events = getStudentExtraSnapshot(row.studentId).events.map((e) => (rowEvents.has(e) ? { ...e, justified: next } : e))
    await updateStudentEvents(row.studentId, events)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    bump()
  }

  const absMatin = useMemo(
    () => buildRows(selectedClasse, selectedDate, 'ABSENCE', true, heureDebutMatin, heureDebutApresMidi),
    [selectedClasse, selectedDate, refreshTick, students, heureDebutMatin, heureDebutApresMidi]
  )
  const absApresMidi = useMemo(
    () => buildRows(selectedClasse, selectedDate, 'ABSENCE', false, heureDebutMatin, heureDebutApresMidi),
    [selectedClasse, selectedDate, refreshTick, students, heureDebutMatin, heureDebutApresMidi]
  )
  const retMatin = useMemo(
    () => buildRows(selectedClasse, selectedDate, 'RETARD', true, heureDebutMatin, heureDebutApresMidi),
    [selectedClasse, selectedDate, refreshTick, students, heureDebutMatin, heureDebutApresMidi]
  )
  const retApresMidi = useMemo(
    () => buildRows(selectedClasse, selectedDate, 'RETARD', false, heureDebutMatin, heureDebutApresMidi),
    [selectedClasse, selectedDate, refreshTick, students, heureDebutMatin, heureDebutApresMidi]
  )

  const effectif = useMemo(
    () =>
      selectedClasse === TOUTE_ETABLISSEMENT
        ? getStudentsSnapshot().length
        : getStudentsSnapshot().filter((s) => s.classe === selectedClasse).length,
    [selectedClasse, students]
  )

  const absentStudentIds = useMemo(
    () => new Set([...absMatin, ...absApresMidi].map((r) => r.studentId)),
    [absMatin, absApresMidi]
  )
  const retardStudentIds = useMemo(
    () => new Set([...retMatin, ...retApresMidi].map((r) => r.studentId)),
    [retMatin, retApresMidi]
  )

  const absencesSignalees = absentStudentIds.size
  const retardsSignales = retardStudentIds.size
  const tauxPresence = effectif === 0 ? 100 : Math.max(0, Math.round((1 - absencesSignalees / effectif) * 1000) / 10)

  const classeStudents = useMemo(
    () =>
      selectedClasse === TOUTE_ETABLISSEMENT
        ? getStudentsSnapshot()
        : getStudentsSnapshot().filter((s) => s.classe === selectedClasse),
    [selectedClasse, students]
  )

  const cycleSummaries = useMemo(() => buildCycleSummaries(selectedDate), [selectedDate, refreshTick, students, classes])

  // Périmètre "Toute l'établissement" : les vrais cycleSummaries. Périmètre classe unique : un
  // pseudo-cycle à 1 élément (le vrai cycle de cette classe, ne contenant qu'elle) — le composant
  // d'impression boucle sur ce tableau sans jamais savoir dans quel périmètre il se trouve, ce qui
  // garantit mécaniquement le même chrome visuel dans les deux cas (décision produit du Bilan
  // Journalier v2 : un seul design automatique pour les deux vues).
  const printCycleSummaries = useMemo<CycleSummaryRow[]>(() => {
    if (selectedClasse === TOUTE_ETABLISSEMENT) return cycleSummaries
    const info = classes?.find((c) => c.nom === selectedClasse)
    const cycle = info ? cycleOfNiveau(info.niveau) : undefined
    if (!cycle) return []
    const row: CycleClasseRow = { classe: selectedClasse, effectif, absences: absencesSignalees, retards: retardsSignales, tauxPresence }
    return [{ key: cycle.key, label: cycle.label, effectif, absences: absencesSignalees, retards: retardsSignales, tauxPresence, classes: [row] }]
  }, [selectedClasse, classes, cycleSummaries, effectif, absencesSignalees, retardsSignales, tauxPresence])

  const { data: sorties = [] } = useSortiesAnticipees()
  const sortiesDuJour = useMemo(() => {
    const studentsById = new Map(getStudentsSnapshot().map((s) => [s.id, s]))
    return sorties
      .filter((s) => s.date === selectedDate)
      .map((s) => ({ sortie: s, student: studentsById.get(s.studentId) }))
      .filter(({ student }) => student && (selectedClasse === TOUTE_ETABLISSEMENT || student.classe === selectedClasse))
  }, [sorties, selectedDate, selectedClasse, students])

  const sortiesPrintRows = useMemo<SortiePrintRow[]>(
    () =>
      sortiesDuJour
        .filter(({ student }) => !!student)
        .map(({ sortie, student }) => ({
          studentName: student!.name,
          classe: student!.classe,
          heure: sortie.heure,
          recuperePar: sortie.recuperePar,
          motif: sortie.motif,
        })),
    [sortiesDuJour]
  )

  const handleExportExcel = () => {
    const tagged: { row: BilanRow; type: string; periode: string }[] = [
      ...absMatin.map((row) => ({ row, type: 'Absence', periode: 'Matin' })),
      ...absApresMidi.map((row) => ({ row, type: 'Absence', periode: 'Après-midi' })),
      ...retMatin.map((row) => ({ row, type: 'Retard', periode: 'Matin' })),
      ...retApresMidi.map((row) => ({ row, type: 'Retard', periode: 'Après-midi' })),
    ]
    const detailRows = tagged.map(({ row, type, periode }) => [
      row.studentName,
      row.classe,
      type,
      periode,
      formatHeures(row.totalMinutes / 60),
      row.motifs.join(', '),
      row.justified ? 'Justifié' : 'Injustifié',
    ])

    const cycleRows: (string | number)[][] = [[], [`RÉSUMÉ PAR CYCLE — ${selectedDate}`], ['Cycle', 'Classe', 'Effectif', 'Absences', 'Retards', 'Taux de présence']]
    cycleSummaries.forEach((cycle) => {
      cycleRows.push([cycle.label, 'Total du cycle', cycle.effectif, cycle.absences, cycle.retards, `${cycle.tauxPresence}%`])
      cycle.classes.forEach((c) => {
        cycleRows.push([cycle.label, c.classe, c.effectif, c.absences, c.retards, `${c.tauxPresence}%`])
      })
    })

    const classeSlug = selectedClasse === TOUTE_ETABLISSEMENT ? 'etablissement' : selectedClasse
    downloadCSV(
      `bilan-absences-${classeSlug}-${selectedDate}.csv`,
      ['Élève', 'Classe', 'Type', 'Période', 'Durée', 'Motif', 'Statut'],
      [...detailRows, ...cycleRows]
    )
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Absences & Retards
            <ClipboardList className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Consultation et édition des bilans journaliers d'assiduité par classe du Groupe Scolaire
            Mondrian.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exporter Excel
          </button>
          <button
            type="button"
            onClick={() => setShowBatchPrint(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Layers className="h-4 w-4" />
            {selectedClasse === TOUTE_ETABLISSEMENT ? "Dossiers Établissement Entier (Batch PDF)" : 'Dossiers Classe Entière (Batch PDF)'}
          </button>
          <button
            type="button"
            onClick={() => setShowBilanPrint(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            <Printer className="h-4 w-4" />
            Imprimer le Rapport Officiel (PDF)
          </button>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <CalendarDays className="h-3.5 w-3.5" />
              Date du Bilan
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="min-w-[220px]">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <MapPin className="h-3.5 w-3.5" />
              Périmètre / Classe
            </label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value={TOUTE_ETABLISSEMENT}>Toute l'établissement</option>
              {realClasses.map((c) => (
                <option key={c} value={c}>
                  Classe {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-indigo-700">
            VUE D'ENSEMBLE DE L'ÉCOLE PAR CYCLE — {new Date(selectedDate).toLocaleDateString('fr-FR')}
          </h3>
        </div>
        {cycleSummaries.length === 0 ? (
          <p className="text-sm italic text-slate-400">Aucune classe active à afficher.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cycleSummaries.map((cycle) => (
              <CycleSummaryCard key={cycle.key} cycle={cycle} />
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox
          label={selectedClasse === TOUTE_ETABLISSEMENT ? "Élèves de l'établissement" : 'Élèves de la classe'}
          value={effectif}
          color="text-slate-900"
        />
        <KpiBox label="Absences signalées" value={absencesSignalees} color="text-rose-500" />
        <KpiBox label="Retards signalés" value={retardsSignales} color="text-amber-500" />
        <KpiBox label="Taux de présence jour" value={`${tauxPresence}%`} color="text-emerald-500" />
      </div>

      <div className="mb-4 rounded-2xl border-l-4 border-l-rose-500 border-y border-r border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Circle className="h-3 w-3 fill-rose-500 text-rose-500" />
          <h3 className="text-sm font-bold text-rose-600">SECTION I : ABSENCES</h3>
        </div>

        <BilanBlock
          icon={Sunrise}
          iconColor="text-amber-500"
          label={`Matin (${toHeureFR(heureDebutMatin)} - ${toHeureFR(heureFinMatin)})`}
          rows={absMatin}
          unitLabel="d'absence"
          onToggle={toggleRow}
          isEditable={isEditable}
        />
        <BilanBlock
          icon={Sunset}
          iconColor="text-orange-500"
          label={`Après-midi (${toHeureFR(heureDebutApresMidi)} - ${toHeureFR(heureFinApresMidi)})`}
          rows={absApresMidi}
          unitLabel="d'absence"
          onToggle={toggleRow}
          isEditable={isEditable}
          last
        />
      </div>

      <div className="rounded-2xl border-l-4 border-l-amber-500 border-y border-r border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />
          <h3 className="text-sm font-bold text-amber-600">SECTION II : RETARDS</h3>
        </div>

        <BilanBlock
          icon={Sunrise}
          iconColor="text-amber-500"
          label={`Matin (${toHeureFR(heureDebutMatin)} - ${toHeureFR(heureFinMatin)})`}
          rows={retMatin}
          unitLabel="de retard"
          onToggle={toggleRow}
          isEditable={isEditable}
        />
        <BilanBlock
          icon={Sunset}
          iconColor="text-orange-500"
          label={`Après-midi (${toHeureFR(heureDebutApresMidi)} - ${toHeureFR(heureFinApresMidi)})`}
          rows={retApresMidi}
          unitLabel="de retard"
          onToggle={toggleRow}
          isEditable={isEditable}
          last
        />
      </div>

      <div className="mt-4 rounded-2xl border-l-4 border-l-sky-500 border-y border-r border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Circle className="h-3 w-3 fill-sky-500 text-sky-500" />
          <h3 className="text-sm font-bold text-sky-600">SECTION III : SORTIES ANTICIPÉES</h3>
        </div>
        {sortiesDuJour.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aucune sortie anticipée ce jour.</p>
        ) : (
          <div className="space-y-2">
            {sortiesDuJour.map(({ sortie, student }) => (
              <div key={sortie.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-sky-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {student?.name} <span className="font-normal text-slate-400">({student?.classe})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {sortie.heure} · Récupéré par {sortie.recuperePar}
                      {sortie.motif ? ` · ${sortie.motif}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {sortie.source === 'parent' && (
                    <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600">
                      Déclarée par le parent
                    </span>
                  )}
                  {sortie.heureRetour ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                      Revenu(e) à {sortie.heureRetour} ✓
                    </span>
                  ) : (
                    isEditable &&
                    (reintegrerSortieId === sortie.id ? (
                      <>
                        <input
                          type="time"
                          value={heureRetour}
                          onChange={(e) => setHeureRetour(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (student && heureRetour) {
                              reintegrerSortie.mutate({ id: sortie.id, studentId: student.id, heureRetour })
                              const identity = identities?.[student.id]
                              const transport = resolveStudentTransport(student, identity, transportLignes, chauffeurs, aides, capacite)
                              if (identity?.transport && transport.ligneSoirNom && !transport.soirParents) setRetourWhatsApp({ student, heure: heureRetour })
                            }
                            setReintegrerSortieId(null)
                          }}
                          disabled={!heureRetour}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setReintegrerSortieId(null)}
                          title="Annuler"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : confirmDeleteSortieId === sortie.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (student) deleteSortie.mutate({ id: sortie.id, studentId: student.id })
                            setConfirmDeleteSortieId(null)
                          }}
                          className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSortieId(null)}
                          title="Annuler"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setReintegrerSortieId(sortie.id)
                            setHeureRetour(nowHHMM())
                          }}
                          title="Réintégrer (l'élève est revenu finir sa journée)"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        >
                          <LogIn className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSortieId(sortie.id)}
                          title="Supprimer (déclarée par erreur)"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBilanPrint && (
        <AbsencesPrintPreviewModal
          classe={selectedClasse}
          date={selectedDate}
          absMatin={absMatin}
          absApresMidi={absApresMidi}
          retMatin={retMatin}
          retApresMidi={retApresMidi}
          sorties={sortiesPrintRows}
          cycleSummaries={printCycleSummaries}
          heureDebutMatin={heureDebutMatin}
          heureFinMatin={heureFinMatin}
          heureDebutApresMidi={heureDebutApresMidi}
          heureFinApresMidi={heureFinApresMidi}
          onClose={() => setShowBilanPrint(false)}
        />
      )}

      {showBatchPrint && (
        <ClasseDossiersPreviewModal classe={selectedClasse} students={classeStudents} onClose={() => setShowBatchPrint(false)} />
      )}

      {retourWhatsApp &&
        (() => {
          const identity = identities?.[retourWhatsApp.student.id]
          const transport = resolveStudentTransport(retourWhatsApp.student, identity, transportLignes, chauffeurs, aides, capacite)
          return (
            <TransportSortieWhatsAppModal
              mode="retour"
              studentName={retourWhatsApp.student.name}
              ligneSoirNom={transport.ligneSoirNom}
              chauffeurNom={transport.chauffeurSoir?.nom ?? null}
              chauffeurTel={transport.chauffeurSoir?.telephone ?? null}
              aideNom={transport.aideSoir?.nom ?? null}
              aideTel={transport.aideSoir?.telephone ?? null}
              groupeUrl={capacite?.transportWhatsappGroupeUrl ?? ''}
              message={buildRetourSortieAnticipeeTransportMessage({
                studentName: retourWhatsApp.student.name,
                sexe: retourWhatsApp.student.sexe,
                classe: retourWhatsApp.student.classe,
                ligneSoirNom: transport.ligneSoirNom,
                heure: retourWhatsApp.heure,
                date: selectedDate,
              })}
              onClose={() => setRetourWhatsApp(null)}
            />
          )
        })()}
    </div>
  )
}

function KpiBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function CycleSummaryCard({ cycle }: { cycle: CycleSummaryRow }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">{cycle.label}</p>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
          {cycle.effectif} élève{cycle.effectif > 1 ? 's' : ''}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-rose-500">{cycle.absences}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Absences</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-500">{cycle.retards}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Retards</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-500">{cycle.tauxPresence}%</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Présence</p>
        </div>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-50/60">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-2 py-1.5">Classe</th>
              <th className="px-2 py-1.5 text-center">Eff.</th>
              <th className="px-2 py-1.5 text-center">Abs.</th>
              <th className="px-2 py-1.5 text-center">Ret.</th>
              <th className="px-2 py-1.5 text-right">Taux</th>
            </tr>
          </thead>
          <tbody>
            {cycle.classes.map((c) => (
              <tr key={c.classe} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5 font-medium text-slate-700">{c.classe}</td>
                <td className="px-2 py-1.5 text-center text-slate-600">{c.effectif}</td>
                <td className={`px-2 py-1.5 text-center font-semibold ${c.absences > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {c.absences}
                </td>
                <td className={`px-2 py-1.5 text-center font-semibold ${c.retards > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {c.retards}
                </td>
                <td className="px-2 py-1.5 text-right text-slate-600">{c.tauxPresence}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BilanBlock({
  icon: Icon,
  iconColor,
  label,
  rows,
  unitLabel,
  onToggle,
  last,
  isEditable,
}: {
  icon: typeof Sunrise
  iconColor: string
  label: string
  rows: BilanRow[]
  unitLabel: string
  onToggle: (row: BilanRow) => void
  last?: boolean
  isEditable: boolean
}) {
  return (
    <div className={last ? '' : 'mb-4'}>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </p>
      {rows.length === 0 ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm italic text-slate-400">Aucun signalement enregistré.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-slate-50/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Élève</th>
                <th className="px-3 py-2">Classe</th>
                <th className="px-3 py-2">Durée totale {unitLabel}</th>
                <th className="px-3 py-2">Motif saisi</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{row.studentName}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">{row.classe}</span>
                  </td>
                  <td className={`px-3 py-2.5 font-bold ${unitLabel === "d'absence" ? 'text-rose-500' : 'text-amber-500'}`}>
                    {formatHeures(row.totalMinutes / 60)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{row.motifs.join(', ') || <span className="italic text-slate-400">Non justifié</span>}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      title={row.justified ? 'Rendre injustifié' : 'Marquer comme justifié'}
                      onClick={() => onToggle(row)}
                      disabled={!isEditable}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 ${
                        row.justified ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {row.justified ? <Check className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
