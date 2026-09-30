import { useMemo, useState } from 'react'
import { Clock3, Plus, Trash2, Printer, CalendarClock, Pencil } from 'lucide-react'
import CapaciteField from '../components/CapaciteField'
import { useServicesCapacite, useUpdateServicesCapacite } from '../services/servicesCapaciteService'
import { useChauffeurs } from '../services/chauffeursService'
import { useVigiles } from '../services/vigilesService'
import { useGardeEvenements } from '../services/gardeEvenementsService'
import { useGardeFamilles, useUpdateGardeFamilleColor } from '../services/gardeFamillesService'
import { useGardePeriodes, useAddGardePeriode, useDeleteGardePeriode } from '../services/gardePeriodesService'
import { useGardePeriodeAgents, useAddPeriodeAgent, useRemovePeriodeAgent } from '../services/gardePeriodeAgentsService'
import { useGardeCreneaux, useAddCreneau, useUpdateCreneauTime, useRemoveCreneau, useSeedDefaultCreneaux } from '../services/gardeCreneauxService'
import {
  useGardeAffectations,
  useAddGardeAffectation,
  useUpdateBlockEvenement,
  useUpdateBlockRange,
  useDeleteGardeAffectation,
  type PersonnelType,
} from '../services/gardeAffectationsService'
import { useGardeVendredi, useAddVendredi, useUpdateVendrediDate, useUpdateVendrediNote, useRemoveVendredi, useToggleVendrediMode } from '../services/gardeVendrediService'
import { useGardeVendrediPresence, useTogglePresence } from '../services/gardeVendrediPresenceService'
import GardePlanningGrid, { type GridAgent } from '../components/garde/GardePlanningGrid'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import GardePrintPreviewModal from '../components/garde-print/GardePrintPreviewModal'

interface GardeGlobalProps {
  onDataChanged?: () => void
}

interface RosterPerson {
  type: PersonnelType
  id: string
  nom: string
  telephone: string
}

function personKey(type: PersonnelType, id: string): string {
  return `${type}:${id}`
}

function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text)
}

