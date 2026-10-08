import { useMemo, useState } from 'react'
import { Bus, CalendarX, CheckCircle2, Clock, DoorOpen, GraduationCap, MessageCircle, Pencil, PlusCircle, Printer, Trash2, User, X } from 'lucide-react'
import { JOURS_SOUTIEN, JOUR_LABELS, type SoutienSeance } from '../../data/soutien'
import { fullLabel } from '../../data/salles'
import { teacherName } from '../../data/teachers'
import { useSalles } from '../../services/sallesService'
import { useTeachers } from '../../services/teachersService'
import { useDeleteSoutienSeance, useSetSoutienDateAnnulee, useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { alerteCar } from '../../utils/soutien'
import { feuilleDeSeance, transportInfoOf, type FeuilleSeance } from '../../utils/soutienContexte'
import { aujourdhuiLocalISO, compterStatuts, inscritsDeLaSeance, jourDeDate, occurrencesAnnulees, occurrencesSeance, seanceTerminee } from '../../utils/soutienSeances'
import { datesAnnuleesAVenir } from '../../utils/soutienMessage'
import SoutienSeancePrintPreviewModal from '../soutien-print/SoutienSeancePrintPreviewModal'
import BulkSoutienMessagesModal from './BulkSoutienMessagesModal'
import SoutienSeanceModal from './SoutienSeanceModal'

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function jourDate(iso: string): string {
  const j = jourDeDate(iso)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return `${j ? JOUR_LABELS[j].slice(0, 3).toLowerCase() + '.' : ''} ${m ? `${m[3]}/${m[2]}` : iso}`.trim()
}

function periodeLabel(s: SoutienSeance): string {
  return s.dateFin ? `du ${dateCourte(s.dateDebut)} au ${dateCourte(s.dateFin)}` : `depuis le ${dateCourte(s.dateDebut)}, sans date de fin`
}

/** Séances de soutien regroupées par jour : créer, modifier, annuler une date précise, supprimer. */
export default function SeancesPanel({ isEditable }: { isEditable: boolean }) {
  const { data: seances = [] } = useSoutienSeances()
  const { data: inscriptions = [] } = useSoutienInscriptions()
  const { data: teachers = [] } = useTeachers()
  const { data: salles = [] } = useSalles()
  const supprimer = useDeleteSoutienSeance()
  const annulerDate = useSetSoutienDateAnnulee()

  const [modal, setModal] = useState<{ seance?: SoutienSeance } | null>(null)
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // Annulation : une date, ou une période (vacances) dont on annule toutes les séances d'un coup.
  const [datePicker, setDatePicker] = useState<{ id: string; mode: 'une' | 'periode'; date: string; du: string; au: string } | null>(null)
  // Après une annulation, proposition de prévenir les familles ; `prevenir` ouvre les messages en série.
  const [apresAnnulation, setApresAnnulation] = useState<{ seanceId: string; dates: string[] } | null>(null)
  const [prevenir, setPrevenir] = useState<{ ids: string[]; dates?: string[] } | null>(null)
  const [voirTerminees, setVoirTerminees] = useState(false)
  const [feuille, setFeuille] = useState<FeuilleSeance | null>(null)

  const aujourdhui = aujourdhuiLocalISO()
  const nomProf = useMemo(() => new Map(teachers.map((t) => [t.id, teacherName(t)])), [teachers])
  const salleLabel = useMemo(() => new Map(salles.map((s) => [s.id, fullLabel(s)])), [salles])

  const terminees = seances.filter((s) => seanceTerminee(s, aujourdhui)).length
  const visibles = seances.filter((s) => voirTerminees || !seanceTerminee(s, aujourdhui))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <GraduationCap className="h-5 w-5 text-violet-500" />
            Séances de soutien scolaire
          </h2>
          <p className="text-xs text-slate-500">Chaque séance revient chaque semaine sur sa période ; elle apparaît hachurée dans l'emploi du temps des classes visées et de l'enseignant.</p>
        </div>
        <div className="flex items-center gap-2">
          {terminees > 0 && (
            <button type="button" onClick={() => setVoirTerminees((v) => !v)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              {voirTerminees ? 'Masquer' : 'Voir'} les séances terminées ({terminees})
            </button>
          )}
          <button
            type="button"
            onClick={() => setModal({})}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Nouvelle séance
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice('')} aria-label="Fermer" className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {apresAnnulation &&
        (() => {
          const seance = seances.find((x) => x.id === apresAnnulation.seanceId)
          const ids = seance ? inscritsDeLaSeance(inscriptions, seance.id).filter((i) => i.statut !== 'ne_reste_pas').map((i) => i.id) : []
          return (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <span>
                {apresAnnulation.dates.length > 1 ? `${apresAnnulation.dates.length} séances annulées` : `Séance du ${jourDate(apresAnnulation.dates[0])} annulée`}
                {seance ? ` (${seance.matiere}).` : '.'} {ids.length > 0 ? 'Les familles sont-elles prévenues ?' : ''}
              </span>
              <span className="flex items-center gap-2">
                {ids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrevenir({ ids, dates: apresAnnulation.dates })
                      setApresAnnulation(null)
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Prévenir les familles ({ids.length})
                  </button>
                )}
                <button type="button" onClick={() => setApresAnnulation(null)} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                  Plus tard
                </button>
              </span>
            </div>
          )
        })()}

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          Aucune séance de soutien{seances.length > 0 ? ' en cours' : ''}. {isEditable ? 'Créez-en une avec « Nouvelle séance ».' : ''}
        </div>
      ) : (
        <div className="space-y-5">
          {JOURS_SOUTIEN.map((jour) => {
            const duJour = visibles.filter((s) => s.jour === jour).sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
            if (duJour.length === 0) return null
            return (
              <section key={jour}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{JOUR_LABELS[jour]}</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {duJour.map((s) => {
                    const inscrits = inscritsDeLaSeance(inscriptions, s.id)
                    const comptes = compterStatuts(inscrits)
                    const familles = inscrits.filter((i) => i.statut !== 'ne_reste_pas')
                    const manquentLeCar = inscrits.filter((i) => alerteCar(s, transportInfoOf(i.studentId))).length
                    const close = seanceTerminee(s, aujourdhui)
                    const prochaines = occurrencesSeance(s, { depuis: aujourdhui, max: 30 })
                    return (
                      <article key={s.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${close ? 'border-slate-200 opacity-70' : 'border-violet-100'}`}>
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-slate-900">{s.matiere}</p>
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-700">
                              <Clock className="h-3.5 w-3.5" />
                              {s.heureDebut} – {s.heureFin}
                              {close && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Terminée</span>}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" title="Imprimer la feuille de la séance" aria-label="Imprimer la feuille de la séance" onClick={() => setFeuille(feuilleDeSeance(s))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            {isEditable && (
                              <>
                                <button type="button" title="Modifier" aria-label="Modifier la séance" onClick={() => setModal({ seance: s })} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Annuler une date"
                                  aria-label="Annuler une date"
                                  disabled={prochaines.length === 0}
                                  onClick={() => setDatePicker(datePicker?.id === s.id ? null : { id: s.id, mode: 'une', date: prochaines[0] ?? '', du: prochaines[0] ?? '', au: prochaines[0] ?? '' })}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
                                >
                                  <CalendarX className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" title="Supprimer" aria-label="Supprimer la séance" onClick={() => setConfirmDelete(s.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-slate-600">
                          <p className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            {s.teacherId ? (nomProf.get(s.teacherId) ?? 'Enseignant introuvable') : <span className="text-slate-400">Pas d'enseignant</span>}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-slate-400" />
                            {s.salleId ? (salleLabel.get(s.salleId) ?? 'Salle introuvable') : <span className="text-slate-400">Pas de salle</span>}
                          </p>
                          <p className="text-slate-500">{periodeLabel(s)}</p>
                        </div>

                        {s.classes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {s.classes.map((c) => (
                              <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                            {inscrits.length} inscrit{inscrits.length > 1 ? 's' : ''}
                          </span>
                          {comptes.reste > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{comptes.reste} restent</span>}
                          {comptes.a_confirmer > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{comptes.a_confirmer} à confirmer</span>}
                          {comptes.ne_reste_pas > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{comptes.ne_reste_pas} ne restent pas</span>}
                          {manquentLeCar > 0 && (
                            <span title="Élèves au transport du soir dont la séance se termine après le départ du transport" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                              <Bus className="h-3 w-3" />
                              {manquentLeCar} au transport du soir
                            </span>
                          )}
                        </div>

                        {s.datesAnnulees.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <span>Pas de séance :</span>
                            {occurrencesAnnulees(s).map((d) => (
                              <span key={d} className="inline-flex items-center gap-1 rounded-full bg-rose-50 py-0.5 pl-2 pr-1 text-rose-600">
                                <span className="line-through">{jourDate(d)}</span>
                                {isEditable && (
                                  <button type="button" title="Rétablir cette date" aria-label={`Rétablir le ${dateCourte(d)}`} onClick={() => annulerDate.mutate({ id: s.id, dates: [d], annulee: false })} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-rose-100">
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                            {datesAnnuleesAVenir(s).length > 0 && familles.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setPrevenir({ ids: familles.map((i) => i.id) })}
                                className="ml-1 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                <MessageCircle className="h-3 w-3" />
                                Prévenir les familles
                              </button>
                            )}
                          </div>
                        )}

                        {s.note && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{s.note}</p>}

                        {datePicker?.id === s.id && (
                          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Portée de l'annulation">
                              {(['une', 'periode'] as const).map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setDatePicker({ ...datePicker, mode: m })}
                                  className={`rounded-md px-3 py-1 text-xs font-semibold ${datePicker.mode === m ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                  {m === 'une' ? 'Une date' : 'Une période (vacances)'}
                                </button>
                              ))}
                            </div>
                            {(() => {
                              const dates = datePicker.mode === 'une' ? (datePicker.date ? [datePicker.date] : []) : prochaines.filter((d) => d >= datePicker.du && d <= datePicker.au)
                              return (
                                <div className="flex flex-wrap items-center gap-2">
                                  {datePicker.mode === 'une' ? (
                                    <select value={datePicker.date} onChange={(e) => setDatePicker({ ...datePicker, date: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                                      {prochaines.map((d) => (
                                        <option key={d} value={d}>
                                          {jourDate(d)}/{d.slice(0, 4)}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <>
                                      <label className="text-xs font-medium text-slate-600">Du</label>
                                      <input type="date" value={datePicker.du} onChange={(e) => setDatePicker({ ...datePicker, du: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700" />
                                      <label className="text-xs font-medium text-slate-600">au</label>
                                      <input type="date" value={datePicker.au} min={datePicker.du} onChange={(e) => setDatePicker({ ...datePicker, au: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700" />
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    disabled={dates.length === 0}
                                    onClick={() => {
                                      annulerDate.mutate({ id: s.id, dates, annulee: true }, { onSuccess: () => setApresAnnulation({ seanceId: s.id, dates }) })
                                      setDatePicker(null)
                                    }}
                                    className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {dates.length > 1 ? `Annuler ces ${dates.length} séances` : 'Annuler cette date'}
                                  </button>
                                  <button type="button" onClick={() => setDatePicker(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                                    Fermer
                                  </button>
                                  {datePicker.mode === 'periode' && dates.length === 0 && <span className="text-[11px] text-slate-400">Aucune séance à venir sur cette période.</span>}
                                </div>
                              )
                            })()}
                          </div>
                        )}

                        {confirmDelete === s.id && (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="mb-2 text-xs font-semibold text-rose-700">
                              Supprimer cette séance{inscrits.length > 0 ? (inscrits.length > 1 ? ` et ses ${inscrits.length} inscriptions` : ' et son inscription') : ''} ? Cette action est définitive.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  supprimer.mutate(s.id)
                                  setConfirmDelete(null)
                                }}
                                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                              >
                                Supprimer
                              </button>
                              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {prevenir && <BulkSoutienMessagesModal ids={prevenir.ids} isEditable={isEditable} initialKind="annulation" datesAnnulees={prevenir.dates} onClose={() => setPrevenir(null)} />}
      {feuille && <SoutienSeancePrintPreviewModal feuille={feuille} onClose={() => setFeuille(null)} />}
      {modal && <SoutienSeanceModal seance={modal.seance} onClose={() => setModal(null)} onSaved={setNotice} />}
    </div>
  )
}
