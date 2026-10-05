import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, CalendarRange, Check, Lock, LogOut, GraduationCap, Star, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { topLevelNav, navGroups, IMPLEMENTED_MODULE_KEYS } from '../data/navigation'
import { useSchoolIdentity } from '../services/schoolIdentityService'
import { useAlertRules } from '../services/alertRulesService'
import { computeActiveAlertsSummary } from '../utils/alertEngine'
import { countUnseenAlerts } from '../utils/alertsSeenStore'
import { countHorsDelaiIn } from '../utils/reclamationsAlerts'
import { useStudentExtras } from '../services/studentDetailsService'
import { useStudents } from '../services/studentsService'
import { useAnneesScolaires, getActiveYearIdSnapshot, getAnneesScolairesSnapshot } from '../services/anneesScolairesService'
import { useViewedYearId, setViewedYearId } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import { initials, ROLE_LABELS } from '../data/profiles'
import { avatarGradient } from '../utils/avatarColor'
import GlobalSearchModal from './GlobalSearchModal'

const YEAR_RANGE_SPAN = 2

/** Pastille rouge de l'entrée « Réclamations Parents » : nombre de réclamations non résolues au-delà du délai de leur niveau. */
function HorsDelaiBadge({ count }: { count: number }) {
  return (
    <span
      title={`${count} réclamation${count > 1 ? 's' : ''} hors délai`}
      className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
    >
      {count}
    </span>
  )
}

interface SidebarProps {
  active: string
  onSelect: (key: string) => void
  onNavigateToStudent?: (id: string) => void
  onNavigateToTeacher?: (id: string) => void
  onLogout?: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

const PINNED_KEY = 'vieScolaire.pinnedNav'

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export default function Sidebar({
  active,
  onSelect,
  onNavigateToStudent,
  onNavigateToTeacher,
  onLogout,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { data: identity } = useSchoolIdentity()
  const currentProfile = useCurrentProfile()
  const { data: alertRules } = useAlertRules()
  const alertCount = alertRules ? countUnseenAlerts(computeActiveAlertsSummary(alertRules)) : 0
  // Réclamations hors délai : badge sur l'entrée de menu, calculé depuis les données des requêtes.
  const { data: extrasForBadge } = useStudentExtras()
  const { data: studentsForBadge } = useStudents()
  const reclamationsHorsDelai = useMemo(() => countHorsDelaiIn(studentsForBadge ?? [], extrasForBadge), [extrasForBadge, studentsForBadge])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ scolarite: true })
  const [showSearch, setShowSearch] = useState(false)
  const [showYearMenu, setShowYearMenu] = useState(false)
  const [pinned, setPinned] = useState<string[]>(loadPinned)

  const { data: annees = getAnneesScolairesSnapshot() } = useAnneesScolaires()
  const activeYearId = getActiveYearIdSnapshot()
  const viewedYearId = useViewedYearId()
  const activeYear = annees.find((a) => a.id === activeYearId)
  const viewedYear = annees.find((a) => a.id === viewedYearId)
  const isViewedYearEditable = viewedYearId === activeYearId
  const yearRange = activeYear
    ? Array.from({ length: YEAR_RANGE_SPAN * 2 + 1 }, (_, i) => activeYear.anneeDebut - YEAR_RANGE_SPAN + i).map((anneeDebut) => ({
        anneeDebut,
        libelle: `${anneeDebut}/${anneeDebut + 1}`,
        annee: annees.find((a) => a.anneeDebut === anneeDebut),
      }))
    : []