export default function GardeGlobal({ onDataChanged }: GardeGlobalProps) {
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'garde').canEdit
  const { data: capacite } = useServicesCapacite()
  const updateCapacite = useUpdateServicesCapacite()

  const { data: chauffeurs = [] } = useChauffeurs()
  const { data: vigiles = [] } = useVigiles()
  const { data: evenements = [] } = useGardeEvenements()
  const { data: familles = [] } = useGardeFamilles()
  const updateFamilleColor = useUpdateGardeFamilleColor()

  const { data: periodes = [] } = useGardePeriodes()
  const addPeriode = useAddGardePeriode()
  const deletePeriode = useDeleteGardePeriode()
  const seedCreneaux = useSeedDefaultCreneaux()
  const [periodeId, setPeriodeId] = useState<string | null>(null)
  const selectedPeriodeId = periodeId ?? periodes[0]?.id ?? null

  const { data: periodeAgents = [] } = useGardePeriodeAgents(selectedPeriodeId)
  const addPeriodeAgent = useAddPeriodeAgent()
  const removePeriodeAgent = useRemovePeriodeAgent()

  const { data: creneaux = [] } = useGardeCreneaux(selectedPeriodeId)
  const addCreneau = useAddCreneau()
  const updateCreneauTime = useUpdateCreneauTime()
  const removeCreneau = useRemoveCreneau()

  const { data: affectations = [] } = useGardeAffectations(selectedPeriodeId)
  const addAffectation = useAddGardeAffectation()
  const updateEvenement = useUpdateBlockEvenement()
  const updateRange = useUpdateBlockRange()
  const deleteAffectation = useDeleteGardeAffectation()

  const { data: vendredi = [] } = useGardeVendredi(selectedPeriodeId)
  const addVendredi = useAddVendredi()
  const updateVendrediDate = useUpdateVendrediDate()
  const updateVendrediNote = useUpdateVendrediNote()
  const removeVendredi = useRemoveVendredi()
  const toggleVendrediMode = useToggleVendrediMode()
  const { data: presence = [] } = useGardeVendrediPresence(selectedPeriodeId)
  const togglePresence = useTogglePresence()

  const [showNewPeriode, setShowNewPeriode] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newDebut, setNewDebut] = useState('')
  const [newFin, setNewFin] = useState('')
  const [addPersonKey, setAddPersonKey] = useState('')
  const [editSlots, setEditSlots] = useState(false)
  const [showPrint, setShowPrint] = useState(false)

  const roster: RosterPerson[] = useMemo(
    () => [
      ...chauffeurs.map((c) => ({ type: 'chauffeur' as const, id: c.id, nom: c.nom, telephone: c.telephone })),
      ...vigiles.map((v) => ({ type: 'vigile' as const, id: v.id, nom: v.nom, telephone: v.telephone })),
    ],
    [chauffeurs, vigiles]
  )
  const rosterOf = (type: PersonnelType, id: string) => roster.find((p) => p.type === type && p.id === id)

  const gridAgents: GridAgent[] = periodeAgents.map((pa) => ({
    personnelType: pa.personnelType,
    personnelId: pa.personnelId,
    label: rosterOf(pa.personnelType, pa.personnelId)?.nom ?? '(introuvable)',
  }))

  const availableToAdd = roster.filter((p) => !periodeAgents.some((pa) => pa.personnelType === p.type && pa.personnelId === p.id))

  const onSaved = () => onDataChanged?.()

  const handleCreatePeriode = async () => {
    if (!newNom.trim() || !newDebut || !newFin) return
    const created = await addPeriode.mutateAsync({ nom: newNom.trim(), dateDebut: newDebut, dateFin: newFin })
    // Fixe explicitement la période sélectionnée : sans ça, useGardeCreneaux(selectedPeriodeId)
    // continue de suivre l'ancienne clé pendant que `periodes` refetch, et rate l'invalidation
    // déclenchée par le seed des créneaux ci-dessous (les créneaux existent bien en base mais
    // n'apparaissent qu'après un rechargement complet).
    setPeriodeId(created.id)
    await seedCreneaux.mutateAsync(created.id)
    setShowNewPeriode(false)
    setNewNom('')
    setNewDebut('')
    setNewFin('')
    onSaved()
  }

  const handleAddIntervenant = () => {
    if (!addPersonKey || !selectedPeriodeId) return
    const [type, id] = addPersonKey.split(':') as [PersonnelType, string]
    const ordre = periodeAgents.length ? Math.max(...periodeAgents.map((a) => a.ordre)) + 1 : 0
    addPeriodeAgent.mutate({ periodeId: selectedPeriodeId, personnelType: type, personnelId: id, ordre }, { onSuccess: onSaved })
    setAddPersonKey('')
  }

  const handleAddVendredi = () => {
    if (!selectedPeriodeId) return
    const ordre = vendredi.length ? Math.max(...vendredi.map((v) => v.ordre)) + 1 : 0
    addVendredi.mutate({ periodeId: selectedPeriodeId, ordre, dateLabel: 'Vendredi __/__/____' }, { onSuccess: onSaved })
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 p-5 text-white shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Clock3 className="h-5 w-5" />
            Garde
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/80">
            Capacité d'accueil et planning du service de garde (chauffeurs et vigiles).
          </p>
        </div>
        {selectedPeriodeId && (
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/25"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
        )}
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <fieldset disabled={!canEdit} className="contents">
        <div className="mb-5 max-w-xl rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-5 text-sm text-slate-500">
            Nombre de places disponibles pour la garde — utilisé pour calculer le taux d'occupation affiché dans les Rapports BI.
          </p>
          {capacite && (
            <CapaciteField
              icon={Clock3}
              iconColor="text-violet-500"
              label="Capacité Garde"
              value={capacite.gardeCapacite}
              onChange={(gardeCapacite) => {
                updateCapacite.mutate({ id: capacite.id, gardeCapacite })
                onSaved()
              }}
            />
          )}
        </div>

        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <CalendarClock className="h-4 w-4 text-violet-500" />
              Planning du Service Garde
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedPeriodeId ?? ''}
                onChange={(e) => setPeriodeId(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
              >
                {periodes.length === 0 && <option value="">Aucune période</option>}
                {periodes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} ({p.dateDebut} → {p.dateFin})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewPeriode((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvelle période
              </button>
              {selectedPeriodeId && (
                <button
                  type="button"
                  onClick={() => {
                    const p = periodes.find((x) => x.id === selectedPeriodeId)
                    if (!p || !confirm(`Supprimer la période "${p.nom}" et tout son planning ?`)) return
                    deletePeriode.mutate(p.id, { onSuccess: () => setPeriodeId(null) })
                    onSaved()
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {showNewPeriode && (
            <div className="mb-5 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-300 p-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nom</label>
                <input
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  placeholder="ex : Période 02"
                  className="w-48 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Du</label>
                <input type="date" value={newDebut} onChange={(e) => setNewDebut(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Au</label>
                <input type="date" value={newFin} onChange={(e) => setNewFin(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              </div>
              <button
                type="button"
                onClick={handleCreatePeriode}
                disabled={!newNom.trim() || !newDebut || !newFin}
                className="rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          )}

          {!selectedPeriodeId ? (
            <p className="py-10 text-center text-sm text-slate-400">Créez une période pour commencer à planifier la garde.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <select
                  value={addPersonKey}
                  onChange={(e) => setAddPersonKey(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
                >
                  <option value="">Ajouter un intervenant...</option>
                  {availableToAdd.map((p) => (
                    <option key={personKey(p.type, p.id)} value={personKey(p.type, p.id)}>
                      {p.nom} ({p.type === 'chauffeur' ? 'Chauffeur' : 'Vigile'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddIntervenant}
                  disabled={!addPersonKey}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter à la période
                </button>
                {periodeAgents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {periodeAgents.map((pa) => (
                      <span
                        key={pa.id}
                        className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                      >
                        {rosterOf(pa.personnelType, pa.personnelId)?.nom ?? '?'}
                        <button type="button" onClick={() => removePeriodeAgent.mutate(pa.id, { onSuccess: onSaved })} className="text-slate-400 hover:text-rose-500">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                  <Pencil className="h-3.5 w-3.5" />
                  Renommer un intervenant : Personnel → Chauffeurs / Vigiles.
                </div>
              </div>

              {gridAgents.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucun intervenant dans cette période pour l'instant.</p>
              ) : (
                <>
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setEditSlots((v) => !v)}
                      className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold ${
                        editSlots ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      Modifier les créneaux
                    </button>
                  </div>
                  <GardePlanningGrid
                    agents={gridAgents}
                    creneaux={creneaux}
                    affectations={affectations}
                    evenements={evenements}
                    familles={familles}
                    editSlots={editSlots}
                    onUpdateCreneauTime={(id, debut, fin) => updateCreneauTime.mutate({ id, debut, fin }, { onSuccess: onSaved })}
                    onRemoveCreneau={(index) => removeCreneau.mutate({ periodeId: selectedPeriodeId, index }, { onSuccess: onSaved })}
                    onAddCreneau={() => {
                      const nextIndex = creneaux.length
                      const last = creneaux[creneaux.length - 1]
                      addCreneau.mutate(
                        { periodeId: selectedPeriodeId, index: nextIndex, debut: last?.fin ?? '18:00', fin: '18:15' },
                        { onSuccess: onSaved }
                      )
                    }}
                    onCreateBlock={(personnelType, personnelId, slotIndex) => {
                      const defaultEvenement = evenements.find((e) => e.id === 'pause') ?? evenements[0]
                      if (!defaultEvenement) return
                      addAffectation.mutate(
                        {
                          periodeId: selectedPeriodeId,
                          personnelType,
                          personnelId,
                          fromIndex: slotIndex,
                          toIndex: slotIndex,
                          evenementId: defaultEvenement.id,
                        },
                        { onSuccess: onSaved }
                      )
                    }}
                    onChangeEvenement={(blockId, evenementId) => updateEvenement.mutate({ id: blockId, evenementId }, { onSuccess: onSaved })}
                    onChangeRange={(blockId, fromIndex, toIndex) => {
                      const block = affectations.find((a) => a.id === blockId)
                      if (!block) return
                      updateRange.mutate(
                        {
                          periodeId: selectedPeriodeId,
                          personnelType: block.personnelType,
                          personnelId: block.personnelId,
                          blockId,
                          fromIndex,
                          toIndex,
                        },
                        { onSuccess: onSaved }
                      )
                    }}
                    onDeleteBlock={(blockId) => deleteAffectation.mutate(blockId, { onSuccess: onSaved })}
                    onRecolorFamille={(key, color, soft, fg) => updateFamilleColor.mutate({ key, label: familles.find((f) => f.key === key)?.label ?? '', color, soft, fg }, { onSuccess: onSaved })}
                  />
                </>
              )}

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permanences du Vendredi</p>
                  <button
                    type="button"
                    onClick={handleAddVendredi}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Plus className="h-3 w-3" />
                    Vendredi
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <div
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: `206px repeat(${Math.max(gridAgents.length, 1)}, minmax(0,1fr)) 30px`, minWidth: 206 + Math.max(gridAgents.length, 1) * 90 + 30 }}
                  >
                    <div className="rounded px-2 py-1.5 text-[10px] font-bold text-white" style={{ background: 'oklch(0.24 0.01 260)' }}>
                      Vendredi
                    </div>
                    {gridAgents.map((a) => (
                      <div
                        key={personKey(a.personnelType, a.personnelId)}
                        className="truncate rounded px-2 py-1.5 text-center text-[10px] font-bold text-white"
                        style={{ background: 'oklch(0.24 0.01 260)' }}
                      >
                        {a.label}
                      </div>
                    ))}
                    <div className="rounded" style={{ background: 'oklch(0.24 0.01 260)' }} />

                    {vendredi.map((v) => (
                      <div key={v.id} className="contents">
                        <div className="flex items-center gap-1.5 rounded px-1.5 py-1" style={{ background: 'oklch(0.965 0.005 264)' }}>
                          <input
                            value={v.dateLabel}
                            onChange={(e) => updateVendrediDate.mutate({ id: v.id, dateLabel: e.target.value }, { onSuccess: onSaved })}
                            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[10.5px] font-semibold text-slate-700 focus:border-slate-300 focus:bg-white"
                          />
                          <button
                            type="button"
                            title={
                              v.mode === 'note'
                                ? 'Rétablir la garde : une colonne par agent'
                                : 'Passer en événement : garde annulée, colonnes fusionnées, tous présents'
                            }
                            onClick={() =>
                              toggleVendrediMode.mutate(
                                {
                                  vendrediId: v.id,
                                  periodeAgentIds: periodeAgents.map((pa) => pa.id),
                                  newMode: v.mode === 'note' ? 'marks' : 'note',
                                },
                                { onSuccess: onSaved }
                              )
                            }
                            className="shrink-0 rounded border border-slate-300 bg-white py-0.5 text-center text-[9px] font-bold text-slate-500"
                            style={{ width: 62 }}
                          >
                            {v.mode === 'note' ? 'Événement' : 'Garde'}
                          </button>
                        </div>

                        {v.mode === 'note' ? (
                          <div
                            className="flex items-center rounded border-l-[3px] px-2 py-1"
                            style={{
                              gridColumn: `span ${gridAgents.length}`,
                              background: 'oklch(0.96 0.035 264)',
                              borderColor: 'oklch(0.55 0.18 264)',
                            }}
                          >
                            <input
                              value={v.note}
                              onChange={(e) => updateVendrediNote.mutate({ id: v.id, note: e.target.value }, { onSuccess: onSaved })}
                              placeholder="Intitulé de l'événement"
                              dir={isArabic(v.note) ? 'rtl' : 'ltr'}
                              className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-[11px] font-semibold text-slate-700 focus:border-slate-300 focus:bg-white"
                              style={{ textAlign: isArabic(v.note) ? 'right' : 'left' }}
                            />
                          </div>
                        ) : (
                          periodeAgents.map((pa) => {
                            const pres = presence.find((p) => p.vendrediId === v.id && p.periodeAgentId === pa.id)
                            const isPresent = !!pres?.present
                            return (
                              <button
                                key={pa.id}
                                type="button"
                                onClick={() =>
                                  togglePresence.mutate({ vendrediId: v.id, periodeAgentId: pa.id, present: !isPresent }, { onSuccess: onSaved })
                                }
                                className="rounded text-center text-[11px] font-bold"
                                style={{
                                  background: isPresent ? 'oklch(0.965 0.005 264)' : 'oklch(0.99 0.003 90)',
                                  border: `1px solid ${isPresent ? 'oklch(0.9 0.005 90)' : 'oklch(0.95 0.005 90)'}`,
                                  color: isPresent ? 'oklch(0.45 0.01 260)' : 'oklch(0.75 0.01 260)',
                                }}
                              >
                                {isPresent ? 'X' : '—'}
                              </button>
                            )
                          })
                        )}

                        <button
                          type="button"
                          title="Supprimer cette ligne"
                          onClick={() => removeVendredi.mutate(v.id, { onSuccess: onSaved })}
                          className="rounded border border-rose-100 bg-rose-50 text-xs text-rose-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  Bouton <strong>Événement</strong> : la garde est annulée, les colonnes fusionnent en une seule bande et tous les agents sont
                  considérés présents. Bouton <strong>Garde</strong> : retour à la grille de présences, une case par agent (clic pour basculer
                  présent / absent).
                </p>
              </div>
            </>
          )}
        </div>
      </fieldset>

      {showPrint && selectedPeriodeId && (
        <GardePrintPreviewModal
          periode={periodes.find((p) => p.id === selectedPeriodeId)!}
          agents={gridAgents}
          creneaux={creneaux}
          affectations={affectations}
          evenements={evenements}
          familles={familles}
          vendredi={vendredi}
          periodeAgents={periodeAgents}
          presence={presence}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
