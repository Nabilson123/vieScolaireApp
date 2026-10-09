import { useMemo, useState } from 'react'
import { DoorOpen, Plus, X, Trash2, TriangleAlert } from 'lucide-react'
import { useSalles } from '../services/sallesService'
import { fullLabel } from '../data/salles'
import {
  useReservationsSalles,
  useAddReservationSalle,
  useDeleteReservationSalle,
  detectConflictForSalle,
} from '../services/reservationsSallesService'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function NouvelleReservationModal({ onClose }: { onClose: () => void }) {
  const { data: salles = [] } = useSalles()
  const add = useAddReservationSalle()
  const [salleId, setSalleId] = useState(salles[0]?.id ?? '')
  const [titre, setTitre] = useState('')
  const [date, setDate] = useState(todayISO())
  const [heureDebut, setHeureDebut] = useState('')
  const [heureFin, setHeureFin] = useState('')

  const conflict = useMemo(() => {
    if (!salleId || !date || !heureDebut || !heureFin) return null
    return detectConflictForSalle(salleId, date, heureDebut, heureFin)
  }, [salleId, date, heureDebut, heureFin])

  const canSubmit = !!salleId && titre.trim() !== '' && !!date && !!heureDebut && !!heureFin && heureDebut < heureFin

  const handleSubmit = async () => {
    if (!canSubmit) return
    await add.mutateAsync({ salleId, titre: titre.trim(), date, heureDebut, heureFin })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <DoorOpen className="h-5 w-5 text-indigo-500" />
            Réserver une salle
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Salle</label>
            <select
              value={salleId}
              onChange={(e) => setSalleId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              {salles.map((s) => (
                <option key={s.id} value={s.id}>
                  {fullLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Titre</label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Réunion pédagogique"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Début</label>
              <input
                type="time"
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fin</label>
              <input
                type="time"
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          {(conflict?.edtConflict || conflict?.reservationConflict || conflict?.soutienConflict || conflict?.clubConflict) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {conflict.edtConflict && (
                  <p>
                    Cette salle est déjà utilisée par <strong>{conflict.edtConflict.classe}</strong> ({conflict.edtConflict.matiere}) sur ce créneau
                    (emploi du temps régulier).
                  </p>
                )}
                {conflict.reservationConflict && (
                  <p>
                    Déjà réservée pour « {conflict.reservationConflict.titre} » de {conflict.reservationConflict.heureDebut} à{' '}
                    {conflict.reservationConflict.heureFin}.
                  </p>
                )}
                {conflict.soutienConflict && (
                  <p>
                    Un soutien scolaire (<strong>{conflict.soutienConflict.matiere}</strong>) a lieu dans cette salle ce jour-là de {conflict.soutienConflict.debut} à{' '}
                    {conflict.soutienConflict.fin}.
                  </p>
                )}
                {conflict.clubConflict && (
                  <p>
                    Le club <strong>{conflict.clubConflict.nom}</strong> a lieu dans cette salle ce jour-là de {conflict.clubConflict.debut} à {conflict.clubConflict.fin}.
                  </p>
                )}
                <p className="font-semibold">Vous pouvez tout de même confirmer si vous jugez que ça convient.</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || add.isPending}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {add.isPending ? 'Confirmation...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReservationSallesGlobal() {
  const { data: reservations = [] } = useReservationsSalles()
  const { data: salles = [] } = useSalles()
  const deleteReservation = useDeleteReservationSalle()
  const canEditYear = useIsViewedYearEditable()
  const profile = useCurrentProfile()
  const canEditModule = getModuleAccess(profile, 'reservationSalles').canEdit
  const isEditable = canEditYear && canEditModule
  const [showModal, setShowModal] = useState(false)

  const salleName = (id: string) => {
    const s = salles.find((s) => s.id === id)
    return s ? fullLabel(s) : '—'
  }

  const upcoming = reservations.filter((r) => r.date >= todayISO())
  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof upcoming>()
    upcoming.forEach((r) => {
      map.set(r.date, [...(map.get(r.date) ?? []), r])
    })
    return Array.from(map.entries())
  }, [upcoming])

  return (
    <div className="mx-auto max-w-[1000px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Réservation de Salles
            <DoorOpen className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Réservations ponctuelles, en complément de l'emploi du temps régulier.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Réserver
        </button>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      {groupedByDate.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucune réservation à venir.</p>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(([date, rows]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{formatDate(date)}</p>
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{r.titre}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {salleName(r.salleId)} · {r.heureDebut} - {r.heureFin}
                      </p>
                    </div>
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => deleteReservation.mutate(r.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <NouvelleReservationModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
