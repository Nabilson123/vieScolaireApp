import { useState } from 'react'
import { X, FileText, AlertTriangle, Trash2, Megaphone } from 'lucide-react'
import { teacherName } from '../../data/teachers'
import type { SuiviProf } from '../../data/suiviProfs'
import type { SuiviClasseAction } from '../../data/suiviClasseActions'
import type { RiskStudent, OpenReclamation } from '../../utils/suiviClasseRisqueAggregation'
import { findPPConflicts, generateWeeklyDates } from '../../utils/suiviProfsAggregation'
import { minutesToTime, timeToMinutes } from '../../data/classSchedules'
import { JOUR_LABELS, weekdayLabelFromDate } from './SuiviClasseTab'
import type { LogicalGroup } from '../../utils/suiviClasseGroups'
import { hasCompteRenduContent } from '../../data/suiviCompteRendu'

const STATUT_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  Planifié: { label: 'Planifié', bg: '#ede9fe', fg: '#7c3aed' },
  Réalisé: { label: 'Réalisé', bg: '#dcfce7', fg: '#15803d' },
  Annulé: { label: 'Annulé', bg: '#fee2e2', fg: '#dc2626' },
}

const RECLAMATION_STATUT_STYLE: Record<OpenReclamation['statut'], { bg: string; fg: string }> = {
  'En attente': { bg: '#fef3c7', fg: '#b45309' },
  'En cours': { bg: '#dbeafe', fg: '#1d4ed8' },
  Résolue: { bg: '#dcfce7', fg: '#15803d' },
}

interface SuiviClasseDrawerProps {
  group: LogicalGroup
  weekSuivi?: SuiviProf
  directionName: string
  riskStudents: RiskStudent[]
  reclamations: OpenReclamation[]
  actions: SuiviClasseAction[]
  isEditable: boolean
  onClose: () => void
  onGoToReunion: () => void
  onCancel: () => void
  onAddAction: (input: { texte: string; ownerName: string; echeance?: string }) => void
  onToggleAction: (id: string, statut: SuiviClasseAction['statut']) => void
  onDeleteAction: (id: string) => void
}

