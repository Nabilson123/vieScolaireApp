import { useState } from 'react'
import { Repeat, CalendarDays, Grid3x3, ListChecks, History } from 'lucide-react'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import type { RemplacementRecord } from '../data/teacherExtras'
import { useTeacherExtras, useUpdateTeacherRemplacements, useUpdateTeacherAbsences } from '../services/teacherExtrasService'
import { getPendingReplacements, getIgnoredGaps, getAllRemplacementsFlat, getCreneauRemplacement, type PendingReplacement } from '../utils/replacementAggregation'
import ReplacementScheduleTab from '../components/replacements/ReplacementScheduleTab'
import OccupancyGridTab from '../components/replacements/OccupancyGridTab'
import ReplacementAssistantTab from '../components/replacements/ReplacementAssistantTab'
import RemplacementsHistoriqueTab from '../components/replacements/RemplacementsHistoriqueTab'
import RemplacementModal from '../components/RemplacementModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import { buildRemplacementMessage, buildWhatsAppLink } from '../utils/whatsapp'

type TabKey = 'emploi' | 'grille' | 'assistant' | 'historique'

interface EditingRow {
  remplacantId: string
  index: number
}

export default function RemplacementsGlobal() {
  const { data: teacherExtras = {} } = useTeacherExtras()
  const updateRemplacements = useUpdateTeacherRemplacements()
  const updateAbsences = useUpdateTeacherAbsences()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'replacements').canEdit

  const [tab, setTab] = useState<TabKey>('emploi')
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null)

  const pendingList = getPendingReplacements()
  const ignoredList = getIgnoredGaps()
  const historique = getAllRemplacementsFlat()

  const getExtra = (id: string) => teacherExtras[id] ?? { absences: [], remplacements: [] }

  /** Enregistre l'affectation. N'envoie pas de WhatsApp — utilisé par l'Assistant par Liste,
   * dont le popup de créneau envoie déjà le message pour chaque partie de la séance. */
  const persistAssignment = (
    pending: PendingReplacement,
    teacherId: string,
    consignes: string,
    creneau: { start: string; end: string; hours: number }
  ) => {
    const record: RemplacementRecord = {
      date: pending.date,
      classe: pending.classe,
      matiere: pending.subject,
      profRemplace: teacherName(pending.teacher),
      heures: creneau.hours,
      start: creneau.start,
      end: creneau.end,
      consignes: consignes.trim() || undefined,
    }
    const extra = getExtra(teacherId)
    updateRemplacements.mutate({ teacherId, remplacements: [record, ...extra.remplacements] })
  }

  /** Enregistre l'affectation ET envoie le WhatsApp — utilisé par la Grille d'Occupation, qui
   * n'a pas de popup de créneau (affectation de la période entière en un clic). */
  const handleAssignWithWhatsApp = (
    pending: PendingReplacement,
    teacherId: string,
    consignes: string,
    creneau: { start: string; end: string; hours: number }
  ) => {
    persistAssignment(pending, teacherId, consignes, creneau)

    const remplacant = getTeachersSnapshot().find((t) => t.id === teacherId)
    if (remplacant) {
      const message = buildRemplacementMessage({
        teacherName: teacherName(remplacant),
        date: pending.date,
        creneau: `${creneau.start} - ${creneau.end}`,
        classe: pending.classe,
        matiere: pending.subject,
        consignes: consignes.trim() || undefined,
      })
      const link = buildWhatsAppLink(remplacant.telephoneMobile, message)
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer')
      } else {
        window.alert(`Remplacement affecté, mais aucun numéro WhatsApp valide pour Prof. ${teacherName(remplacant)}.`)
      }
    }
  }

  const handleDeleteRow = (remplacantId: string, index: number) => {
    const list = getExtra(remplacantId).remplacements.filter((_, i) => i !== index)
    updateRemplacements.mutate({ teacherId: remplacantId, remplacements: list })
  }

  /** Écarte un créneau de la liste d'attente sans toucher à l'absence elle-même (ex. trop court pour
   * justifier un remplaçant) — réversible depuis "Créneaux écartés" (Historique & Statistiques). */
  const handleDismissPending = (pending: PendingReplacement) => {
    const extra = getExtra(pending.teacher.id)
    const absences = extra.absences.map((a, i) =>
      i === pending.absenceIndex ? { ...a, ignoredGaps: [...(a.ignoredGaps ?? []), { start: pending.start, end: pending.end }] } : a
    )
    updateAbsences.mutate({ teacherId: pending.teacher.id, absences })
  }

  const handleRestoreIgnored = (item: PendingReplacement) => {
    const extra = getExtra(item.teacher.id)
    const absences = extra.absences.map((a, i) =>
      i === item.absenceIndex ? { ...a, ignoredGaps: (a.ignoredGaps ?? []).filter((g) => !(g.start === item.start && g.end === item.end)) } : a
    )
    updateAbsences.mutate({ teacherId: item.teacher.id, absences })
  }

  const editingRecord = editingRow ? getExtra(editingRow.remplacantId).remplacements[editingRow.index] : undefined
  const editingTeacher = editingRow ? getTeachersSnapshot().find((t) => t.id === editingRow.remplacantId) : undefined

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Gestion des Remplacements
          <Repeat className="h-6 w-6 text-slate-800" />
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Sélectionnez un emploi du temps, signalez un prof absent, puis trouvez et affectez un remplaçant disponible.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton active={tab === 'emploi'} onClick={() => setTab('emploi')} icon={CalendarDays} label="Emploi du Temps Remplacements" />
        <TabButton active={tab === 'grille'} onClick={() => setTab('grille')} icon={Grid3x3} label="Grille d’Occupation Journalière" />
        <TabButton active={tab === 'assistant'} onClick={() => setTab('assistant')} icon={ListChecks} label="Assistant par Liste" />
        <TabButton active={tab === 'historique'} onClick={() => setTab('historique')} icon={History} label="Historique & Statistiques" />
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-5">
        {tab === 'emploi' && <ReplacementScheduleTab />}
        {tab === 'grille' && <OccupancyGridTab pendingList={pendingList} onAssign={handleAssignWithWhatsApp} />}
        {tab === 'assistant' && <ReplacementAssistantTab pendingList={pendingList} onAssign={persistAssignment} onDismiss={handleDismissPending} />}
        {tab === 'historique' && (
          <RemplacementsHistoriqueTab
            historique={historique}
            ignoredList={ignoredList}
            onEdit={(remplacantId, index) => setEditingRow({ remplacantId, index })}
            onDelete={handleDeleteRow}
            onRestore={handleRestoreIgnored}
          />
        )}
      </div>

      {editingRow && editingRecord && editingTeacher && (
        <RemplacementModal
          otherTeachers={getTeachersSnapshot().filter((t) => t.id !== editingTeacher.id)}
          initial={editingRecord}
          suggestedCreneau={(() => {
            const c = getCreneauRemplacement(editingRecord)
            return c ? { start: c.start, end: c.end } : undefined
          })()}
          initialRemplacantId={editingTeacher.id}
          onClose={() => setEditingRow(null)}
          onSubmit={async (updated, remplacantId) => {
            if (remplacantId === editingRow.remplacantId) {
              const list = getExtra(editingRow.remplacantId).remplacements.map((r, i) => (i === editingRow.index ? updated : r))
              await updateRemplacements.mutateAsync({ teacherId: editingRow.remplacantId, remplacements: list })
            } else {
              const oldList = getExtra(editingRow.remplacantId).remplacements.filter((_, i) => i !== editingRow.index)
              await updateRemplacements.mutateAsync({ teacherId: editingRow.remplacantId, remplacements: oldList })
              const newList = [updated, ...getExtra(remplacantId).remplacements]
              await updateRemplacements.mutateAsync({ teacherId: remplacantId, remplacements: newList })
            }
            setEditingRow(null)
          }}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Repeat
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
