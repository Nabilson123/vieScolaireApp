import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Flag, GraduationCap, Handshake, CheckCircle, FileText, PenLine, Search, PlusCircle, Printer, FileSpreadsheet, Pencil, Trash2, Users, ClipboardList } from 'lucide-react'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import type { RendezVousRecord, CompteRenduRDV } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentRendezVous } from '../services/studentDetailsService'
import { isWithinPeriod } from '../utils/period'
import PlanifierRdvModal, { rdvFieldsFromPayload, type PlanifierRdvPayload } from '../components/PlanifierRdvModal'
import PartagerRdvModal from '../components/PartagerRdvModal'
import { buildRdvMessage } from '../utils/whatsapp'
import RedigerCompteRenduModal from '../components/RedigerCompteRenduModal'
import RdvCard from '../components/RdvCard'
import RdvPrintPreviewModal from '../components/rdv-print/RdvPrintPreviewModal'
import CompteRenduRdvPrintPreviewModal from '../components/rdv-print/CompteRenduRdvPrintPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import type { Evenement } from '../data/evenements'
import { useEvenements, useAddEvenement, useUpdateEvenement, useDeleteEvenement } from '../services/evenementsService'
import EvenementModal from '../components/EvenementModal'
import type { SuiviProf } from '../data/suiviProfs'
import { useSuiviProfs, useAddSuiviProf, useUpdateSuiviProf, useDeleteSuiviProf, useCompleteSuiviProf } from '../services/suiviProfsService'
import SuiviProfModal from '../components/SuiviProfModal'
import RedigerSuiviCompteRenduModal from '../components/RedigerSuiviCompteRenduModal'
import { getTeachersSnapshot } from '../services/teachersService'
import { teacherName } from '../data/teachers'
import SuiviClasseTab from '../components/suivi-classe/SuiviClasseTab'
import SuiviReunionTab from '../components/suivi-classe/SuiviReunionTab'

type PageTab = 'rdv' | 'evenements' | 'suivi' | 'classe' | 'reunion'

interface FlatRdv extends RendezVousRecord {
  id: string
  studentId: string
  studentName: string
  classe: string
}

function buildInitialMap(): Record<string, RendezVousRecord[]> {
  const map: Record<string, RendezVousRecord[]> = {}
  getStudentsSnapshot().forEach((s) => {
    map[s.id] = getStudentExtraSnapshot(s.id).rendezVous
  })
  return map
}

