import { useState } from 'react'
import { X, GraduationCap, Clock, Repeat } from 'lucide-react'
import { teacherName, ALL_NIVEAUX } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { teacherCycles } from '../utils/teacherAggregation'
import { computeCreneauxLibres, isVacataireAbsentThatDay, isTimeSlotFree, generateWeeklyDates } from '../utils/suiviProfsAggregation'
import { CYCLES } from '../data/referentiel'
import { SCHEDULE_DAYS } from '../data/classSchedules'

interface SuiviProfSubmitData {
  teacherIds: string[]
  date: string
  heure: string
  duree: number
  lieu: string
  motif: string
  notes: string
  niveau?: string
}

interface SuiviProfRecurrentPrefill {
  teacherIds: string[]
  jourSemaine: string
  heure: string
  duree?: number
  motif?: string
  niveau?: string
}

interface SuiviProfModalProps {
  onClose: () => void
  onSubmit: (dataList: SuiviProfSubmitData[]) => void
  initial?: SuiviProfSubmitData
  // Pré-remplit un NOUVEAU suivi directement en mode récurrent (ex. depuis le dashboard Suivi de
  // Classe, qui propose déjà un jour/heure) — distinct de `initial` (édition d'un suivi existant,
  // toujours ponctuel).
  prefillRecurrent?: SuiviProfRecurrentPrefill
}

const DUREE_OPTIONS = [15, 30, 45, 60]
const NB_SEMAINES_OPTIONS = [4, 8, 12, 16]

const JOUR_LABELS: Record<string, string> = {
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
}