export default function SuiviClasseDrawer({
  group,
  weekSuivi,
  directionName,
  riskStudents,
  reclamations,
  actions,
  isEditable,
  onClose,
  onGoToReunion,
  onCancel,
  onAddAction,
  onToggleAction,
  onDeleteAction,
}: SuiviClasseDrawerProps) {
  const [newTexte, setNewTexte] = useState('')
  const [newOwner, setNewOwner] = useState(directionName)
  const [newEcheance, setNewEcheance] = useState('')

  // Créneau de référence pour la disponibilité : le suivi réellement planifié cette semaine, sinon
  // le créneau suggéré (projeté sur sa prochaine occurrence), sinon aucune disponibilité affichée.
  const slot = weekSuivi
    ? { date: weekSuivi.date, heure: weekSuivi.heure, duree: weekSuivi.duree, id: weekSuivi.id as string | undefined }
    : group.suggestion
      ? { date: generateWeeklyDates(group.suggestion.jour, 1)[0], heure: group.suggestion.start, duree: 30, id: undefined }
      : null

  const owners = [...group.teachers.map(teacherName), directionName]
  const people = [
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
  ].map((p) => {
    if (!slot) return { ...p, avail: '', availC: '' }
    const teacher = group.teachers.find((t) => teacherName(t) === p.name)
    if (!teacher) return { ...p, avail: '', availC: '' }
    const conflicts = findPPConflicts([teacher], slot.date, slot.heure, slot.duree, slot.id)
    return conflicts.length > 0
      ? { ...p, avail: `Indisponible ${conflicts[0].busyStart}–${conflicts[0].busyEnd}`, availC: '#dc2626' }
      : { ...p, avail: 'Disponible', availC: '#15803d' }
  })

  const status = weekSuivi ? STATUT_STYLE[weekSuivi.statut] : group.allHavePP ? { label: 'À planifier', bg: '#ede9fe', fg: '#7c3aed' } : { label: 'PP incomplet', bg: '#fef3c7', fg: '#d97706' }

  const whenLabel = weekSuivi
    ? `${weekdayLabelFromDate(weekSuivi.date)} ${new Date(weekSuivi.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · ${weekSuivi.heure}–${minutesToTime(
        timeToMinutes(weekSuivi.heure) + weekSuivi.duree
      )}`
    : group.suggestion
      ? `Créneau suggéré : ${JOUR_LABELS[group.suggestion.jour]} ${group.suggestion.start}–${group.suggestion.end}`
      : 'Aucun créneau disponible cette semaine'

  const handleAddAction = () => {
    if (!newTexte.trim()) return
    onAddAction({ texte: newTexte.trim(), ownerName: newOwner, echeance: newEcheance || undefined })
    setNewTexte('')
    setNewEcheance('')
  }

  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <div
      className="fixed right-4 top-20 z-30 flex max-h-[85vh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-8 sm:w-[380px]"
      style={{ boxShadow: '-16px 16px 40px rgba(15,23,42,.14)' }}
    >
      <div className="flex flex-col gap-1.5 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: group.color }} />
          <span className="text-lg font-bold text-slate-900">Suivi {group.label}</span>
          <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: status.bg, color: status.fg }}>
            {status.label}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="text-sm font-semibold text-violet-700">{whenLabel}</span>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Participants</span>
          {people.map((p) => (
            <div key={p.name} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[11px] font-bold text-violet-700">
                {p.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                <p className="truncate text-xs text-slate-500">{p.role}</p>
              </div>
              {p.avail && (
                <span className="text-right text-[11px] font-semibold" style={{ color: p.availC }}>
                  {p.avail}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Élèves à risque · remontés automatiquement</span>
          {riskStudents.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun élève signalé pour ce niveau.</p>
          ) : (
            riskStudents.map((r) => (
              <div key={r.id} className="flex flex-col gap-0.5 rounded-lg border border-rose-100 bg-rose-50/40 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                  <span className="text-xs text-slate-500">{r.classe}</span>
                </div>
                <p className="pl-3.5 text-xs text-slate-500">{r.reasons.join(' · ')}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Megaphone className="h-3 w-3" />
            Réclamations ouvertes
          </span>
          {reclamations.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune réclamation ouverte pour ce niveau.</p>
          ) : (
            reclamations.map((r, i) => (
              <div key={i} className="flex flex-col gap-0.5 rounded-lg border border-amber-100 bg-amber-50/40 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{r.studentName}</span>
                  <span className="text-xs text-slate-500">{r.classe}</span>
                  <span className="flex-1" />
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: RECLAMATION_STATUT_STYLE[r.statut].bg, color: RECLAMATION_STATUT_STYLE[r.statut].fg }}
                  >
                    {r.statut}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {r.type} — {r.objet} · {new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Compte-rendu</span>
          {weekSuivi ? (
            <>
              <p className="text-sm text-slate-600">
                {hasCompteRenduContent(weekSuivi.compteRendu) ? 'Un compte-rendu a déjà été rédigé pour ce suivi.' : 'Aucun compte-rendu enregistré.'}
              </p>
              <button
                type="button"
                onClick={onGoToReunion}
                disabled={!isEditable}
                className="self-start rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {hasCompteRenduContent(weekSuivi.compteRendu) ? 'Modifier le compte-rendu' : 'Rédiger le compte-rendu'}
              </button>
              {weekSuivi.statut === 'Planifié' && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={!isEditable}
                  className="self-start text-xs font-medium text-slate-400 hover:text-rose-500 disabled:cursor-not-allowed"
                >
                  Annuler ce suivi
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">Aucun suivi planifié cette semaine pour ce niveau.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Actions</span>
          {actions.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune action pour ce niveau.</p>
          ) : (
            actions.map((a) => {
              const done = a.statut === 'faite'
              const overdue = !done && a.echeance && a.echeance < todayIso
              return (
                <div key={a.id} className="flex items-start gap-2 border-t border-slate-100 py-2 first:border-t-0 first:pt-0">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => onToggleAction(a.id, done ? 'a_faire' : 'faite')}
                    disabled={!isEditable}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{a.texte}</p>
                    <p className={`text-xs ${overdue ? 'text-rose-500' : 'text-slate-500'}`}>
                      {a.ownerName}
                      {a.echeance && ` · échéance ${new Date(a.echeance + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => onDeleteAction(a.id)} disabled={!isEditable} className="text-slate-300 hover:text-rose-500 disabled:cursor-not-allowed">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })
          )}

          <div className="mt-1 flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="text-xs font-semibold text-slate-600">Nouvelle action</span>
            <input
              value={newTexte}
              onChange={(e) => setNewTexte(e.target.value)}
              placeholder="Ex. Appeler les parents de…"
              disabled={!isEditable}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            <div className="flex gap-1.5">
              <select
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                disabled={!isEditable}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newEcheance}
                onChange={(e) => setNewEcheance(e.target.value)}
                disabled={!isEditable}
                className="w-[124px] shrink-0 rounded-md border border-slate-200 px-1.5 py-1.5 text-xs text-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={handleAddAction}
              disabled={!isEditable || !newTexte.trim()}
              className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ajouter l'action
            </button>
          </div>
        </div>

        {!group.allHavePP && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Certaines divisions n'ont pas encore de Professeur Principal assigné.
          </div>
        )}
        {!slot && group.allHavePP && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-500">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            Aucun créneau commun libre cette semaine pour ce niveau.
          </div>
        )}
      </div>
    </div>
  )
}
