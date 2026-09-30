import { useEffect, useState } from 'react'
import { Settings, Bot, History, ShieldCheck } from 'lucide-react'
import { cycleLabel, type CycleKey, type CycleThresholds } from '../data/alertRules'
import { moyenneScale } from '../data/referentiel'
import { useAlertRules, useAlertRulesHistory, useUpdateCycleThresholds } from '../services/alertRulesService'
import { computeActiveAlertsSummary } from '../utils/alertEngine'
import { supabase } from '../lib/supabaseClient'
import { useProfiles, useUpdateOwnProfileName } from '../services/profilesService'
import { useCurrentUserId } from '../services/currentUser'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface ParametresGlobalProps {
  onDataChanged: () => void
}

const CYCLE_TABS: CycleKey[] = ['maternelle', 'primaire', 'college', 'lycee']

type Theme = 'indigo' | 'amber' | 'sky' | 'orange' | 'rose' | 'violet' | 'teal'

const FIELDS: { key: keyof CycleThresholds; label: string; desc: string; unit: string; theme: Theme }[] = [
  {
    key: 'seuilMoyennePedagogique',
    label: 'Alerte Pédagogique',
    desc: "Déclencher l'alerte si la moyenne d'un élève tombe en dessous de ce seuil :",
    unit: '/20',
    theme: 'indigo',
  },
  {
    key: 'seuilPointsClimatScolaire',
    label: 'Alerte Climat Scolaire',
    desc: "Déclencher l'alerte si le cumul mensuel des points disciplinaires retirés (cycle) dépasse :",
    unit: 'pts',
    theme: 'amber',
  },
  {
    key: 'seuilTauxPresence',
    label: 'Alerte Présence',
    desc: "Déclencher l'alerte si le taux de présence d'un élève tombe en dessous de ce seuil :",
    unit: '%',
    theme: 'sky',
  },
  {
    key: 'seuilRetardsCumulesMin',
    label: 'Alerte Retards',
    desc: "Déclencher l'alerte si les retards cumulés d'un élève dépassent :",
    unit: 'min',
    theme: 'orange',
  },
  {
    key: 'seuilAlertesPAI',
    label: 'Alerte PAI / Cantine',
    desc: "Déclencher l'alerte si le nombre d'élèves avec un protocole PAI actif (cycle) dépasse :",
    unit: 'élève(s)',
    theme: 'rose',
  },
  {
    key: 'seuilIncidentsHelpdesk',
    label: 'Alerte Helpdesk',
    desc: "Déclencher l'alerte si le nombre d'incidents non résolus rattachés au cycle dépasse :",
    unit: 'incident(s)',
    theme: 'violet',
  },
  {
    key: 'seuilTauxRemplacement',
    label: 'Alerte Taux de Remplacement',
    desc: "Déclencher l'alerte si le taux de remplacement des profs absents (cycle) tombe en dessous de :",
    unit: '%',
    theme: 'teal',
  },
]

const THEME_CLASSES: Record<Theme, { bg: string; title: string; input: string; unit: string }> = {
  indigo: { bg: 'bg-indigo-50/60', title: 'text-indigo-700', input: 'border-indigo-200 focus:border-indigo-400', unit: 'text-indigo-600' },
  amber: { bg: 'bg-amber-50/70', title: 'text-amber-700', input: 'border-amber-200 focus:border-amber-400', unit: 'text-amber-600' },
  sky: { bg: 'bg-sky-50/60', title: 'text-sky-700', input: 'border-sky-200 focus:border-sky-400', unit: 'text-sky-600' },
  orange: { bg: 'bg-orange-50/60', title: 'text-orange-700', input: 'border-orange-200 focus:border-orange-400', unit: 'text-orange-600' },
  rose: { bg: 'bg-rose-50/60', title: 'text-rose-700', input: 'border-rose-200 focus:border-rose-400', unit: 'text-rose-600' },
  violet: { bg: 'bg-violet-50/60', title: 'text-violet-700', input: 'border-violet-200 focus:border-violet-400', unit: 'text-violet-600' },
  teal: { bg: 'bg-teal-50/60', title: 'text-teal-700', input: 'border-teal-200 focus:border-teal-400', unit: 'text-teal-600' },
}