export default function RendezVousGlobal() {
  const queryClient = useQueryClient()
  // rdvMap est semé une fois depuis getStudentsSnapshot() (année-scopé) puis maintenu localement
  // en écriture optimiste : sans ce reset, changer d'année garderait les élèves de l'ancienne
  // année. Le déclencheur est la référence `students` (retournée par useStudents()), pas l'id de
  // l'année consultée : celui-ci change avant la fin du fetch réseau, donc un reset qui ne
  // dépendrait que de lui reseedrait trop tôt, avec les données encore périmées.
  const { data: students } = useStudents()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'appointments').canEdit
  const isEditable = canEditYear && canEditModule
  const [pageTab, setPageTab] = useState<PageTab>('rdv')
  const [reunionTarget, setReunionTarget] = useState<{ niveau: string; suiviId?: string } | null>(null)
  const [rdvMap, setRdvMap] = useState<Record<string, RendezVousRecord[]>>(buildInitialMap)
  useEffect(() => {
    setRdvMap(buildInitialMap())
  }, [students])
  const [search, setSearch] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [statutFilter, setStatutFilter] = useState('Tous')
  const [modeFilter, setModeFilter] = useState('Tous')
  const [showPlanifierModal, setShowPlanifierModal] = useState(false)
  const [editingItem, setEditingItem] = useState<FlatRdv | null>(null)
  const [crItem, setCrItem] = useState<FlatRdv | null>(null)
  const [crPrintItem, setCrPrintItem] = useState<FlatRdv | null>(null)
  const [share, setShare] = useState<{ message: string; justCreated: boolean } | null>(null)
  const [showPrint, setShowPrint] = useState(false)

  const flat: FlatRdv[] = useMemo(() => {
    const list: FlatRdv[] = []
    getStudentsSnapshot().forEach((s) => {
      ;(rdvMap[s.id] ?? []).forEach((r, idx) => {
        list.push({ ...r, id: `${s.id}-${idx}`, studentId: s.id, studentName: s.name, classe: s.classe })
      })
    })
    return list.sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [rdvMap, students])

  const filtered = flat.filter((r) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      r.studentName.toLowerCase().includes(q) ||
      r.enseignants.some((e) => e.toLowerCase().includes(q)) ||
      (r.animateur ?? '').toLowerCase().includes(q) ||
      r.lieu.toLowerCase().includes(q)
    const matchesPeriod = isWithinPeriod(r.date, periodStart, periodEnd)
    const matchesStatut = statutFilter === 'Tous' || r.statut === statutFilter
    const matchesMode = modeFilter === 'Tous' || r.mode === modeFilter
    return matchesSearch && matchesPeriod && matchesStatut && matchesMode
  })

  const planifies = filtered.filter((r) => r.statut === 'Planifié').length
  const realises = filtered.filter((r) => r.statut === 'Réalisé').length
  const comptesRendus = filtered.filter((r) => r.compteRendu).length
  const attenteSignature = filtered.filter((r) => r.compteRendu && !r.compteRendu.signeParent).length

  const persist = async (studentId: string, list: RendezVousRecord[]) => {
    await updateStudentRendezVous(studentId, list)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
  }

  const updateOne = async (studentId: string, id: string, updater: (r: RendezVousRecord) => RendezVousRecord) => {
    const list = (rdvMap[studentId] ?? []).map((r, idx) => (`${studentId}-${idx}` === id ? updater(r) : r))
    setRdvMap((prev) => ({ ...prev, [studentId]: list }))
    await persist(studentId, list)
  }

  const handleCreate = async (payload: PlanifierRdvPayload) => {
    const record: RendezVousRecord = { ...rdvFieldsFromPayload(payload), statut: 'Planifié' }
    const updated = [record, ...(rdvMap[payload.studentId] ?? [])]
    setRdvMap((prev) => ({ ...prev, [payload.studentId]: updated }))
    await persist(payload.studentId, updated)
    const student = getStudentsSnapshot().find((s) => s.id === payload.studentId)
    setShare({ message: buildRdvMessage({ studentName: student?.name ?? '', classe: student?.classe ?? '', record }), justCreated: true })
    setShowPlanifierModal(false)
  }

  const handleEditSubmit = async (payload: PlanifierRdvPayload) => {
    if (!editingItem) return
    await updateOne(editingItem.studentId, editingItem.id, (r) => ({ ...r, ...rdvFieldsFromPayload(payload) }))
    setEditingItem(null)
  }

  const handleCancel = async (item: FlatRdv) => {
    await updateOne(item.studentId, item.id, (r) => ({ ...r, statut: 'Annulé' }))
  }

  const handleDelete = async (item: FlatRdv) => {
    const list = (rdvMap[item.studentId] ?? []).filter((_, idx) => `${item.studentId}-${idx}` !== item.id)
    setRdvMap((prev) => ({ ...prev, [item.studentId]: list }))
    await persist(item.studentId, list)
  }

  const handleCompteRenduSubmit = async (compteRendu: CompteRenduRDV) => {
    if (!crItem) return
    await updateOne(crItem.studentId, crItem.id, (r) => ({ ...r, statut: 'Réalisé', compteRendu }))
    setCrItem(null)
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Rendez-vous Parents
            <CalendarClock className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Planifiez des rendez-vous physiques ou virtuels et rédigez des comptes-rendus tripartites avec les parents.
          </p>
        </div>

        {pageTab === 'rdv' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exporter Excel
            </button>
            <button
              type="button"
              onClick={() => setShowPrint(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Imprimer Rapport
            </button>
            <button
              type="button"
              onClick={() => setShowPlanifierModal(true)}
              disabled={!isEditable}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              Planifier
            </button>
          </div>
        )}
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            { key: 'rdv' as const, label: 'Rendez-vous', icon: CalendarClock },
            { key: 'evenements' as const, label: 'Événements', icon: Flag },
            { key: 'suivi' as const, label: 'Suivi Profs', icon: GraduationCap },
            { key: 'classe' as const, label: 'Suivi de Classe', icon: Users },
            { key: 'reunion' as const, label: 'Réunion de suivi de classe', icon: ClipboardList },
          ]
        ).map((t) => {
          const Icon = t.icon
          const isActive = pageTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPageTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {pageTab === 'evenements' && <EvenementsTab isEditable={isEditable} />}

      {pageTab === 'suivi' && <SuiviProfsTab isEditable={isEditable} />}

      {pageTab === 'classe' && (
        <SuiviClasseTab
          isEditable={isEditable}
          onGoToReunion={(niveau, suiviId) => {
            setReunionTarget({ niveau, suiviId })
            setPageTab('reunion')
          }}
        />
      )}

      {pageTab === 'reunion' && <SuiviReunionTab initialNiveau={reunionTarget?.niveau} initialSuiviId={reunionTarget?.suiviId} isEditable={isEditable} />}

      {pageTab === 'rdv' && (
      <>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Handshake} iconBg="bg-amber-50" iconColor="text-amber-500" value={planifies} label="RDV planifiés" />
        <KpiCard icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-500" value={realises} label="RDV réalisés" />
        <KpiCard icon={FileText} iconBg="bg-teal-50" iconColor="text-teal-500" value={comptesRendus} label="Comptes-rendus partagés" />
        <KpiCard icon={PenLine} iconBg="bg-amber-50" iconColor="text-amber-500" value={attenteSignature} label="Attente signature" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher élève, prof, lieu..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Période du :</span>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
          <span className="text-sm text-slate-500">au :</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Statut :</span>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Tous</option>
            <option>Planifié</option>
            <option>Réalisé</option>
            <option>Annulé</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Mode :</span>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Tous</option>
            <option>Présentiel</option>
            <option>Virtuel</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Aucun rendez-vous ne correspond à ces filtres.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <RdvCard
              key={item.id}
              record={item}
              studentName={item.studentName}
              classe={item.classe}
              onEdit={() => setEditingItem(item)}
              onCancel={() => handleCancel(item)}
              onDelete={() => handleDelete(item)}
              onRedigerCR={() => setCrItem(item)}
              onDownloadCR={() => setCrPrintItem(item)}
              onShare={() => setShare({ message: buildRdvMessage({ studentName: item.studentName, classe: item.classe, record: item }), justCreated: false })}
            />
          ))}
        </div>
      )}

      {showPlanifierModal && <PlanifierRdvModal onClose={() => setShowPlanifierModal(false)} onSubmit={handleCreate} />}

      {editingItem && (
        <PlanifierRdvModal
          onClose={() => setEditingItem(null)}
          onSubmit={handleEditSubmit}
          fixedStudentId={editingItem.studentId}
          initial={{
            studentId: editingItem.studentId,
            date: editingItem.date,
            heure: editingItem.heure,
            duree: editingItem.duree,
            mode: editingItem.mode,
            lieu: editingItem.lieu,
            motif: editingItem.motif,
            notesParents: editingItem.notesParents ?? '',
            enseignants: editingItem.enseignants,
            demandeur: editingItem.demandeur,
            animateur: editingItem.animateur,
          }}
        />
      )}

      {share && <PartagerRdvModal message={share.message} justCreated={share.justCreated} onClose={() => setShare(null)} />}

      {crItem && (
        <RedigerCompteRenduModal
          motif={crItem.motif}
          hasEnseignant={crItem.enseignants.length > 0}
          initial={crItem.compteRendu}
          onClose={() => setCrItem(null)}
          onSubmit={handleCompteRenduSubmit}
        />
      )}

      {showPrint && <RdvPrintPreviewModal records={filtered} onClose={() => setShowPrint(false)} />}

      {crPrintItem && (
        <CompteRenduRdvPrintPreviewModal
          record={crPrintItem}
          studentName={crPrintItem.studentName}
          classe={crPrintItem.classe}
          onClose={() => setCrPrintItem(null)}
        />
      )}
      </>
      )}
    </div>
  )
}

