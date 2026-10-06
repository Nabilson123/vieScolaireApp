import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { HeartPulse, PlusCircle, Search, AlertTriangle, BookOpen, ShieldAlert, Pencil, Clock, Pill, Trash2 } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import type { PAIInfo, InfirmerieVisit } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentSante } from '../services/studentDetailsService'
import NewInfirmerieVisitModal from '../components/NewInfirmerieVisitModal'
import ManagePAIModal from '../components/ManagePAIModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface FlatVisit extends InfirmerieVisit {
  /** Position du passage dans la liste de l'élève : il n'a pas d'identifiant propre. */
  index: number
  studentId: string
  studentName: string
  classe: string
}

interface FlatPAI extends PAIInfo {
  studentId: string
  studentName: string
  classe: string
}

function buildInitialVisitsMap(): Record<string, InfirmerieVisit[]> {
  const map: Record<string, InfirmerieVisit[]> = {}
  getStudentsSnapshot().forEach((s) => {
    map[s.id] = getStudentExtraSnapshot(s.id).sante.visits
  })
  return map
}

function buildInitialPaiMap(): Record<string, PAIInfo | undefined> {
  const map: Record<string, PAIInfo | undefined> = {}
  getStudentsSnapshot().forEach((s) => {
    map[s.id] = getStudentExtraSnapshot(s.id).sante.pai
  })
  return map
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function InfirmerieGlobal() {
  const queryClient = useQueryClient()
  // visitsMap/paiMap sont semés une fois depuis getStudentsSnapshot() (année-scopé) puis
  // maintenus localement en écriture optimiste : sans ce reset, changer d'année garderait
  // les élèves de l'ancienne année. Le déclencheur est la référence `students` (retournée par
  // useStudents()), pas l'id de l'année consultée : celui-ci change avant la fin du fetch réseau.
  const { data: students } = useStudents()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'infirmerie').canEdit
  const isEditable = canEditYear && canEditModule
  const [visitsMap, setVisitsMap] = useState<Record<string, InfirmerieVisit[]>>(buildInitialVisitsMap)
  const [paiMap, setPaiMap] = useState<Record<string, PAIInfo | undefined>>(buildInitialPaiMap)
  useEffect(() => {
    setVisitsMap(buildInitialVisitsMap())
    setPaiMap(buildInitialPaiMap())
  }, [students])
  const [search, setSearch] = useState('')
  const [classe, setClasse] = useState('Toutes les classes')
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [editingVisit, setEditingVisit] = useState<FlatVisit | null>(null)
  // Suppression en deux temps : un premier clic demande confirmation sur la ligne.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingPai, setEditingPai] = useState<{ studentId: string; pai: PAIInfo } | null>(null)
  const [showNewPai, setShowNewPai] = useState(false)

  const flatVisits: FlatVisit[] = useMemo(() => {
    const list: FlatVisit[] = []
    getStudentsSnapshot().forEach((s) => {
      ;(visitsMap[s.id] ?? []).forEach((v, index) => {
        list.push({ ...v, index, studentId: s.id, studentName: s.name, classe: s.classe })
      })
    })
    return list.sort((a, b) => (a.date + a.heure < b.date + b.heure ? 1 : -1))
  }, [visitsMap, students])

  const flatPai: FlatPAI[] = useMemo(() => {
    return getStudentsSnapshot()
      .filter((s) => paiMap[s.id])
      .map((s) => ({ ...(paiMap[s.id] as PAIInfo), studentId: s.id, studentName: s.name, classe: s.classe }))
  }, [paiMap, students])

  const filteredVisits = flatVisits.filter((v) => {
    const matchesClasse = classe === 'Toutes les classes' || v.classe === classe
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      v.studentName.toLowerCase().includes(q) ||
      v.motif.toLowerCase().includes(q) ||
      v.action.toLowerCase().includes(q)
    return matchesClasse && matchesSearch
  })

  const filteredPai = flatPai.filter((p) => {
    const matchesClasse = classe === 'Toutes les classes' || p.classe === classe
    const q = search.toLowerCase()
    const matchesSearch = !q || p.studentName.toLowerCase().includes(q) || p.condition.toLowerCase().includes(q)
    return matchesClasse && matchesSearch
  })

  const alertesPaiCount = flatPai.length
  const passagesAujourdhui = flatVisits.filter((v) => v.date === todayISO()).length

  const handleNewVisit = async (payload: { studentId: string; motif: string; action: string; date: string; heure: string }) => {
    const updated = [
      ...(visitsMap[payload.studentId] ?? []),
      { date: payload.date, heure: payload.heure, motif: payload.motif, action: payload.action, auteur: 'Nabil LAHRACHE' },
    ]
    setVisitsMap((prev) => ({ ...prev, [payload.studentId]: updated }))
    await updateStudentSante(payload.studentId, { pai: paiMap[payload.studentId], visits: updated })
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setShowVisitModal(false)
  }

  const saveVisits = async (studentId: string, visits: InfirmerieVisit[]) => {
    setVisitsMap((prev) => ({ ...prev, [studentId]: visits }))
    await updateStudentSante(studentId, { pai: paiMap[studentId], visits })
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
  }

  const handleEditVisit = async (target: FlatVisit, payload: { motif: string; action: string; date: string; heure: string }) => {
    const visits = (visitsMap[target.studentId] ?? []).map((v, i) => (i === target.index ? { ...v, date: payload.date, heure: payload.heure, motif: payload.motif, action: payload.action } : v))
    await saveVisits(target.studentId, visits)
    setEditingVisit(null)
  }

  const handleDeleteVisit = async (target: FlatVisit) => {
    const visits = (visitsMap[target.studentId] ?? []).filter((_, i) => i !== target.index)
    setConfirmDelete(null)
    await saveVisits(target.studentId, visits)
  }

  const handleSavePai = async (studentId: string, pai: PAIInfo) => {
    setPaiMap((prev) => ({ ...prev, [studentId]: pai }))
    await updateStudentSante(studentId, { pai, visits: visitsMap[studentId] ?? [] })
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setEditingPai(null)
    setShowNewPai(false)
  }

  const handleRemovePai = async (studentId: string) => {
    setPaiMap((prev) => ({ ...prev, [studentId]: undefined }))
    await updateStudentSante(studentId, { pai: undefined, visits: visitsMap[studentId] ?? [] })
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setEditingPai(null)
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50">
            <HeartPulse className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Infirmerie & Santé</h1>
            <p className="max-w-xl text-sm text-slate-500">
              Suivi médical, registre journalier des soins et alertes PAI de l'établissement.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowVisitModal(true)}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Nouveau Passage Infirmerie
        </button>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            {getClassOptions().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex min-w-[240px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher élève, motif, soin..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            {alertesPaiCount} Alertes PAI
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-indigo-600">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            {passagesAujourdhui} Passages aujourd'hui
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Alertes PAI Actives
            </h3>
            <button
              type="button"
              onClick={() => setShowNewPai(true)}
              disabled={!isEditable}
              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Ajouter
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Projets d'Accueil Individualisés avec protocoles d'urgence médicale.
          </p>

          {filteredPai.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucune alerte PAI.</p>
          ) : (
            <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {filteredPai.map((p) => (
                <div
                  key={p.studentId}
                  className={`rounded-xl border-l-4 bg-white p-3 shadow-sm ${
                    p.niveau === 'CRITIQUE' ? 'border-l-rose-500' : 'border-l-amber-400'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{p.studentName}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.niveau === 'CRITIQUE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {p.niveau === 'CRITIQUE' ? '⚠ CRITIQUE' : 'MODÉRÉ'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingPai({ studentId: p.studentId, pai: p })}
                        disabled={!isEditable}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <span className="mb-2 inline-block rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                    {p.classe}
                  </span>
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-rose-600">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {p.condition}
                  </p>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                      <BookOpen className="h-3 w-3" />
                      Protocole d'Urgence :
                    </p>
                    <p className="text-xs text-slate-600">{p.protocole}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BookOpen className="h-4 w-4 text-slate-400" />
            Registre des Visites & Soins
          </h3>
          <p className="mb-4 text-xs text-slate-500">Historique des passages chronologiques à l'infirmerie.</p>

          {filteredVisits.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun passage enregistré.</p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Heure</th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Élève & Classe
                    </th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Motif de la visite
                    </th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Action / Soin apporté
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map((v) => (
                    <tr key={`${v.studentId}-${v.index}`} className="border-b border-slate-50 last:border-0 align-top">
                      <td className="py-3 pr-2 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {v.heure}
                        </span>
                        <span className="block text-xs text-slate-400">{v.date}</span>
                        <div className="mt-1.5">
                          {confirmDelete === `${v.studentId}-${v.index}` ? (
                            <div className="flex flex-col items-stretch gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteVisit(v)}
                                className="rounded-md bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600"
                              >
                                Supprimer
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingVisit(v)}
                                disabled={!isEditable}
                                title="Modifier ce passage"
                                aria-label="Modifier ce passage"
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(`${v.studentId}-${v.index}`)}
                                disabled={!isEditable}
                                title="Supprimer ce passage"
                                aria-label="Supprimer ce passage"
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <p className="text-sm font-semibold text-slate-900">{v.studentName}</p>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                          {v.classe}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                          {v.motif}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
                          <Pill className="h-3.5 w-3.5 shrink-0" />
                          {v.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showVisitModal && (
        <NewInfirmerieVisitModal onClose={() => setShowVisitModal(false)} onSubmit={handleNewVisit} />
      )}

      {editingVisit && (
        <NewInfirmerieVisitModal
          initial={{ studentId: editingVisit.studentId, motif: editingVisit.motif, action: editingVisit.action, date: editingVisit.date, heure: editingVisit.heure }}
          onClose={() => setEditingVisit(null)}
          onSubmit={(payload) => handleEditVisit(editingVisit, payload)}
        />
      )}

      {editingPai && (
        <ManagePAIModal
          initial={editingPai}
          onClose={() => setEditingPai(null)}
          onSubmit={handleSavePai}
          onRemove={handleRemovePai}
        />
      )}

      {showNewPai && <ManagePAIModal onClose={() => setShowNewPai(false)} onSubmit={handleSavePai} />}
    </div>
  )
}
