import { useState } from 'react'
import { Wrench, Search, Printer, PlusCircle, Coins, CalendarClock } from 'lucide-react'
import {
  STATUT_INCIDENT_ORDER,
  STATUT_INCIDENT_LABELS,
  type Incident,
  type StatutIncident,
  type BonCommande,
  type Priorite,
} from '../data/helpdesk'
import {
  useIncidents,
  useAddIncident,
  useUpdateIncidentStatut,
  useDeleteIncident,
  useUpdateBonCommande,
  useAddPrestataire,
  findPrestataireByNomSnapshot,
} from '../services/helpdeskService'
import { computeHelpdeskStats, filterIncidentsByPeriod } from '../utils/helpdeskAggregation'
import { formatPeriodLabel } from '../utils/period'
import IncidentCard from '../components/helpdesk/IncidentCard'
import IncidentModal from '../components/helpdesk/IncidentModal'
import BCModal from '../components/helpdesk/BCModal'
import BCPrintPreviewModal from '../components/helpdesk-print/BCPrintPreviewModal'
import HelpdeskBilanPreviewModal from '../components/helpdesk-print/HelpdeskBilanPreviewModal'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import { STATUT_DEMANDE_ORDER, TYPE_DEMANDE_LABELS, TYPE_DEMANDE_ICONS, type Demande, type StatutDemande, type TypeDemande } from '../data/helpdeskDemandes'
import { useDemandes, useAddDemande, useUpdateDemandeStatut, useDeleteDemande, useUpdateDemandeBonCommande } from '../services/helpdeskDemandesService'
import DemandeCard from '../components/helpdesk/DemandeCard'
import DemandeModal from '../components/helpdesk/DemandeModal'

const COLUMN_STYLE: Record<StatutIncident, { dot: string; header: string }> = {
  A_TRAITER: { dot: 'bg-rose-500', header: 'text-slate-800' },
  EN_COURS: { dot: 'bg-amber-500', header: 'text-slate-800' },
  RESOLU: { dot: 'bg-emerald-500', header: 'text-slate-800' },
}

const DEMANDE_COLUMN_STYLE: Record<StatutDemande, { dot: string; header: string }> = {
  A_PREPARER: { dot: 'bg-rose-500', header: 'text-slate-800' },
  EN_PREPARATION: { dot: 'bg-amber-500', header: 'text-slate-800' },
  PRET: { dot: 'bg-emerald-500', header: 'text-slate-800' },
}

type PageTab = 'incidents' | 'demandes'

