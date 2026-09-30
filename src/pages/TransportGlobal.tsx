import { useMemo, useState, lazy, Suspense } from 'react'
import { Bus, Car, Users2, Search, CheckSquare, AlertTriangle, Phone, Printer, FileSpreadsheet, History, Upload } from 'lucide-react'
import { getClassOptions, type Student } from '../data/students'
import { TRANSPORT_PARENTS, type StudentIdentity } from '../data/studentIdentity'
import { NIVEAUX } from '../data/referentiel'
import { useTransportLignes, useUpdateTransportLigne, type TransportLigne } from '../services/transportLignesService'
import { useChauffeurs, type Chauffeur } from '../services/chauffeursService'
import { useAidesMaitresses, type AideMaitresse } from '../services/aidesMaitressesService'
import { useServicesCapacite, useUpdateServicesCapacite, type ServicesCapacite } from '../services/servicesCapaciteService'
import { useLogTransportRotationChange } from '../services/transportRotationHistoryService'
import { useStudents } from '../services/studentsService'
import { useClasses } from '../services/classesService'
import type { SchoolClass } from '../data/schoolStructure'
import { useStudentIdentities, useUpdateStudentTransportAffectation } from '../services/studentIdentityService'
import { cycleOfClasse } from '../utils/alertEngine'
import { occupancyLevel, occupancyPct } from '../utils/reportsBIAggregation'
import { telHref } from '../utils/identityHelpers'
import { downloadCSV } from '../utils/csvExport'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import type { TransportLigneDocData } from '../components/transport-print/TransportLignesPrintPreviewModal'
import type { TransportAdminClasseGroup, TransportAdminLigneInfo, TransportAdminNonAffecteRow } from '../components/transport-print/PrintableTransportAdminListe'
import type { TransportTrajetInput, TransportTrajetStudent } from '../utils/transportRoutePagination'
import TransportRotationHistoryModal from '../components/transport/TransportRotationHistoryModal'
import TransportImportModal from '../components/transport/TransportImportModal'

const TransportLignePrintPreviewModal = lazy(() => import('../components/transport-print/TransportLignePrintPreviewModal'))
const TransportLignesPrintPreviewModal = lazy(() => import('../components/transport-print/TransportLignesPrintPreviewModal'))
const TransportLignesInfoPrintPreviewModal = lazy(() => import('../components/transport-print/TransportLignesInfoPrintPreviewModal'))
const TransportAdminListePrintPreviewModal = lazy(() => import('../components/transport-print/TransportAdminListePrintPreviewModal'))

interface TransportGlobalProps {
  onDataChanged?: () => void
}

type PageTab = 'lignes' | 'eleves'

const PAGE_TABS: { key: PageTab; label: string; icon: typeof Bus }[] = [
  { key: 'lignes', label: 'Lignes', icon: Bus },
  { key: 'eleves', label: 'Élèves', icon: Users2 },
]

const MOTIFS = ['Frère / sœur au collège', 'Activité extrascolaire', 'Soutien scolaire', 'Autre'] as const

const OCCUPANCY_BAR_CLASS = { ok: 'bg-emerald-500', warn: 'bg-amber-500', over: 'bg-rose-500' }
const OCCUPANCY_TEXT_CLASS = { ok: 'text-emerald-600', warn: 'text-amber-600', over: 'text-rose-600' }

/** "16:30:00"/"16:30" → "16h30" — les horaires de départ affichés (cartes de ligne, rapport imprimé)
 * doivent toujours refléter l'heure réellement configurée dans "Horaires (communs aux 5 lignes)",
 * jamais un "16h"/"17h" écrit en dur qui se désynchronise dès que l'admin change l'horaire réel. */
function formatHeureFR(t: string | undefined): string {
  return t ? t.slice(0, 5).replace(':', 'h') : '—'
}

type LigneUpdatePatch = {
  id: string
  trajet?: string
  capacite?: number
  chauffeurId?: string | null
  aideId?: string | null
  faitCollege?: boolean
}

type HorairesPatch = {
  transportHeureMatin?: string
  transportHeureSoirPrimaire?: string
  transportHeureSoirCollege?: string
  transportWhatsappGroupeUrl?: string
}

type AffectationPatch = {
  transportLigne?: string | null
  transportLigneSoir?: string | null
  transportSortie17h?: boolean
  transportMotifException?: string | null
  transportMotifAutre?: string | null
}

