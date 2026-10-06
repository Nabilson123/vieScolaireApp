import { useState } from 'react'
import { X, RefreshCw } from 'lucide-react'
import type { Teacher } from '../data/teachers'
import { teacherName } from '../data/teachers'
import type { RemplacementRecord } from '../data/teacherExtras'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { useMatieresConfig } from '../services/matieresConfigService'
import { getTeachersSnapshot } from '../services/teachersService'
import { buildRemplacementMessage, buildWhatsAppLink } from '../utils/whatsapp'
import { useIsViewedYearEditable } from '../services/viewedYear'
import TeacherSearchSelect from './TeacherSearchSelect'
import { heuresEntre } from '../utils/remplacementCreneau'

interface RemplacementModalProps {
  otherTeachers: Teacher[]
  initialRemplacantId: string
  onClose: () => void
  onSubmit: (record: RemplacementRecord, remplacantId: string) => void
  initial?: RemplacementRecord
  /** Créneau retrouvé dans l'emploi du temps pour un remplacement enregistré sans heure : proposé à l'enregistrement. */
  suggestedCreneau?: { start: string; end: string }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function RemplacementModal({ otherTeachers, initialRemplacantId, onClose, onSubmit, initial, suggestedCreneau }: RemplacementModalProps) {
  const isEdit = !!initial
  const isEditable = useIsViewedYearEditable()
  const { data: matieresConfig = [] } = useMatieresConfig()
  const allClasses = getActiveClassNamesSnapshot()
  const allMatieres = matieresConfig.map((m) => m.nom)
  const [classe, setClasse] = useState(initial?.classe ?? allClasses[0] ?? '')
  const [matiere, setMatiere] = useState(initial?.matiere ?? allMatieres[0] ?? '')
  const [profRemplace, setProfRemplace] = useState(initial?.profRemplace ?? '')
  const [remplacantId, setRemplacantId] = useState(initialRemplacantId)
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [heures, setHeures] = useState(initial?.heures ?? 2)
  const [start, setStart] = useState(initial?.start ?? suggestedCreneau?.start ?? '')
  const [end, setEnd] = useState(initial?.end ?? suggestedCreneau?.end ?? '')
  // Avec une heure de début et de fin valides, la durée s'en déduit ; sinon elle se saisit à la main.
  const creneauValide = !!start && !!end && end > start
  const heuresEffectives = creneauValide ? heuresEntre(start, end) : heures
  const [consignes, setConsignes] = useState(initial?.consignes ?? '')

  const remplacants = getTeachersSnapshot().filter((t) => teacherName(t) !== profRemplace)

  const creneauIncomplet = (!!start || !!end) && !creneauValide
  const canSubmit = isEditable && classe && matiere && profRemplace && remplacantId && date && heuresEffectives > 0 && !creneauIncomplet

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(
      { date, classe, matiere, profRemplace, heures: heuresEffectives, start: creneauValide ? start : undefined, end: creneauValide ? end : undefined, consignes: consignes.trim() || undefined },
      remplacantId,
    )

    const remplacant = remplacants.find((t) => t.id === remplacantId)
    if (remplacant) {
      const message = buildRemplacementMessage({
        teacherName: teacherName(remplacant),
        date,
        creneau: creneauValide ? `${start} - ${end}` : `${heuresEffectives}h`,
        classe,
        matiere,
        consignes: consignes.trim() || undefined,
      })
      const link = buildWhatsAppLink(remplacant.telephoneMobile, message)
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer')
      } else {
        window.alert(`Remplacement enregistré, mais aucun numéro WhatsApp valide pour Prof. ${teacherName(remplacant)}.`)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <RefreshCw className="h-5 w-5 text-emerald-500" />
            {isEdit ? 'Modifier le Remplacement' : 'Enregistrer un Remplacement'}
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
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Professeur remplacé*</label>
            <TeacherSearchSelect teachers={otherTeachers} valueBy="name" value={profRemplace} onChange={setProfRemplace} placeholder="Sélectionnez un professeur..." />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Professeur remplaçant*</label>
            <TeacherSearchSelect teachers={remplacants} value={remplacantId} onChange={setRemplacantId} placeholder="Sélectionnez un professeur..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classe concernée*</label>
              <select
                value={classe}
                onChange={(e) => setClasse(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {allClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Matière*</label>
              <select
                value={matiere}
                onChange={(e) => setMatiere(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {allMatieres.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date*</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heures effectuées*</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={heuresEffectives}
                readOnly={creneauValide}
                onChange={(e) => setHeures(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none read-only:bg-slate-50 read-only:text-slate-500"
              />
              {creneauValide && <p className="mt-1 text-[11px] text-slate-400">Calculées d'après le créneau.</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Créneau exact dans l'emploi du temps</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                aria-label="Heure de début"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-label="Heure de fin"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            {creneauIncomplet ? (
              <p className="mt-1 text-[11px] text-amber-600">Renseignez un début et une fin (la fin après le début), ou videz les deux champs.</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">Début et fin du remplacement, pour que la personne suivante sache quel créneau est couvert.</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Consignes pour le remplaçant (optionnel)</label>
            <textarea
              value={consignes}
              onChange={(e) => setConsignes(e.target.value)}
              rows={2}
              placeholder="Contenu prévu, exercices à faire faire..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
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
            title="Enregistre le remplacement et ouvre WhatsApp avec un message pré-rempli pour le remplaçant"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isEdit ? 'Enregistrer les modifications' : 'Enregistrer + WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )
}