export default function HelpdeskGlobal() {
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'helpdesk').canEdit
  // Même convention que CockpitLive.tsx (markedBy) : le vrai membre du staff connecté, pas un nom fabriqué.
  const currentUser = profile?.nomComplet || profile?.email || 'Direction'
  const [pageTab, setPageTab] = useState<PageTab>('incidents')
  const { data: incidents = [] } = useIncidents()
  const addIncidentMutation = useAddIncident()
  const updateStatutMutation = useUpdateIncidentStatut()
  const deleteIncidentMutation = useDeleteIncident()
  const updateBCMutation = useUpdateBonCommande()
  const addPrestataireMutation = useAddPrestataire()

  const [search, setSearch] = useState('')
  const [prioriteFilter, setPrioriteFilter] = useState<'TOUTES' | Priorite>('TOUTES')
  const [showNewModal, setShowNewModal] = useState(false)
  const [bcTarget, setBcTarget] = useState<Incident | null>(null)
  const [printTarget, setPrintTarget] = useState<{ incident: Incident; bc: BonCommande } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null)
  const [showBilan, setShowBilan] = useState(false)
  const [showBilanPreview, setShowBilanPreview] = useState(false)
  const [bilanStart, setBilanStart] = useState('')
  const [bilanEnd, setBilanEnd] = useState('')
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)

  const q = search.toLowerCase()
  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      !q ||
      inc.titre.toLowerCase().includes(q) ||
      inc.bc.numero.toLowerCase().includes(q) ||
      inc.bc.prestataireNom.toLowerCase().includes(q) ||
      inc.lieu.toLowerCase().includes(q)
    const matchesPriorite = prioriteFilter === 'TOUTES' || inc.priorite === prioriteFilter
    return matchesSearch && matchesPriorite
  })

  const stats = computeHelpdeskStats(incidents)
  const bilanIncidents = filterIncidentsByPeriod(incidents, bilanStart, bilanEnd)

  const handleAddIncident = (data: { titre: string; categorie: string; lieu: string; priorite: Priorite; description: string; declarant: string; photo?: string }) => {
    addIncidentMutation.mutate(data)
    setShowNewModal(false)
  }

  const handleStatutChange = (incident: Incident, statut: StatutIncident) => {
    updateStatutMutation.mutate({ id: incident.id, statut, auteur: currentUser })
  }

  const handleDrop = (statut: StatutIncident) => {
    if (!canEdit || !dragSourceId) return
    const incident = incidents.find((i) => i.id === dragSourceId)
    if (incident && incident.statut !== statut) {
      updateStatutMutation.mutate({ id: incident.id, statut, auteur: currentUser })
    }
    setDragSourceId(null)
  }

  const handleSaveBC = (bc: BonCommande, action: string) => {
    if (!bcTarget) return
    const nom = bc.prestataireNom.trim()
    if (nom && !findPrestataireByNomSnapshot(nom)) {
      addPrestataireMutation.mutate({ nom, typeIntervenant: bc.typeIntervenant, telephone: bc.prestataireContact })
    }
    updateBCMutation.mutate({ incidentId: bcTarget.id, bc, action, auteur: currentUser })
    setBcTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteIncidentMutation.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Helpdesk & Bons de Commande Maintenance</h1>
            <p className="mt-0.5 max-w-xl text-sm text-slate-500">
              Flux de validation (Brouillon → En attente Direction → Validé), filtrage intelligent des prestataires et calcul TTC.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBilan(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer Rapport Bilan
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            disabled={!canEdit}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Nouvelle Demande
          </button>
        </div>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            { key: 'incidents' as const, label: 'Pannes & Incidents', icon: Wrench },
            { key: 'demandes' as const, label: 'Améliorations & Activités', icon: CalendarClock },
          ]
        ).map((t) => {
          const Icon = t.icon
          const isActive = pageTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPageTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {pageTab === 'demandes' && <DemandesTab canEdit={canEdit} currentUser={currentUser} />}

      {pageTab === 'incidents' && (
      <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher panne, BC, prestataire, matériel..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <select
          value={prioriteFilter}
          onChange={(e) => setPrioriteFilter(e.target.value as 'TOUTES' | Priorite)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
        >
          <option value="TOUTES">Toutes priorités</option>
          <option value="URGENT">Urgent</option>
          <option value="NORMALE">Normale</option>
          <option value="BASSE">Basse</option>
        </select>
        <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          {stats.aTraiter} À traiter
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {stats.enCours} En cours
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {stats.resolu} Résolus / Validés
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
          <Coins className="h-3.5 w-3.5" />
          Cumul Travaux TTC : {stats.cumulTTCValide.toFixed(0)} DH
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {STATUT_INCIDENT_ORDER.map((statut) => {
          const columnIncidents = filtered.filter((inc) => inc.statut === statut)
          return (
            <div
              key={statut}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(statut)}
              className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className={`flex items-center gap-2 text-sm font-bold ${COLUMN_STYLE[statut].header}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_STYLE[statut].dot}`} />
                  {STATUT_INCIDENT_LABELS[statut]}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 shadow-sm">{columnIncidents.length}</span>
              </div>
              <div className="space-y-3">
                {columnIncidents.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">Aucun incident.</p>
                ) : (
                  columnIncidents.map((incident) => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      onStatutChange={(s) => handleStatutChange(incident, s)}
                      onGererBC={() => setBcTarget(incident)}
                      onImprimerBC={() => setPrintTarget({ incident, bc: incident.bc })}
                      onDelete={() => setDeleteTarget(incident)}
                      onDragStart={() => setDragSourceId(incident.id)}
                      canEdit={canEdit}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showNewModal && <IncidentModal onClose={() => setShowNewModal(false)} onSubmit={handleAddIncident} />}

      {bcTarget && (
        <BCModal
          incident={bcTarget}
          onClose={() => setBcTarget(null)}
          onSave={handleSaveBC}
          onPrint={(bc) => setPrintTarget({ incident: bcTarget, bc })}
        />
      )}

      {printTarget && <BCPrintPreviewModal incident={printTarget.incident} bc={printTarget.bc} onClose={() => setPrintTarget(null)} />}

      {showBilan && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowBilan(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-base font-bold text-slate-900">Rapport Bilan Helpdesk & Maintenance</h2>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-slate-500">Du :</span>
              <input type="date" value={bilanStart} onChange={(e) => setBilanStart(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-slate-500">Au :</span>
              <input type="date" value={bilanEnd} onChange={(e) => setBilanEnd(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <p className="mb-4 text-xs text-slate-400">Période : {formatPeriodLabel(bilanStart, bilanEnd)} · {bilanIncidents.length} incident(s)</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowBilan(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBilan(false)
                  setShowBilanPreview(true)
                }}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
              >
                Générer le Rapport
              </button>
            </div>
          </div>
        </div>
      )}

      {showBilanPreview && (
        <HelpdeskBilanPreviewModal start={bilanStart} end={bilanEnd} incidents={bilanIncidents} onClose={() => setShowBilanPreview(false)} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-bold text-slate-900">Supprimer cet incident ?</h2>
            <p className="mb-4 text-sm text-slate-500">
              « {deleteTarget.titre} » sera définitivement supprimé, y compris son bon de commande associé.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button type="button" onClick={handleConfirmDelete} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

function DemandesTab({ canEdit, currentUser }: { canEdit: boolean; currentUser: string }) {
  const { data: demandes = [] } = useDemandes()
  const addDemandeMutation = useAddDemande()
  const updateStatutMutation = useUpdateDemandeStatut()
  const deleteDemandeMutation = useDeleteDemande()
  const updateBCMutation = useUpdateDemandeBonCommande()
  const addPrestataireMutation = useAddPrestataire()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'TOUS' | TypeDemande>('TOUS')
  const [showNewModal, setShowNewModal] = useState(false)
  const [bcTarget, setBcTarget] = useState<Demande | null>(null)
  const [printTarget, setPrintTarget] = useState<{ demande: Demande; bc: BonCommande } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Demande | null>(null)
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)

  const q = search.toLowerCase()
  const filtered = demandes.filter((d) => {
    const matchesSearch = !q || d.titre.toLowerCase().includes(q) || d.lieu.toLowerCase().includes(q) || d.declarant.toLowerCase().includes(q)
    const matchesType = typeFilter === 'TOUS' || d.type === typeFilter
    return matchesSearch && matchesType
  })

  const stats = {
    aPreparer: demandes.filter((d) => d.statut === 'A_PREPARER').length,
    enPreparation: demandes.filter((d) => d.statut === 'EN_PREPARATION').length,
    pret: demandes.filter((d) => d.statut === 'PRET').length,
  }

  const handleAddDemande = (data: {
    type: TypeDemande
    titre: string
    lieu: string
    description: string
    priorite: Priorite
    dateCible: string
    heureCible?: string
    declarant: string
  }) => {
    addDemandeMutation.mutate(data)
    setShowNewModal(false)
  }

  const handleStatutChange = (demande: Demande, statut: StatutDemande) => {
    updateStatutMutation.mutate({ id: demande.id, statut, auteur: currentUser })
  }

  const handleDrop = (statut: StatutDemande) => {
    if (!canEdit || !dragSourceId) return
    const demande = demandes.find((d) => d.id === dragSourceId)
    if (demande && demande.statut !== statut) {
      updateStatutMutation.mutate({ id: demande.id, statut, auteur: currentUser })
    }
    setDragSourceId(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteDemandeMutation.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleSaveBC = (bc: BonCommande, action: string) => {
    if (!bcTarget) return
    const nom = bc.prestataireNom.trim()
    if (nom && !findPrestataireByNomSnapshot(nom)) {
      addPrestataireMutation.mutate({ nom, typeIntervenant: bc.typeIntervenant, telephone: bc.prestataireContact })
    }
    updateBCMutation.mutate({ demandeId: bcTarget.id, bc, action, auteur: currentUser })
    setBcTarget(null)
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher titre, lieu, déclarant..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'TOUS' | TypeDemande)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
        >
          <option value="TOUS">Tous types</option>
          <option value="AMELIORATION">{TYPE_DEMANDE_ICONS.AMELIORATION} {TYPE_DEMANDE_LABELS.AMELIORATION}</option>
          <option value="ACTIVITE_PREPARATION">{TYPE_DEMANDE_ICONS.ACTIVITE_PREPARATION} {TYPE_DEMANDE_LABELS.ACTIVITE_PREPARATION}</option>
        </select>
        <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          {stats.aPreparer} À préparer
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {stats.enPreparation} En préparation
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {stats.pret} Prêt · Réalisé
        </span>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          disabled={!canEdit}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Nouvelle Amélioration / Activité
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {STATUT_DEMANDE_ORDER.map((statut) => {
          const columnDemandes = filtered.filter((d) => d.statut === statut)
          return (
            <div
              key={statut}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(statut)}
              className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className={`flex items-center gap-2 text-sm font-bold ${DEMANDE_COLUMN_STYLE[statut].header}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${DEMANDE_COLUMN_STYLE[statut].dot}`} />
                  {statut === 'A_PREPARER' ? 'À Préparer' : statut === 'EN_PREPARATION' ? 'En Préparation' : 'Prêt · Réalisé'}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 shadow-sm">{columnDemandes.length}</span>
              </div>
              <div className="space-y-3">
                {columnDemandes.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">Aucune demande.</p>
                ) : (
                  columnDemandes.map((demande) => (
                    <DemandeCard
                      key={demande.id}
                      demande={demande}
                      onStatutChange={(s) => handleStatutChange(demande, s)}
                      onGererBC={() => setBcTarget(demande)}
                      onImprimerBC={() => setPrintTarget({ demande, bc: demande.bc })}
                      onDelete={() => setDeleteTarget(demande)}
                      onDragStart={() => setDragSourceId(demande.id)}
                      canEdit={canEdit}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showNewModal && <DemandeModal onClose={() => setShowNewModal(false)} onSubmit={handleAddDemande} />}

      {bcTarget && (
        <BCModal
          incident={bcTarget}
          onClose={() => setBcTarget(null)}
          onSave={handleSaveBC}
          onPrint={(bc) => setPrintTarget({ demande: bcTarget, bc })}
        />
      )}

      {printTarget && <BCPrintPreviewModal incident={printTarget.demande} bc={printTarget.bc} onClose={() => setPrintTarget(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-bold text-slate-900">Supprimer cette demande ?</h2>
            <p className="mb-4 text-sm text-slate-500">« {deleteTarget.titre} » sera définitivement supprimée.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button type="button" onClick={handleConfirmDelete} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