export default function ParametresGlobal({ onDataChanged }: ParametresGlobalProps) {
  const { data: rules } = useAlertRules()
  const { data: history = [] } = useAlertRulesHistory()
  const updateThresholds = useUpdateCycleThresholds()

  const [cycle, setCycle] = useState<CycleKey>('college')
  const [draft, setDraft] = useState<CycleThresholds | null>(null)
  const [saved, setSaved] = useState(false)

  const userId = useCurrentUserId()
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'settings').canEdit
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securityError, setSecurityError] = useState('')
  const [securitySaved, setSecuritySaved] = useState(false)
  const [securitySaving, setSecuritySaving] = useState(false)

  const { data: profiles = [] } = useProfiles()
  const currentProfile = profiles.find((p) => p.id === userId)
  const updateOwnName = useUpdateOwnProfileName()
  const [nomComplet, setNomComplet] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
    })
  }, [])

  useEffect(() => {
    if (currentProfile) setNomComplet(currentProfile.nomComplet)
  }, [currentProfile])

  const handleSaveName = async () => {
    if (!userId || !nomComplet.trim()) return
    await updateOwnName.mutateAsync({ id: userId, nomComplet: nomComplet.trim() })
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  const handleSaveSecurity = async () => {
    setSecurityError('')
    if (!newPassword) {
      setSecurityError('Renseigne un nouveau mot de passe.')
      return
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('Les nouveaux mots de passe ne correspondent pas.')
      return
    }
    setSecuritySaving(true)
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (verifyError) {
      setSecuritySaving(false)
      setSecurityError('Mot de passe actuel incorrect.')
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSecuritySaving(false)
    if (updateError) {
      setSecurityError(updateError.message)
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSecuritySaved(true)
    setTimeout(() => setSecuritySaved(false), 2000)
  }

  useEffect(() => {
    if (rules) setDraft(rules[cycle])
  }, [rules, cycle])

  const switchCycle = (next: CycleKey) => {
    setCycle(next)
    setSaved(false)
  }

  const patch = (key: keyof CycleThresholds, value: number) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  const handleSave = () => {
    if (!rules || !draft) return
    updateThresholds.mutate(
      { cycle, rowId: rules.rowIds[cycle], prev: rules[cycle], next: draft },
      {
        onSuccess: () => {
          onDataChanged()
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        },
      }
    )
  }

  if (!rules || !draft) {
    return (
      <div className="mx-auto max-w-[1800px] p-6">
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    )
  }

  const previewRules = { ...rules, [cycle]: draft }
  const previewSummary = computeActiveAlertsSummary(previewRules)
  const previewCount =
    previewSummary.moyenne.filter((s) => s.cycle === cycle).length +
    previewSummary.presence.filter((s) => s.cycle === cycle).length +
    previewSummary.retards.filter((s) => s.cycle === cycle).length +
    previewSummary.climat.filter((c) => c.cycle === cycle && c.alert).length +
    previewSummary.pai.filter((c) => c.cycle === cycle && c.alert).length +
    previewSummary.helpdesk.filter((c) => c.cycle === cycle && c.alert).length +
    previewSummary.remplacement.filter((c) => c.cycle === cycle && c.alert).length

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Paramètres Système</h1>
          <p className="text-sm text-slate-500">Configuration du Moteur d'Alertes et des règles métier globales.</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
          <ShieldCheck className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-bold text-slate-900">Sécurité du Compte</h2>
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-5">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nom complet</label>
            <input
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              placeholder="Votre nom complet"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          {nameSaved && <span className="text-sm font-medium text-emerald-600">Nom mis à jour ✓</span>}
          <button
            type="button"
            onClick={handleSaveName}
            disabled={!nomComplet.trim() || updateOwnName.isPending}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Identifiant</label>
            <input
              value={email}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Requis pour confirmer les changements"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>

        {securityError && <p className="mt-3 text-sm font-medium text-rose-600">{securityError}</p>}

        <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          {securitySaved && <span className="text-sm font-medium text-emerald-600">Mot de passe mis à jour ✓</span>}
          <button
            type="button"
            onClick={handleSaveSecurity}
            disabled={!currentPassword || securitySaving}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {securitySaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="mb-5 flex flex-wrap gap-2">
        {CYCLE_TABS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => switchCycle(c)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              cycle === c ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {cycleLabel(c)}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Moteur de Règles — {cycleLabel(cycle)}</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              previewCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            {previewCount > 0 ? `${previewCount} alerte(s) déclenchée(s) avec ces valeurs` : 'Aucune alerte avec ces valeurs'}
          </span>
        </div>

        <div className="space-y-4">
          {FIELDS.map((field) => {
            const t = THEME_CLASSES[field.theme]
            const isMoyenne = field.key === 'seuilMoyennePedagogique'
            const scale = isMoyenne ? moyenneScale(cycle) : null
            const noGrading = isMoyenne && scale === null
            const unit = isMoyenne ? (scale !== null ? `/${scale}` : field.unit) : field.unit
            const desc = noGrading ? 'Pas de notation chiffrée en maternelle — seuil non applicable.' : field.desc
            return (
              <div key={field.key} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4 ${t.bg}`}>
                <div>
                  <p className={`text-sm font-bold ${t.title}`}>{field.label} (Dashboard)</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={draft[field.key]}
                    onChange={(e) => patch(field.key, Number(e.target.value))}
                    disabled={!canEdit || noGrading}
                    className={`w-20 rounded-lg border bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${t.input}`}
                  />
                  <span className={`text-sm font-semibold ${t.unit}`}>{unit}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          {saved && <span className="text-sm font-medium text-emerald-600">Règles enregistrées ✓</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer les règles — {cycleLabel(cycle)}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">Historique des modifications</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune modification enregistrée pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-700">
                  {cycleLabel(h.cycle)} <span className="font-normal text-slate-400">— {new Date(h.date).toLocaleString('fr-FR')}</span>
                </p>
                <p className="text-xs text-slate-500">{h.summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