function EvenementsTab({ isEditable }: { isEditable: boolean }) {
  const { data: evenements = [] } = useEvenements()
  const addMutation = useAddEvenement()
  const updateMutation = useUpdateEvenement()
  const deleteMutation = useDeleteEvenement()

  const [search, setSearch] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Evenement | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const q = search.toLowerCase()
  const filtered = evenements
    .filter((e) => {
      const matchesSearch = !q || e.titre.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      const matchesPeriod = isWithinPeriod(e.date, periodStart, periodEnd)
      return matchesSearch && matchesPeriod
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const handleAdd = (data: { titre: string; date: string; heure?: string; description: string; classes: string[] }) => {
    addMutation.mutate(data)
    setShowModal(false)
  }

  const handleEditSubmit = (data: { titre: string; date: string; heure?: string; description: string; classes: string[] }) => {
    if (!editingItem) return
    updateMutation.mutate({ id: editingItem.id, ...data })
    setEditingItem(null)
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
    setConfirmingDeleteId(null)
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un événement..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Période du :</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            />
            <span className="text-sm text-slate-500">au :</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Ajouter un Événement
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Aucun événement ne correspond à ces filtres.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <Flag className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{e.titre}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {e.heure && ` à ${e.heure}`}
                  </p>
                  <span className="mt-1.5 inline-block rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                    {e.classes.length === 0 ? "Toute l'école" : e.classes.join(', ')}
                  </span>
                  {e.description && <p className="mt-2 max-w-xl text-sm text-slate-600">{e.description}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {confirmingDeleteId === e.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id)}
                      className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingItem(e)}
                      disabled={!isEditable}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(e.id)}
                      disabled={!isEditable}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <EvenementModal onClose={() => setShowModal(false)} onSubmit={handleAdd} />}
      {editingItem && (
        <EvenementModal
          onClose={() => setEditingItem(null)}
          onSubmit={handleEditSubmit}
          initial={{ titre: editingItem.titre, date: editingItem.date, heure: editingItem.heure, description: editingItem.description, classes: editingItem.classes }}
        />
      )}
    </>
  )
}

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: typeof Handshake
  iconBg: string
  iconColor: string
  value: string | number
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function SuiviProfsTab({ isEditable }: { isEditable: boolean }) {
  const { data: suivis = [] } = useSuiviProfs()
  const addMutation = useAddSuiviProf()
  const updateMutation = useUpdateSuiviProf()
  const deleteMutation = useDeleteSuiviProf()
  const completeMutation = useCompleteSuiviProf()
  const allTeachers = getTeachersSnapshot()

  const [search, setSearch] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<SuiviProf | null>(null)
  const [crItem, setCrItem] = useState<SuiviProf | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const teacherNamesFor = (teacherIds: string[]) =>
    teacherIds.map((id) => allTeachers.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t).map(teacherName)

  const q = search.toLowerCase()
  const filtered = suivis
    .filter((sp) => {
      const noms = teacherNamesFor(sp.teacherIds).join(' ').toLowerCase()
      const matchesSearch = !q || noms.includes(q) || sp.motif.toLowerCase().includes(q) || sp.lieu.toLowerCase().includes(q)
      const matchesPeriod = isWithinPeriod(sp.date, periodStart, periodEnd)
      return matchesSearch && matchesPeriod
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  // dataList a plus d'un élément uniquement pour une série récurrente ("temps dédié par semaine") —
  // un ponctuel ou une édition en envoie toujours exactement un.
  const handleAdd = (dataList: { teacherIds: string[]; date: string; heure: string; duree: number; lieu: string; motif: string; notes: string; niveau?: string }[]) => {
    dataList.forEach((data) => addMutation.mutate(data))
    setShowModal(false)
  }

  const handleEditSubmit = (dataList: { teacherIds: string[]; date: string; heure: string; duree: number; lieu: string; motif: string; notes: string; niveau?: string }[]) => {
    if (!editingItem) return
    const data = dataList[0]
    if (data) updateMutation.mutate({ id: editingItem.id, ...data })
    setEditingItem(null)
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
    setConfirmingDeleteId(null)
  }

  const handleCrSubmit = (notes: string) => {
    if (!crItem) return
    completeMutation.mutate({ id: crItem.id, notes })
    setCrItem(null)
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher prof, motif, lieu..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Période du :</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            />
            <span className="text-sm text-slate-500">au :</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Planifier un Suivi
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Aucun suivi prof ne correspond à ces filtres.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sp) => (
            <div key={sp.id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <GraduationCap className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{teacherNamesFor(sp.teacherIds).join(', ') || 'Prof supprimé'}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(sp.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {sp.heure} ({sp.duree} min)
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        sp.statut === 'Réalisé' ? 'bg-emerald-50 text-emerald-600' : sp.statut === 'Annulé' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {sp.statut}
                    </span>
                    {sp.lieu && <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">{sp.lieu}</span>}
                    {sp.niveau && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-600">Niveau {sp.niveau}</span>}
                  </div>
                  <p className="mt-2 max-w-xl text-sm text-slate-600">{sp.motif}</p>
                  {sp.notes && (
                    <div className="mt-2 max-w-xl rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                        <FileText className="h-3 w-3" />
                        Compte-rendu
                      </p>
                      <p className="text-xs text-slate-600">{sp.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {confirmingDeleteId === sp.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(sp.id)}
                      className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    {sp.statut !== 'Annulé' && (
                      <button
                        type="button"
                        onClick={() => setCrItem(sp)}
                        disabled={!isEditable}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sp.notes ? 'Modifier le C.R.' : 'Rédiger le C.R.'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingItem(sp)}
                      disabled={!isEditable}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(sp.id)}
                      disabled={!isEditable}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {crItem && <RedigerSuiviCompteRenduModal initial={crItem.notes} onClose={() => setCrItem(null)} onSubmit={handleCrSubmit} />}

      {showModal && <SuiviProfModal onClose={() => setShowModal(false)} onSubmit={handleAdd} />}
      {editingItem && (
        <SuiviProfModal
          onClose={() => setEditingItem(null)}
          onSubmit={handleEditSubmit}
          initial={{
            teacherIds: editingItem.teacherIds,
            date: editingItem.date,
            heure: editingItem.heure,
            duree: editingItem.duree,
            lieu: editingItem.lieu,
            motif: editingItem.motif,
            notes: editingItem.notes,
            niveau: editingItem.niveau,
          }}
        />
      )}
    </>
  )
}