export default function SuiviProfModal({ onClose, onSubmit, initial, prefillRecurrent }: SuiviProfModalProps) {
  const allTeachers = getTeachersSnapshot()
  const matieresDisponibles = Array.from(new Set(allTeachers.flatMap((t) => t.matieres))).sort()

  const [matiereFilter, setMatiereFilter] = useState('')
  const [niveauFilter, setNiveauFilter] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [teacherIds, setTeacherIds] = useState<string[]>(initial?.teacherIds ?? prefillRecurrent?.teacherIds ?? [])
  // Le mode récurrent n'a de sens qu'à la création (pas d'édition d'une série existante) — un suivi
  // en cours de modification (`initial` présent) reste toujours en mode ponctuel.
  const [mode, setMode] = useState<'ponctuel' | 'recurrent'>(prefillRecurrent ? 'recurrent' : 'ponctuel')
  const [date, setDate] = useState(initial?.date ?? '')
  const [jourSemaine, setJourSemaine] = useState<string>(prefillRecurrent?.jourSemaine ?? SCHEDULE_DAYS[0])
  const [nbSemaines, setNbSemaines] = useState(8)
  const [duree, setDuree] = useState(initial?.duree ?? prefillRecurrent?.duree ?? 30)
  const [heure, setHeure] = useState(initial?.heure ?? prefillRecurrent?.heure ?? '')
  const [lieu, setLieu] = useState(initial?.lieu ?? '')
  const [motif, setMotif] = useState(initial?.motif ?? prefillRecurrent?.motif ?? '')
  // Le compte-rendu se rédige/modifie désormais via RedigerSuiviCompteRenduModal (bouton dédié sur
  // la carte) — ce champ n'est plus édité ici, seulement préservé tel quel à chaque sauvegarde des
  // informations logistiques (date/heure/lieu/motif) pour ne pas écraser un compte-rendu existant.
  const notes = initial?.notes ?? ''

  const filteredTeachers = allTeachers.filter((t) => {
    const matchesMatiere = !matiereFilter || t.matieres.includes(matiereFilter)
    const matchesNiveau = !niveauFilter || t.niveaux.includes(niveauFilter)
    const matchesCycle = !cycleFilter || teacherCycles(t).includes(cycleFilter)
    return matchesMatiere && matchesNiveau && matchesCycle
  })

  const toggleTeacher = (id: string) => {
    setTeacherIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectedTeachers = allTeachers.filter((t) => teacherIds.includes(t.id))
  const creneaux = mode === 'ponctuel' && date && selectedTeachers.length > 0 ? computeCreneauxLibres(selectedTeachers, date, duree) : []
  const vacatairesAbsents = mode === 'ponctuel' && date ? selectedTeachers.filter((t) => isVacataireAbsentThatDay(t, date)) : []

  // Créneaux libres suggérés sur toute la semaine (mode récurrent) : un aperçu par jour ouvré, basé
  // sur la prochaine occurrence de chaque jour — permet de choisir jour ET heure en un clic plutôt
  // que de saisir une heure à l'aveugle après avoir déjà figé le jour.
  const weekPreview =
    mode === 'recurrent' && selectedTeachers.length > 0
      ? SCHEDULE_DAYS.map((jour) => {
          const [nextDate] = generateWeeklyDates(jour, 1)
          return { jour, creneaux: computeCreneauxLibres(selectedTeachers, nextDate, duree) }
        })
      : []

  // Aperçu du mode récurrent : pour chaque occurrence du jour choisi, l'heure fixe est-elle libre
  // pour TOUS les profs sélectionnés ? Les semaines sans créneau sont écartées, pas bloquantes.
  const recurrentDates = mode === 'recurrent' && teacherIds.length > 0 && heure ? generateWeeklyDates(jourSemaine, nbSemaines) : []
  const recurrentAvailable = recurrentDates.filter((d) => isTimeSlotFree(selectedTeachers, d, heure, duree))
  const recurrentSkipped = recurrentDates.filter((d) => !recurrentAvailable.includes(d))

  const canSubmit =
    teacherIds.length > 0 &&
    heure &&
    motif.trim() &&
    (mode === 'ponctuel' ? !!date : recurrentAvailable.length > 0)

  const handleSubmit = () => {
    if (!canSubmit) return
    const base = { teacherIds, heure, duree, lieu: lieu.trim(), motif: motif.trim(), notes, niveau: initial?.niveau ?? prefillRecurrent?.niveau }
    if (mode === 'ponctuel') {
      onSubmit([{ ...base, date }])
    } else {
      onSubmit(recurrentAvailable.map((d) => ({ ...base, date: d })))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
            {initial ? 'Modifier le Suivi' : 'Planifier un Suivi Prof'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Filtrer les profs</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={matiereFilter}
                onChange={(e) => setMatiereFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Toutes matières</option>
                {matieresDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={niveauFilter}
                onChange={(e) => setNiveauFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Tous niveaux</option>
                {ALL_NIVEAUX.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                value={cycleFilter}
                onChange={(e) => setCycleFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Tous cycles</option>
                {CYCLES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Profs concernés * ({teacherIds.length} sélectionné{teacherIds.length > 1 ? 's' : ''})</label>
            <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
              {filteredTeachers.length === 0 ? (
                <p className="col-span-2 py-2 text-center text-xs text-slate-400">Aucun prof ne correspond à ces filtres.</p>
              ) : (
                filteredTeachers.map((t) => (
                  <label key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={teacherIds.includes(t.id)} onChange={() => toggleTeacher(t.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
                    {teacherName(t)}
                  </label>
                ))
              )}
            </div>
          </div>

          {!initial && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fréquence</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('ponctuel')}
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold ${
                    mode === 'ponctuel' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Un jour précis
                </button>
                <button
                  type="button"
                  onClick={() => setMode('recurrent')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold ${
                    mode === 'recurrent' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  Temps dédié par semaine
                </button>
              </div>
            </div>
          )}

          {mode === 'ponctuel' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Durée</label>
                <select
                  value={duree}
                  onChange={(e) => setDuree(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {DUREE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Jour de la semaine *</label>
                <select
                  value={jourSemaine}
                  onChange={(e) => setJourSemaine(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {SCHEDULE_DAYS.map((j) => (
                    <option key={j} value={j}>
                      {JOUR_LABELS[j]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Sur combien de semaines</label>
                <select
                  value={nbSemaines}
                  onChange={(e) => setNbSemaines(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {NB_SEMAINES_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} semaines
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Durée</label>
                <select
                  value={duree}
                  onChange={(e) => setDuree(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {DUREE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mode === 'recurrent' && teacherIds.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                Créneaux libres suggérés — toute la semaine
              </label>
              <div className="space-y-1.5 rounded-lg border border-slate-200 p-2.5">
                {weekPreview.map(({ jour, creneaux: jourCreneaux }) => (
                  <div key={jour} className="flex items-start gap-2">
                    <span className="w-20 shrink-0 pt-1.5 text-xs font-semibold text-slate-500">{JOUR_LABELS[jour]}</span>
                    {jourCreneaux.length === 0 ? (
                      <p className="pt-1.5 text-xs text-slate-400">Aucun créneau libre</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {jourCreneaux.map((c) => (
                          <button
                            key={c.start}
                            type="button"
                            onClick={() => {
                              setJourSemaine(jour)
                              setHeure(c.start)
                            }}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                              jourSemaine === jour && heure === c.start
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {c.start}–{c.end}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'recurrent' && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure *</label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          )}

          {mode === 'recurrent' && teacherIds.length > 0 && heure && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Repeat className="h-3.5 w-3.5 text-indigo-500" />
                Aperçu de la série
              </label>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {recurrentAvailable.length} rendez-vous seront créés (tous les {JOUR_LABELS[jourSemaine].toLowerCase()}s à {heure}).
              </p>
              {recurrentSkipped.length > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {recurrentSkipped.length} semaine{recurrentSkipped.length > 1 ? 's' : ''} ignorée{recurrentSkipped.length > 1 ? 's' : ''} (pas de créneau libre à cette heure pour{' '}
                  {teacherIds.length > 1 ? 'ces profs' : 'ce prof'}) : {recurrentSkipped.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR')).join(', ')}.
                </p>
              )}
            </div>
          )}

          {mode === 'ponctuel' && date && teacherIds.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                Créneaux libres suggérés
              </label>
              {vacatairesAbsents.length > 0 && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {vacatairesAbsents.map(teacherName).join(', ')} {vacatairesAbsents.length > 1 ? 'sont vacataires et ne semblent pas avoir cours' : 'est vacataire et ne semble pas avoir cours'} ce
                  jour-là — probablement pas à l'école.
                </p>
              )}
              {creneaux.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Aucun créneau commun libre ce jour-là entre 07:30 et 18:00 pour {teacherIds.length > 1 ? 'ces profs' : 'ce prof'}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {creneaux.map((c) => (
                    <button
                      key={c.start}
                      type="button"
                      onClick={() => setHeure(c.start)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        heure === c.start ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c.start}–{c.end}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={mode === 'ponctuel' ? 'grid grid-cols-2 gap-3' : ''}>
            {mode === 'ponctuel' && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure *</label>
                <input
                  type="time"
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Lieu (optionnel)</label>
              <input
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                placeholder="ex: Bureau Direction"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motif *</label>
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="ex: Point d'étape trimestriel, Suivi programme..."
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
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