  const handleSelect = (key: string) => {
    onSelect(key)
    onCloseMobile?.()
  }

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))

  const togglePin = (key: string) => {
    setPinned((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      try {
        localStorage.setItem(PINNED_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const visibleNavGroups = useMemo(
    () =>
      navGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => getModuleAccess(currentProfile, i.key).canView) }))
        .filter((g) => g.items.length > 0),
    [currentProfile]
  )

  const itemsByKey = useMemo(() => {
    const map = new Map<string, { label: string; icon: LucideIcon }>()
    visibleNavGroups.forEach((g) => g.items.forEach((i) => map.set(i.key, i)))
    return map
  }, [visibleNavGroups])

  const pinnedItems = pinned.map((key) => ({ key, ...itemsByKey.get(key) })).filter((i) => i.label)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[264px] shrink-0 flex-col bg-[#12142b] px-3 py-4 text-slate-300 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 pb-4">
        {identity?.logo ? (
          <img src={identity.logo} alt="Logo" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{identity?.nom ?? ''}</span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* User card */}
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/5 px-2 py-2">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${avatarGradient(currentProfile?.id ?? '')}`}
        >
          {initials(currentProfile?.nomComplet || currentProfile?.email || '?')}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {currentProfile?.nomComplet || currentProfile?.email || 'Chargement...'}
          </p>
          <span className="inline-block rounded-full bg-indigo-500/20 px-2 py-[1px] text-[10px] font-semibold tracking-wide text-indigo-300">
            {ROLE_LABELS[currentProfile?.role ?? 'Autre'].toUpperCase()}
          </span>
        </div>
      </div>

      {/* Search */}
      <button
        type="button"
        onClick={() => setShowSearch(true)}
        className="mb-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-slate-400 hover:bg-white/10"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left text-sm">Recherche rapide...</span>
        <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl K</span>
      </button>

      {/* Nav */}
      {/* overflow-x-hidden est nécessaire en plus de overflow-y-auto : sans lui, la CSSOM traite les
          deux axes comme "auto" dès qu'ils diffèrent (règle du spec overflow), donc le moindre
          dépassement horizontal (ex. long libellé de module) fait apparaître une barre de défilement
          horizontale parasite sous la liste, en plus de celle voulue à la verticale. */}
      <nav className="thin-scrollbar flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <ul className="space-y-1">
          {topLevelNav.map((item) => {
            const Icon = item.icon
            const isActive = active === item.key
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => handleSelect(item.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-white font-semibold text-slate-900'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                  {item.live && (
                    <span className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" />
                  )}
                  {item.key === 'dashboard' && alertCount > 0 && (
                    <span
                      title={`${alertCount} alerte${alertCount > 1 ? 's' : ''} active${alertCount > 1 ? 's' : ''} non consultée${alertCount > 1 ? 's' : ''}`}
                      className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                    >
                      {alertCount}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {pinnedItems.length > 0 && (
          <div className="mt-3">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Accès Rapides</p>
            <ul className="space-y-1">
              {pinnedItems.map((item) => {
                const Icon = item.icon as LucideIcon
                const isActive = active === item.key
                return (
                  <li key={item.key} className="group/nav flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelect(item.key)}
                      className={`flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive ? 'bg-white font-semibold text-slate-900' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                      {item.key === 'reclamations' && reclamationsHorsDelai > 0 && <HorsDelaiBadge count={reclamationsHorsDelai} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePin(item.key)}
                      title="Retirer des accès rapides"
                      className="shrink-0 rounded p-1 text-amber-400 hover:text-amber-300"
                    >
                      <Star className="h-3.5 w-3.5" fill="currentColor" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="mt-4 space-y-1">
          {visibleNavGroups.map((group) => {
            const isOpen = !!openGroups[group.key]
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span className="flex-1 text-left">{group.label}</span>
                </button>
                {isOpen && (
                  <ul className="ml-2 space-y-0.5 border-l border-white/10 pl-3">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = active === item.key
                      const isPinned = pinned.includes(item.key)
                      const isBuiltIn = IMPLEMENTED_MODULE_KEYS.includes(item.key)
                      return (
                        <li key={item.key} className="group/nav flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSelect(item.key)}
                            className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                              isActive
                                ? 'bg-white/10 font-medium text-white'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                            {!isBuiltIn && (
                              <span className="ml-auto shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                                À venir
                              </span>
                            )}
                            {item.key === 'reclamations' && reclamationsHorsDelai > 0 && <HorsDelaiBadge count={reclamationsHorsDelai} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePin(item.key)}
                            title={isPinned ? 'Retirer des accès rapides' : 'Épingler dans les accès rapides'}
                            className={`shrink-0 rounded p-1 transition-opacity ${
                              isPinned
                                ? 'text-amber-400 opacity-100'
                                : 'text-slate-500 opacity-0 hover:text-slate-300 group-hover/nav:opacity-100'
                            }`}
                          >
                            <Star className="h-3 w-3" fill={isPinned ? 'currentColor' : 'none'} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="mt-3 space-y-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowYearMenu((v) => !v)}
            className="w-full rounded-xl bg-white/5 p-3 text-left hover:bg-white/10"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
                <CalendarRange className="h-3.5 w-3.5 text-indigo-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-white">
                    Année {viewedYear?.libelle ?? '—'}
                  </span>
                  {!isViewedYearEditable && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-[1px] text-[9px] font-semibold text-amber-300">
                      <Lock className="h-2.5 w-2.5" />
                      Lecture seule
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${showYearMenu ? 'rotate-180' : ''}`} />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              {isViewedYearEditable
                ? 'Année active — données modifiables.'
                : 'Consultation seule — basculez sur l’année active pour modifier.'}
            </p>
          </button>

          {showYearMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowYearMenu(false)} />
              <div className="absolute inset-x-0 bottom-full z-20 mb-1 overflow-hidden rounded-xl border border-white/10 bg-[#1c1f3d] py-1 shadow-lg">
                {yearRange.map(({ anneeDebut, libelle, annee }) => {
                  const disabled = !annee
                  const isViewed = annee && annee.id === viewedYearId
                  return (
                    <button
                      key={anneeDebut}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!annee) return
                        setViewedYearId(annee.id)
                        setShowYearMenu(false)
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        disabled
                          ? 'cursor-not-allowed text-slate-600'
                          : isViewed
                            ? 'font-semibold text-indigo-300'
                            : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="flex-1 truncate">{libelle}</span>
                      {annee?.active && <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-400">Active</span>}
                      {isViewed && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-300" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>

      {showSearch && (
        <GlobalSearchModal
          onClose={() => setShowSearch(false)}
          onSelectModule={handleSelect}
          onSelectStudent={(id) => onNavigateToStudent?.(id)}
          onSelectTeacher={(id) => onNavigateToTeacher?.(id)}
        />
      )}
      </aside>
    </>
  )
}
