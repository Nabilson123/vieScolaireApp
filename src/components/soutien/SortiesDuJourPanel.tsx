import { useMemo, useState } from 'react'
import { Bus, DoorOpen, GraduationCap, Printer } from 'lucide-react'
import { useStudentExtras } from '../../services/studentDetailsService'
import { useStudentIdentities } from '../../services/studentIdentityService'
import { useStudents } from '../../services/studentsService'
import { useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { prochaineDateDeSoutien, sortiesDuJourDeLEcole } from '../../utils/soutienContexte'
import { aujourdhuiLocalISO, jourDeDate } from '../../utils/soutienSeances'
import { JOUR_LABELS } from '../../data/soutien'
import SortiesDuJourPrintPreviewModal from '../soutien-print/SortiesDuJourPrintPreviewModal'
import SoutienTransportModal from './SoutienTransportModal'

function dateLongue(iso: string): string {
  const j = jourDeDate(iso)
  return `${j ? `${JOUR_LABELS[j]} ` : ''}${iso.split('-').reverse().join('/')}`
}

/**
 * Sorties du soir d'un jour : combien d'élèves sont attendus à chaque car, qui reste au soutien (et manque son car),
 * qui sort seul(e). Deux actions : imprimer la feuille pour le portail, et prévenir l'équipe transport.
 */
export default function SortiesDuJourPanel() {
  // Abonnements : la feuille lit les instantanés de ces données, qui doivent être chargées et rester à jour.
  const { data: students = [] } = useStudents()
  const { data: identities } = useStudentIdentities()
  const { data: extras } = useStudentExtras()
  const { data: seances = [] } = useSoutienSeances()
  const { data: inscriptions = [] } = useSoutienInscriptions()

  const aujourdhui = aujourdhuiLocalISO()
  const [date, setDate] = useState(aujourdhui)
  const [feuille, setFeuille] = useState(false)
  const [transport, setTransport] = useState(false)

  const data = useMemo(
    () => sortiesDuJourDeLEcole(date),
    [date, students, identities, extras, seances, inscriptions],
  )
  const prochaine = useMemo(() => prochaineDateDeSoutien(aujourdhui), [seances, aujourdhui])
  const restent = data.cars.reduce((n, c) => n + c.restent, 0)
  const attendus = data.cars.reduce((n, c) => n + c.attendus, 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Bus className="h-5 w-5 text-sky-500" />
            Sorties du soir
          </h2>
          <p className="text-xs text-slate-500">Cars du soir, soutien et sorties seul(e) d'une même journée : de quoi préparer le portail et prévenir le transport.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Jour"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
          {date !== aujourdhui && (
            <button type="button" onClick={() => setDate(aujourdhui)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Aujourd'hui
            </button>
          )}
          {prochaine && prochaine !== date && (
            <button type="button" onClick={() => setDate(prochaine)} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100">
              Prochain soutien : {dateLongue(prochaine)}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFeuille(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <Printer className="h-4 w-4" />
          Imprimer la feuille — {dateLongue(date)}
        </button>
        <button
          type="button"
          onClick={() => setTransport(true)}
          disabled={restent === 0}
          title={restent === 0 ? 'Aucun élève du car ne reste au soutien ce jour-là' : undefined}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Bus className="h-4 w-4" />
          Prévenir le transport{restent > 0 ? ` (${restent} élève${restent > 1 ? 's' : ''})` : ''}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-2 flex items-center justify-between text-sm font-bold text-slate-900">
            Cars du soir
            <span className="text-xs font-medium text-slate-400">{attendus} élèves attendus</span>
          </h3>
          {data.cars.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Aucun élève n'a de car du soir.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Ligne</th>
                    <th className="px-3 py-2">Départ</th>
                    <th className="px-3 py-2 text-center">Habituels</th>
                    <th className="px-3 py-2 text-center">Restent au soutien</th>
                    <th className="px-3 py-2 text-center">Attendus</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cars.map((c) => (
                    <tr key={`${c.depart}-${c.ligne}`} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-semibold text-slate-800">Ligne {c.ligne}</td>
                      <td className="px-3 py-2 text-slate-600">{c.depart}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{c.habituels}</td>
                      <td className={`px-3 py-2 text-center font-semibold ${c.restent > 0 ? 'text-amber-700' : 'text-slate-300'}`} title={c.restants.map((r) => `${r.name} (${r.classe})`).join(', ') || undefined}>
                        {c.restent > 0 ? c.restent : '—'}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-slate-900">{c.attendus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.cars.some((c) => c.enAttente.length > 0) && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {data.cars.reduce((n, c) => n + c.enAttente.length, 0)} élève(s) du car n'ont pas encore répondu au soutien : comptés au car en attendant.
            </p>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
              <GraduationCap className="h-4 w-4 text-violet-500" />
              Soutien
            </h3>
            {data.soutien.length === 0 ? (
              <p className="text-sm text-slate-400">Pas de soutien ce jour-là.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data.soutien.map((s) => (
                  <li key={s.seanceId} className="rounded-lg bg-violet-50/60 px-3 py-2">
                    <p className="font-semibold text-slate-800">
                      {s.matiere} <span className="font-normal text-slate-500">{s.heureDebut}–{s.heureFin}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      {s.confirmes.length} confirmé{s.confirmes.length > 1 ? 's' : ''}
                      {s.enAttente.length > 0 && <span className="font-semibold text-amber-700"> · {s.enAttente.length} à confirmer</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900">
              <DoorOpen className="h-4 w-4 text-emerald-500" />
              Sortent seul(e)
            </h3>
            <p className="text-sm text-slate-600">
              {data.sortieSeul.length} élève{data.sortieSeul.length > 1 ? 's' : ''}
              {data.sortieSeul.some((s) => !s.accordSigne) && <span className="font-semibold text-rose-600"> · {data.sortieSeul.filter((s) => !s.accordSigne).length} accord non signé</span>}
            </p>
          </section>
        </div>
      </div>

      {feuille && <SortiesDuJourPrintPreviewModal initialDate={date} onClose={() => setFeuille(false)} />}
      {transport && <SoutienTransportModal initialDate={date} onClose={() => setTransport(false)} />}
    </div>
  )
}
