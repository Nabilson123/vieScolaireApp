import { useState } from 'react'
import { X, CalendarClock } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { buildStaffOptions } from '../utils/staffOptions'
import type { RdvDemandeur, RdvDemandeurType, RendezVousRecord } from '../data/studentDetails'

export interface PlanifierRdvPayload {
  studentId: string
  date: string
  heure: string
  duree: number
  mode: 'Présentiel' | 'Virtuel'
  lieu: string
  motif: string
  notesParents: string
  enseignants: string[]
  demandeur?: RdvDemandeur
  animateur?: string
}

/** Champs du rendez-vous communs à la création et à la modification — un seul endroit pour les
 * recopier du formulaire vers l'enregistrement (création/édition, 3 écrans). */
export function rdvFieldsFromPayload(payload: PlanifierRdvPayload): Omit<RendezVousRecord, 'statut' | 'compteRendu'> {
  return {
    date: payload.date,
    heure: payload.heure,
    duree: payload.duree,
    mode: payload.mode,
    lieu: payload.lieu,
    motif: payload.motif,
    notesParents: payload.notesParents || undefined,
    enseignants: payload.enseignants,
    demandeur: payload.demandeur,
    animateur: payload.animateur || undefined,
  }
}

interface PlanifierRdvModalProps {
  onClose: () => void
  onSubmit: (payload: PlanifierRdvPayload) => void
  fixedStudentId?: string
  initial?: PlanifierRdvPayload
  /** Motif proposé pour un NOUVEAU rendez-vous (ex. depuis une réclamation). */
  prefillMotif?: string
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const DUREE_OPTIONS = [15, 30, 45, 60]

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none'

export default function PlanifierRdvModal({ onClose, onSubmit, fixedStudentId, initial, prefillMotif }: PlanifierRdvModalProps) {
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const staffNames = getTeachersSnapshot()
    .map((t) => teacherName(t))
    .sort((a, b) => a.localeCompare(b))

  const fixedStudent = fixedStudentId ? getStudentsSnapshot().find((s) => s.id === fixedStudentId) : undefined

  const [classe, setClasse] = useState(fixedStudent?.classe ?? realClasses[0])
  const [studentId, setStudentId] = useState(initial?.studentId ?? fixedStudentId ?? '')
  const [enseignants, setEnseignants] = useState<string[]>(initial?.enseignants ?? [])
  const [filtreEnseignant, setFiltreEnseignant] = useState('')
  // Rencontre purement administrative (direction/CPE avec la famille, sans prof concerné) : la liste
  // d'enseignants reste vide, seule la validation change.
  const [adminSeulement, setAdminSeulement] = useState(!!initial && initial.enseignants.length === 0)
  const [demandeurType, setDemandeurType] = useState<RdvDemandeurType | ''>(initial?.demandeur?.type ?? '')
  const [demandeurNom, setDemandeurNom] = useState(initial?.demandeur?.type === 'enseignant' || initial?.demandeur?.type === 'autre' ? initial.demandeur.nom : '')
  const [animateur, setAnimateur] = useState(initial?.animateur ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [heure, setHeure] = useState(initial?.heure ?? '10:00')
  const [duree, setDuree] = useState(initial?.duree ?? 30)
  const [mode, setMode] = useState<'Présentiel' | 'Virtuel'>(initial?.mode ?? 'Présentiel')
  const [lieu, setLieu] = useState(initial?.lieu ?? '')
  const [motif, setMotif] = useState(initial?.motif ?? prefillMotif ?? '')
  const [notesParents, setNotesParents] = useState(initial?.notesParents ?? '')

  const elevesDeLaClasse = fixedStudent ? [fixedStudent] : getStudentsSnapshot().filter((s) => s.classe === classe)

  const identity = studentId ? getStudentIdentitySnapshot(studentId) : undefined
  const parent1Nom = identity?.parent1Nom.trim() ?? ''
  const parent2Nom = identity?.parent2Nom.trim() ?? ''

  const animateurOptions = buildStaffOptions(animateur)

  const nomsAffiches = Array.from(new Set([...staffNames, ...enseignants])).sort((a, b) => a.localeCompare(b))
  const nomsFiltres = nomsAffiches.filter((n) => n.toLowerCase().includes(filtreEnseignant.trim().toLowerCase()))

  const toggleEnseignant = (name: string) => {
    setEnseignants((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const isEdit = !!initial

  const buildDemandeur = (): RdvDemandeur | undefined => {
    switch (demandeurType) {
      case 'parent1':
        return { type: 'parent1', nom: parent1Nom }
      case 'parent2':
        return { type: 'parent2', nom: parent2Nom }
      case 'administration':
        return { type: 'administration', nom: '' }
      case 'enseignant':
      case 'autre':
        return demandeurNom.trim() ? { type: demandeurType, nom: demandeurNom.trim() } : undefined
      default:
        return undefined
    }
  }

  const canSubmit = !!studentId && (adminSeulement || enseignants.length > 0) && !!lieu.trim() && !!motif.trim()

  const handleSubmit = () => {
    if (!canSubmit || !date || !heure) return
    onSubmit({
      studentId,
      date,
      heure,
      duree,
      mode,
      lieu: lieu.trim(),
      motif: motif.trim(),
      notesParents: notesParents.trim(),
      enseignants: adminSeulement ? [] : enseignants,
      demandeur: buildDemandeur(),
      animateur: animateur || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CalendarClock className="h-5 w-5 text-indigo-500" />
            {isEdit ? 'Modifier le Rendez-vous' : 'Planifier un Rendez-vous'}
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
          {!fixedStudent && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Filtrer par Classe</label>
                <select
                  value={classe}
                  onChange={(e) => {
                    setClasse(e.target.value)
                    setStudentId('')
                  }}
                  className={inputClass}
                >
                  {realClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élève concerné*</label>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputClass}>
                  <option value="">Sélectionnez un élève...</option>
                  {elevesDeLaClasse.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Rendez-vous demandé par</label>
            <select value={demandeurType} onChange={(e) => setDemandeurType(e.target.value as RdvDemandeurType | '')} className={inputClass}>
              <option value="">Non précisé</option>
              {parent1Nom && <option value="parent1">Parent 1 — {parent1Nom}</option>}
              {parent2Nom && <option value="parent2">Parent 2 — {parent2Nom}</option>}
              <option value="administration">Administration</option>
              <option value="enseignant">Un enseignant</option>
              <option value="autre">Autre (saisie libre)</option>
            </select>
            {demandeurType === 'enseignant' && (
              <select value={demandeurNom} onChange={(e) => setDemandeurNom(e.target.value)} className={`${inputClass} mt-2`}>
                <option value="">Sélectionnez l'enseignant demandeur...</option>
                {staffNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            {demandeurType === 'autre' && (
              <input
                type="text"
                value={demandeurNom}
                onChange={(e) => setDemandeurNom(e.target.value)}
                placeholder="ex: Grand-mère de l'élève, Inspecteur..."
                className={`${inputClass} mt-2`}
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
              <span>Enseignants concernés{adminSeulement ? '' : '*'}</span>
              {!adminSeulement && <span className="text-xs font-medium text-slate-400">{enseignants.length} sélectionné(s)</span>}
            </label>
            <input
              type="text"
              value={filtreEnseignant}
              onChange={(e) => setFiltreEnseignant(e.target.value)}
              disabled={adminSeulement}
              placeholder="Rechercher un enseignant..."
              className={`${inputClass} mb-1.5 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
            />
            <div className={`max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-1 ${adminSeulement ? 'opacity-50' : ''}`}>
              {nomsFiltres.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-slate-400">Aucun enseignant trouvé.</p>
              ) : (
                nomsFiltres.map((name) => (
                  <label key={name} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={enseignants.includes(name)}
                      onChange={() => toggleEnseignant(name)}
                      disabled={adminSeulement}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    {name}
                  </label>
                ))
              )}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={adminSeulement}
                onChange={(e) => {
                  setAdminSeulement(e.target.checked)
                  if (e.target.checked) setEnseignants([])
                }}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              Rencontre avec l'administration seulement (aucun enseignant concerné)
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Administration — personne qui anime le rendez-vous</label>
            <select value={animateur} onChange={(e) => setAnimateur(e.target.value)} className={inputClass}>
              <option value="">Non précisé</option>
              {animateurOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date*</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure (HH:MM)*</label>
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Durée*</label>
              <select value={duree} onChange={(e) => setDuree(Number(e.target.value))} className={inputClass}>
                {DUREE_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} minutes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mode de rencontre*</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as 'Présentiel' | 'Virtuel')} className={inputClass}>
                <option value="Présentiel">Présentiel</option>
                <option value="Virtuel">Virtuel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Lieu de rencontre / Lien Visioconférence*</label>
            <input
              type="text"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="ex: Salle 4, ou lien de visioconférence"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motif / Objet du rendez-vous*</label>
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="ex: Difficultés d'assiduité, Bilan d'orientation..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Demandes ou notes des parents (Optionnel)</label>
            <textarea
              value={notesParents}
              onChange={(e) => setNotesParents(e.target.value)}
              rows={2}
              placeholder="ex: Souhaite parler du comportement aux récréations..."
              className={inputClass}
            />
          </div>
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
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