/** Ligne effective du soir : l'override transportLigneSoir s'il est renseigné, sinon la ligne du matin. */
function effectiveSoirLigne(identity: StudentIdentity | undefined): string | null {
  return identity?.transportLigneSoir || identity?.transportLigne || null
}

export default function TransportGlobal({ onDataChanged }: TransportGlobalProps) {
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'transport').canEdit
  const [pageTab, setPageTab] = useState<PageTab>('lignes')

  const { data: lignes = [] } = useTransportLignes()
  const { data: chauffeurs = [] } = useChauffeurs()
  const { data: aides = [] } = useAidesMaitresses()
  const { data: capacite } = useServicesCapacite()
  const { data: students = [] } = useStudents()
  const { data: identities = {} } = useStudentIdentities()
  const { data: classes = [] } = useClasses()

  const updateLigne = useUpdateTransportLigne()
  const updateCapacite = useUpdateServicesCapacite()
  const updateAffectation = useUpdateStudentTransportAffectation()
  const logRotation = useLogTransportRotationChange()

  const elevesTransport = useMemo(
    () => students.filter((s) => identities[s.id]?.transport).sort((a, b) => a.name.localeCompare(b.name)),
    [students, identities]
  )

  const effectifParLigne = useMemo(() => {
    const map: Record<string, number> = {}
    elevesTransport.forEach((s) => {
      const ligne = identities[s.id]?.transportLigne
      if (ligne) map[ligne] = (map[ligne] ?? 0) + 1
    })
    return map
  }, [elevesTransport, identities])

  // Le soir se scinde en deux départs distincts sur la ligne effective du soir (override si
  // renseigné, sinon la ligne du matin) : 16h pour le primaire normal, 17h pour les collégiens et
  // les primaires en exception. Jauges séparées du matin pour ne pas masquer une ligne pleine le
  // soir derrière un effectif matin qui semble correct — et désormais exactes (plus une
  // approximation globale) puisqu'on connaît la ligne du soir de chaque élève individuellement.
  const effectifSoir16hParLigne = useMemo(() => {
    const map: Record<string, number> = {}
    elevesTransport.forEach((s) => {
      const identity = identities[s.id]
      if (cycleOfClasse(s.classe) === 'college' || identity?.transportSortie17h) return
      const ligne = effectiveSoirLigne(identity)
      if (ligne) map[ligne] = (map[ligne] ?? 0) + 1
    })
    return map
  }, [elevesTransport, identities])

  const effectifSoir17hParLigne = useMemo(() => {
    const map: Record<string, number> = {}
    elevesTransport.forEach((s) => {
      const identity = identities[s.id]
      if (cycleOfClasse(s.classe) !== 'college' && !identity?.transportSortie17h) return
      const ligne = effectiveSoirLigne(identity)
      if (ligne) map[ligne] = (map[ligne] ?? 0) + 1
    })
    return map
  }, [elevesTransport, identities])

  const lignesCollege = lignes.filter((l) => l.faitCollege)

  const handleUpdateLigne = (patch: LigneUpdatePatch) => {
    updateLigne.mutate(patch)
    if (patch.faitCollege !== undefined) {
      if (capacite) {
        updateCapacite.mutate({ id: capacite.id, transportRotationUpdatedAt: new Date().toISOString() })
      }
      const nouvellesLignesCollege = lignes
        .filter((l) => (l.id === patch.id ? patch.faitCollege : l.faitCollege))
        .map((l) => l.nom)
      logRotation.mutate(nouvellesLignesCollege)
    }
    onDataChanged?.()
  }

  const handleUpdateHoraires = (patch: HorairesPatch) => {
    if (!capacite) return
    updateCapacite.mutate({ id: capacite.id, ...patch })
    onDataChanged?.()
  }

  const handleUpdateAffectation = (studentId: string, patch: AffectationPatch) => {
    updateAffectation.mutate({ studentId, ...patch })
    onDataChanged?.()
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 p-5 text-white shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Bus className="h-5 w-5" />
            Transport
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/80">
            5 lignes (A à E) — trajets, chauffeurs, aides-maîtresses, rotation hebdomadaire du trajet collège et affectation des élèves.
          </p>
        </div>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {PAGE_TABS.map((t) => {
          const Icon = t.icon
          const isActive = pageTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPageTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <fieldset disabled={!canEdit} className="contents">
        {pageTab === 'lignes' && (
          <LignesTab
            lignes={lignes}
            chauffeurs={chauffeurs}
            aides={aides}
            effectifParLigne={effectifParLigne}
            effectifSoir16hParLigne={effectifSoir16hParLigne}
            effectifSoir17hParLigne={effectifSoir17hParLigne}
            capacite={capacite}
            elevesTransport={elevesTransport}
            identities={identities}
            classes={classes}
            onUpdateLigne={handleUpdateLigne}
            onUpdateHoraires={handleUpdateHoraires}
          />
        )}
        {pageTab === 'eleves' && (
          <ElevesTab eleves={elevesTransport} identities={identities} lignes={lignes} lignesCollege={lignesCollege} onUpdate={handleUpdateAffectation} />
        )}
      </fieldset>
    </div>
  )
}

function formatDateTimeFR(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

function LignesTab({
  lignes,
  chauffeurs,
  aides,
  effectifParLigne,
  effectifSoir16hParLigne,
  effectifSoir17hParLigne,
  capacite,
  elevesTransport,
  identities,
  classes,
  onUpdateLigne,
  onUpdateHoraires,
}: {
  lignes: TransportLigne[]
  chauffeurs: Chauffeur[]
  aides: AideMaitresse[]
  effectifParLigne: Record<string, number>
  effectifSoir16hParLigne: Record<string, number>
  effectifSoir17hParLigne: Record<string, number>
  capacite: ServicesCapacite | undefined
  elevesTransport: Student[]
  identities: Record<string, StudentIdentity>
  classes: SchoolClass[]
  onUpdateLigne: (patch: LigneUpdatePatch) => void
  onUpdateHoraires: (patch: HorairesPatch) => void
}) {
  const [printLigne, setPrintLigne] = useState<TransportLigne | null>(null)
  const [printAll, setPrintAll] = useState(false)
  const [showLignesInfo, setShowLignesInfo] = useState(false)
  const [showAdminListe, setShowAdminListe] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const nbCollege = lignes.filter((l) => l.faitCollege).length

  const toStudentRow = (s: Student): TransportTrajetStudent => {
    const identity = identities[s.id]
    return {
      name: s.name,
      classe: s.classe,
      motif: identity?.transportSortie17h
        ? (identity.transportMotifException === 'Autre' ? identity.transportMotifAutre || 'Autre' : identity.transportMotifException) ?? undefined
        : undefined,
    }
  }

  const buildTrajetsRaw = (ligne: TransportLigne): TransportTrajetInput[] => {
    const rosterMatin = elevesTransport.filter((s) => identities[s.id]?.transportLigne === ligne.nom)
    const rosterSoir = elevesTransport.filter((s) => effectiveSoirLigne(identities[s.id]) === ligne.nom)
    const soir16h = rosterSoir.filter((s) => cycleOfClasse(s.classe) !== 'college' && !identities[s.id]?.transportSortie17h)
    const soir17h = rosterSoir.filter((s) => cycleOfClasse(s.classe) === 'college' || identities[s.id]?.transportSortie17h)

    const trajets: TransportTrajetInput[] = [
      {
        label: '1er Trajet — Matin',
        time: formatHeureFR(capacite?.transportHeureMatin),
        icon: '☀️',
        isMatin: true,
        hasMotif: false,
        students: rosterMatin.map(toStudentRow),
        emptyMsg: 'Aucun élève affecté à cette ligne.',
      },
      {
        label: '2e Trajet — Soir · Primaire',
        time: formatHeureFR(capacite?.transportHeureSoirPrimaire),
        icon: '🌤️',
        isMatin: false,
        hasMotif: false,
        students: soir16h.map(toStudentRow),
        emptyMsg: 'Aucun élève sur ce départ.',
      },
    ]
    // Le trajet collège n'existe que s'il y a une demande réelle (collégiens ou primaires en
    // exception affectés à cette ligne le soir) — pas de bloc vide sur les lignes non collège.
    if (soir17h.length > 0) {
      trajets.push({
        label: '2e Trajet — Soir · Collège',
        time: formatHeureFR(capacite?.transportHeureSoirCollege),
        icon: '🌙',
        isMatin: false,
        hasMotif: true,
        students: soir17h.map(toStudentRow),
        emptyMsg: 'Aucun élève sur ce départ.',
      })
    }
    return trajets
  }

  const buildDocData = (ligne: TransportLigne): TransportLigneDocData => ({
    ligneNom: ligne.nom,
    trajet: ligne.trajet,
    chauffeurNom: chauffeurs.find((c) => c.id === ligne.chauffeurId)?.nom ?? null,
    chauffeurTel: chauffeurs.find((c) => c.id === ligne.chauffeurId)?.telephone ?? null,
    aideNom: aides.find((a) => a.id === ligne.aideId)?.nom ?? null,
    aideTel: aides.find((a) => a.id === ligne.aideId)?.telephone ?? null,
    heureMatin: formatHeureFR(capacite?.transportHeureMatin),
    heureSoirPrimaire: formatHeureFR(capacite?.transportHeureSoirPrimaire),
    trajetsRaw: buildTrajetsRaw(ligne),
  })

  // Tri partagé niveau (maternelle → primaire → collège) puis classe puis nom — utilisé par la
  // liste administrative groupée par classe et par la liste des non-affectés ci-dessous.
  const sortByNiveauClasseNom = (list: Student[]): Student[] => {
    const classeToNiveau = new Map(classes.map((c) => [c.nom, c.niveau]))
    const niveauIndex = (classe: string) => {
      const idx = NIVEAUX.indexOf(classeToNiveau.get(classe) ?? '')
      return idx === -1 ? NIVEAUX.length : idx
    }
    return [...list].sort((a, b) => {
      const ni = niveauIndex(a.classe) - niveauIndex(b.classe)
      if (ni !== 0) return ni
      const ci = a.classe.localeCompare(b.classe)
      if (ci !== 0) return ci
      return a.name.localeCompare(b.name)
    })
  }

  // Liste informative pour l'administration (qui part avec quel transport, pas de suivi de
  // présence) : triée par niveau (maternelle → primaire → collège) puis classe puis nom, groupée
  // par classe pour l'impression.
  const buildAdminGroups = (): TransportAdminClasseGroup[] => {
    const sorted = sortByNiveauClasseNom(elevesTransport)
    const groups: TransportAdminClasseGroup[] = []
    sorted.forEach((s) => {
      const identity = identities[s.id]
      const row = {
        name: s.name,
        ligneMatin: identity?.transportLigne ?? null,
        ligneSoir: effectiveSoirLigne(identity),
        sortie17h: identity?.transportSortie17h ?? false,
        motif: identity?.transportSortie17h
          ? identity.transportMotifException === 'Autre'
            ? identity.transportMotifAutre || 'Autre'
            : identity.transportMotifException
          : null,
      }
      const last = groups[groups.length - 1]
      if (last && last.classe === s.classe) last.rows.push(row)
      else groups.push({ classe: s.classe, rows: [row] })
    })
    return groups
  }

  // Élèves ayant le transport activé sur leur fiche mais jamais affectés à une ligne du matin —
  // même critère que le bandeau d'alerte de l'onglet Élèves (nbNonAffecte ci-dessous), pour que la
  // liste imprimée serve de vraie checklist actionnable plutôt que de laisser ces élèves dilués sans
  // signalement particulier au milieu des tableaux par classe (où ils n'affichent qu'un simple "—").
  const buildNonAffectes = (): TransportAdminNonAffecteRow[] =>
    sortByNiveauClasseNom(elevesTransport.filter((s) => !identities[s.id]?.transportLigne)).map((s) => ({ name: s.name, classe: s.classe }))

  const buildLignesInfo = (): TransportAdminLigneInfo[] =>
    lignes.map((l) => ({
      ligneNom: l.nom,
      chauffeurNom: chauffeurs.find((c) => c.id === l.chauffeurId)?.nom ?? null,
      chauffeurTel: chauffeurs.find((c) => c.id === l.chauffeurId)?.telephone ?? null,
      aideNom: aides.find((a) => a.id === l.aideId)?.nom ?? null,
      aideTel: aides.find((a) => a.id === l.aideId)?.telephone ?? null,
    }))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">
          Rotation hebdomadaire — trajet collège ({formatHeureFR(capacite?.transportHeureSoirCollege)})
        </h3>
        <p className="mb-3 text-xs text-slate-400">
          Cochez les lignes qui assurent le retour du collège cette semaine ({nbCollege} ligne{nbCollege !== 1 ? 's' : ''} sélectionnée
          {nbCollege !== 1 ? 's' : ''}).
        </p>
        <div className="mb-3 flex flex-wrap gap-3">
          {lignes.map((l) => (
            <label key={l.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={l.faitCollege} onChange={(e) => onUpdateLigne({ id: l.id, faitCollege: e.target.checked })} />
              Ligne {l.nom}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <History className="h-3.5 w-3.5" />
            {capacite?.transportRotationUpdatedAt
              ? `Dernière modification : ${formatDateTimeFR(capacite.transportRotationUpdatedAt)}`
              : 'Pas encore modifiée cette année.'}
          </p>
          <button type="button" onClick={() => setShowHistory(true)} className="text-[11px] font-medium text-indigo-600 hover:underline">
            Voir l'historique
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Horaires (communs aux 5 lignes)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Départ du matin</label>
            <input
              type="time"
              value={capacite?.transportHeureMatin ?? ''}
              onChange={(e) => onUpdateHoraires({ transportHeureMatin: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Retour du soir — Primaire</label>
            <input
              type="time"
              value={capacite?.transportHeureSoirPrimaire ?? ''}
              onChange={(e) => onUpdateHoraires({ transportHeureSoirPrimaire: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Retour du soir — Collège</label>
            <input
              type="time"
              value={capacite?.transportHeureSoirCollege ?? ''}
              onChange={(e) => onUpdateHoraires({ transportHeureSoirCollege: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Lien du groupe WhatsApp de l'équipe transport</label>
          <input
            type="url"
            value={capacite?.transportWhatsappGroupeUrl ?? ''}
            onChange={(e) => onUpdateHoraires({ transportWhatsappGroupeUrl: e.target.value })}
            placeholder="https://chat.whatsapp.com/..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Lien d'invitation du groupe (menu du groupe → Inviter via lien) — utilisé pour prévenir l'équipe transport des sorties/retours
            anticipés d'élèves affectés à une ligne.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAdminListe(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          title="Liste simple par classe, sans suivi de présence — pour savoir qui part avec quel transport"
        >
          <Printer className="h-4 w-4 text-indigo-600" />
          Imprimer la liste administrative
        </button>
        <button
          type="button"
          onClick={() => setShowLignesInfo(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          title="Détail par ligne et par trajet, sans suivi de présence — pour savoir qui part avec quel transport"
        >
          <Printer className="h-4 w-4 text-indigo-600" />
          Imprimer les infos par ligne (sans pointage)
        </button>
        <button
          type="button"
          onClick={() => setPrintAll(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4 text-indigo-600" />
          Imprimer toutes les feuilles de route
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lignes.map((l) => {
          const effectif = effectifParLigne[l.nom] ?? 0
          const pct = occupancyPct(effectif, l.capacite)
          const level = occupancyLevel(effectif, l.capacite)
          return (
            <div key={l.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-600">{l.nom}</span>
                  Ligne {l.nom}
                </h3>
                <div className="flex items-center gap-2">
                  {l.faitCollege && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">Collège cette semaine</span>}
                  <button
                    type="button"
                    onClick={() => setPrintLigne(l)}
                    title="Imprimer la feuille de route de cette ligne"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <label className="mb-1 block text-xs font-semibold text-slate-500">Trajet (quartiers desservis)</label>
              <input
                value={l.trajet}
                onChange={(e) => onUpdateLigne({ id: l.id, trajet: e.target.value })}
                placeholder="Ex : Quartier Riad, Hay Salam..."
                className="mb-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Chauffeur</label>
                  <select
                    value={l.chauffeurId ?? ''}
                    onChange={(e) => onUpdateLigne({ id: l.id, chauffeurId: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">— Non assigné —</option>
                    {chauffeurs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const chauffeur = chauffeurs.find((c) => c.id === l.chauffeurId)
                    return (
                      chauffeur?.telephone && (
                        <a href={telHref(chauffeur.telephone)} className="mt-1 flex items-center gap-1 text-[11px] text-sky-600 hover:underline">
                          <Phone className="h-3 w-3" />
                          {chauffeur.telephone}
                        </a>
                      )
                    )
                  })()}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Aide-maîtresse</label>
                  <select
                    value={l.aideId ?? ''}
                    onChange={(e) => onUpdateLigne({ id: l.id, aideId: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">— Non assignée —</option>
                    {aides.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nom}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const aide = aides.find((a) => a.id === l.aideId)
                    return (
                      aide?.telephone && (
                        <a href={telHref(aide.telephone)} className="mt-1 flex items-center gap-1 text-[11px] text-sky-600 hover:underline">
                          <Phone className="h-3 w-3" />
                          {aide.telephone}
                        </a>
                      )
                    )
                  })()}
                </div>
              </div>

              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500">Capacité</label>
                <input
                  type="number"
                  min={0}
                  value={l.capacite}
                  onChange={(e) => onUpdateLigne({ id: l.id, capacite: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                />
              </div>
              <p className="mb-1 text-xs text-slate-500">
                {effectif} / {l.capacite} élèves affectés (matin)
              </p>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div className={`h-1.5 rounded-full ${OCCUPANCY_BAR_CLASS[level]}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`mt-1 text-[11px] font-semibold ${OCCUPANCY_TEXT_CLASS[level]}`}>{pct}% occupé</p>

              <div className="mt-3 border-t border-slate-100 pt-3">
                {(() => {
                  const effectifSoir16h = effectifSoir16hParLigne[l.nom] ?? 0
                  const pctSoir16h = occupancyPct(effectifSoir16h, l.capacite)
                  const levelSoir16h = occupancyLevel(effectifSoir16h, l.capacite)
                  const heureSoir16h = formatHeureFR(capacite?.transportHeureSoirPrimaire)
                  return (
                    <>
                      <p className="mb-1 text-xs text-slate-500">
                        {effectifSoir16h} / {l.capacite} élèves (départ {heureSoir16h})
                      </p>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div className={`h-1.5 rounded-full ${OCCUPANCY_BAR_CLASS[levelSoir16h]}`} style={{ width: `${pctSoir16h}%` }} />
                      </div>
                      <p className={`mt-1 text-[11px] font-semibold ${OCCUPANCY_TEXT_CLASS[levelSoir16h]}`}>{pctSoir16h}% occupé ({heureSoir16h})</p>
                    </>
                  )
                })()}
              </div>

              {l.faitCollege && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {(() => {
                    const effectifSoir17h = effectifSoir17hParLigne[l.nom] ?? 0
                    const pctSoir17h = occupancyPct(effectifSoir17h, l.capacite)
                    const levelSoir17h = occupancyLevel(effectifSoir17h, l.capacite)
                    const heureSoir17h = formatHeureFR(capacite?.transportHeureSoirCollege)
                    return (
                      <>
                        <p className="mb-1 text-xs text-slate-500">
                          {effectifSoir17h} / {l.capacite} élèves (départ {heureSoir17h})
                        </p>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div className={`h-1.5 rounded-full ${OCCUPANCY_BAR_CLASS[levelSoir17h]}`} style={{ width: `${pctSoir17h}%` }} />
                        </div>
                        <p className={`mt-1 text-[11px] font-semibold ${OCCUPANCY_TEXT_CLASS[levelSoir17h]}`}>{pctSoir17h}% occupé ({heureSoir17h})</p>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Car className="h-3.5 w-3.5" />
        Gérez les listes de chauffeurs et d'aides-maîtresses depuis le module « Personnel » (groupe Services).
      </p>

      {printLigne && (
        <Suspense fallback={null}>
          <TransportLignePrintPreviewModal {...buildDocData(printLigne)} onClose={() => setPrintLigne(null)} />
        </Suspense>
      )}

      {printAll && (
        <Suspense fallback={null}>
          <TransportLignesPrintPreviewModal lignes={lignes.map(buildDocData)} onClose={() => setPrintAll(false)} />
        </Suspense>
      )}

      {showLignesInfo && (
        <Suspense fallback={null}>
          <TransportLignesInfoPrintPreviewModal lignes={lignes.map(buildDocData)} onClose={() => setShowLignesInfo(false)} />
        </Suspense>
      )}

      {showAdminListe && (
        <Suspense fallback={null}>
          <TransportAdminListePrintPreviewModal
            groups={buildAdminGroups()}
            lignesInfo={buildLignesInfo()}
            nonAffectes={buildNonAffectes()}
            total={elevesTransport.length}
            onClose={() => setShowAdminListe(false)}
          />
        </Suspense>
      )}

      {showHistory && <TransportRotationHistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  )
}

const LIGNE_FILTER_NON_AFFECTE = '__non_affecte__'

function ElevesTab({
  eleves,
  identities,
  lignes,
  lignesCollege,
  onUpdate,
}: {
  eleves: Student[]
  identities: Record<string, StudentIdentity>
  lignes: TransportLigne[]
  lignesCollege: TransportLigne[]
  onUpdate: (studentId: string, patch: AffectationPatch) => void
}) {
  const [search, setSearch] = useState('')
  const [filterClasse, setFilterClasse] = useState('Toutes les classes')
  const [filterLigne, setFilterLigne] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLigne, setBulkLigne] = useState('')
  const [showImport, setShowImport] = useState(false)

  // Compté sur la classe actuellement filtrée (pas globalement) : l'admin peut ainsi choisir une
  // classe et voir immédiatement combien d'élèves de CETTE classe restent à affecter.
  const nbNonAffecte = useMemo(
    () =>
      eleves.filter((s) => (filterClasse === 'Toutes les classes' || s.classe === filterClasse) && !identities[s.id]?.transportLigne)
        .length,
    [eleves, identities, filterClasse]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return eleves.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (filterClasse !== 'Toutes les classes' && s.classe !== filterClasse) return false
      const identity = identities[s.id]
      const ligneMatin = identity?.transportLigne ?? ''
      if (filterLigne === LIGNE_FILTER_NON_AFFECTE && ligneMatin) return false
      // Matin OU soir : un admin qui filtre "Ligne C" veut voir tous les élèves qui montent dans
      // sa ligne à un moment ou un autre de la journée, pas seulement le matin.
      if (filterLigne && filterLigne !== LIGNE_FILTER_NON_AFFECTE && ligneMatin !== filterLigne && effectiveSoirLigne(identity) !== filterLigne) return false
      return true
    })
  }, [eleves, identities, search, filterClasse, filterLigne])

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filtered.forEach((s) => next.delete(s.id))
      } else {
        filtered.forEach((s) => next.add(s.id))
      }
      return next
    })
  }

  const toggleSelectOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedStudents = eleves.filter((s) => selected.has(s.id))
  const hasCollegeSelected = selectedStudents.some((s) => cycleOfClasse(s.classe) === 'college')
  const bulkLigneOptions = hasCollegeSelected ? lignesCollege : lignes

  const handleBulkApply = () => {
    // Affecte matin ET soir à la même ligne — le cas courant. Les exceptions (élève qui repart
    // sur une autre ligne le soir) se règlent ensuite ligne par ligne dans le tableau.
    selectedStudents.forEach((s) => onUpdate(s.id, { transportLigne: bulkLigne || null, transportLigneSoir: bulkLigne || null }))
    setSelected(new Set())
    setBulkLigne('')
  }

  const handleExportCSV = () => {
    const headers = ['Élève', 'Classe', 'Ligne (matin)', 'Ligne (soir)', 'Sortie 17h', 'Motif', 'Motif (autre)']
    const rows = filtered.map((s) => {
      const identity = identities[s.id]
      return [
        s.name,
        s.classe,
        identity?.transportLigne ?? '',
        identity?.transportLigneSoir ?? '',
        identity?.transportSortie17h ? 'Oui' : 'Non',
        identity?.transportMotifException ?? '',
        identity?.transportMotifAutre ?? '',
      ]
    })
    downloadCSV(`transport-eleves-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return (
    <div className="space-y-3">
      {nbNonAffecte > 0 && (
        <button
          type="button"
          onClick={() => {
            setFilterLigne(LIGNE_FILTER_NON_AFFECTE)
            setSearch('')
          }}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left shadow-sm hover:bg-amber-100"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {nbNonAffecte} élève{nbNonAffecte !== 1 ? 's' : ''} non affecté{nbNonAffecte !== 1 ? 's' : ''} à une ligne de transport
            {filterClasse !== 'Toutes les classes' ? ` — ${filterClasse}` : ''}
          </span>
          <span className="text-xs font-medium text-amber-600 underline">Afficher</span>
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un élève..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <select
          value={filterClasse}
          onChange={(e) => setFilterClasse(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
        >
          {getClassOptions().map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterLigne}
          onChange={(e) => setFilterLigne(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
        >
          <option value="">Toutes les lignes</option>
          <option value={LIGNE_FILTER_NON_AFFECTE}>Non affecté</option>
          {lignes.map((l) => (
            <option key={l.id} value={l.nom}>
              Ligne {l.nom}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          {filtered.length} élève{filtered.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Upload className="h-4 w-4 text-indigo-600" />
          Importer Excel
        </button>
        <button
          type="button"
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          Exporter Excel
        </button>
      </div>

      {showImport && (
        <TransportImportModal
          lignesCollegeNoms={lignesCollege.map((l) => l.nom)}
          onClose={() => setShowImport(false)}
          onConfirm={(accepted) => {
            accepted.forEach((a) => onUpdate(a.studentId, { transportLigne: a.ligne, transportLigneSoir: a.ligne }))
            setShowImport(false)
          }}
        />
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
          <CheckSquare className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-indigo-700">{selected.size} élève(s) sélectionné(s)</span>
          <select
            value={bulkLigne}
            onChange={(e) => setBulkLigne(e.target.value)}
            className="rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">— Retirer l'affectation —</option>
            {bulkLigneOptions.map((l) => (
              <option key={l.id} value={l.nom}>
                Affecter à la ligne {l.nom} (matin et soir)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkApply}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Appliquer
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
          >
            Annuler la sélection
          </button>
          {hasCollegeSelected && (
            <span className="text-[11px] text-indigo-500">Sélection incluant des collégiens : seules les lignes collège de la semaine sont proposées.</span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">Classe</th>
                <th className="px-4 py-3">Ligne (matin)</th>
                <th className="px-4 py-3">Sortie 17h (primaire)</th>
                <th className="px-4 py-3">Ligne (soir)</th>
                <th className="px-4 py-3">Motif</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const identity = identities[s.id]
                const isCollege = cycleOfClasse(s.classe) === 'college'
                const sortie17h = identity?.transportSortie17h ?? false
                const motif = identity?.transportMotifException ?? ''
                // Le matin est commun à tous (aucune restriction : le trajet du matin mélange
                // primaire et collège). Le soir n'est restreint aux lignes collège que pour les
                // collégiens et les primaires en exception 17h — sinon libre, avec un "même que le
                // matin" par défaut pour éviter une double saisie dans le cas courant.
                const soirRestreint = isCollege || sortie17h
                const soirOptions = soirRestreint ? lignesCollege : lignes
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelectOne(s.id)} />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.classe}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={identity?.transportLigne ?? ''}
                        onChange={(e) => onUpdate(s.id, { transportLigne: e.target.value || null })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      >
                        <option value="">— Non affecté —</option>
                        <option value={TRANSPORT_PARENTS}>Amené(e) par les parents</option>
                        {lignes.map((l) => (
                          <option key={l.id} value={l.nom}>
                            Ligne {l.nom}
                          </option>
                        ))}
                      </select>
                    </td>
                    {isCollege ? (
                      <td className="px-4 py-2.5 text-xs text-slate-300">— (17h par défaut)</td>
                    ) : (
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={sortie17h}
                          onChange={(e) =>
                            onUpdate(s.id, {
                              transportSortie17h: e.target.checked,
                              // Le jeu d'options du soir change (toutes lignes <-> lignes collège
                              // seulement) : on réinitialise pour forcer un choix valide.
                              transportLigneSoir: null,
                              ...(e.target.checked ? {} : { transportMotifException: null, transportMotifAutre: null }),
                            })
                          }
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <select
                        value={identity?.transportLigneSoir ?? ''}
                        onChange={(e) => onUpdate(s.id, { transportLigneSoir: e.target.value || null })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      >
                        <option value="">{soirRestreint ? '— Non affecté —' : '— Même que le matin —'}</option>
                        <option value={TRANSPORT_PARENTS}>Amené(e) par les parents</option>
                        {soirOptions.map((l) => (
                          <option key={l.id} value={l.nom}>
                            Ligne {l.nom}
                          </option>
                        ))}
                      </select>
                      {soirRestreint && soirOptions.length === 0 && <p className="mt-1 text-[10px] text-amber-500">Aucune ligne collège cette semaine</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {!isCollege && sortie17h && (
                        <div className="flex items-center gap-2">
                          <select
                            value={motif}
                            onChange={(e) => onUpdate(s.id, { transportMotifException: e.target.value || null })}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option value="">— Motif —</option>
                            {MOTIFS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          {motif === 'Autre' && (
                            <input
                              value={identity?.transportMotifAutre ?? ''}
                              onChange={(e) => onUpdate(s.id, { transportMotifAutre: e.target.value })}
                              placeholder="Préciser..."
                              className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          )}
                        </div>
                      )}
                      {isCollege && <span className="text-xs text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            {eleves.length === 0 ? 'Aucun élève avec le transport activé.' : 'Aucun élève ne correspond aux filtres.'}
          </p>
        )}
      </div>
    </div>
  )
}
