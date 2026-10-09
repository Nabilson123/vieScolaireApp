import { useEffect, useState, lazy, Suspense } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import SetPasswordGate from './components/SetPasswordGate'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CockpitLive = lazy(() => import('./pages/CockpitLive'))
const StudentsList = lazy(() => import('./pages/StudentsList'))
const AbsencesRetards = lazy(() => import('./pages/AbsencesRetards'))
const SuiviElevesGlobal = lazy(() => import('./pages/SuiviElevesGlobal'))
const DisciplineGlobal = lazy(() => import('./pages/DisciplineGlobal'))
const NotesGlobal = lazy(() => import('./pages/NotesGlobal'))
const InfirmerieGlobal = lazy(() => import('./pages/InfirmerieGlobal'))
const DeleguesGlobal = lazy(() => import('./pages/DeleguesGlobal'))
const ReclamationsGlobal = lazy(() => import('./pages/ReclamationsGlobal'))
const RendezVousGlobal = lazy(() => import('./pages/RendezVousGlobal'))
const TeachersGlobal = lazy(() => import('./pages/TeachersGlobal'))
const InspectionsGlobal = lazy(() => import('./pages/InspectionsGlobal'))
const ClassesGlobal = lazy(() => import('./pages/ClassesGlobal'))
const RemplacementsGlobal = lazy(() => import('./pages/RemplacementsGlobal'))
const ExamPlannerGlobal = lazy(() => import('./pages/ExamPlannerGlobal'))
const ExamPeriodsGlobal = lazy(() => import('./pages/ExamPeriodsGlobal'))
const ReportsBIGlobal = lazy(() => import('./pages/ReportsBIGlobal'))
const EmploiDuTempsGlobal = lazy(() => import('./pages/EmploiDuTempsGlobal'))
const CalendrierMensuel = lazy(() => import('./pages/CalendrierMensuel'))
const GardeRepasGlobal = lazy(() => import('./pages/GardeRepasGlobal'))
const TransportGlobal = lazy(() => import('./pages/TransportGlobal'))
const GardeGlobal = lazy(() => import('./pages/GardeGlobal'))
const PersonnelGlobal = lazy(() => import('./pages/PersonnelGlobal'))
const HelpdeskGlobal = lazy(() => import('./pages/HelpdeskGlobal'))
const ReferentielGlobal = lazy(() => import('./pages/ReferentielGlobal'))
const ImportExcelGlobal = lazy(() => import('./pages/ImportExcelGlobal'))
const ParametresGlobal = lazy(() => import('./pages/ParametresGlobal'))
const UsersGlobal = lazy(() => import('./pages/UsersGlobal'))
const ParentsAdminGlobal = lazy(() => import('./pages/ParentsAdminGlobal'))
const CirculairesGlobal = lazy(() => import('./pages/CirculairesGlobal'))
const NotesServiceGlobal = lazy(() => import('./pages/NotesServiceGlobal'))
const ReservationSallesGlobal = lazy(() => import('./pages/ReservationSallesGlobal'))
const JournalAuditGlobal = lazy(() => import('./pages/JournalAuditGlobal'))
const JournalAppelsParentsGlobal = lazy(() => import('./pages/JournalAppelsParentsGlobal'))
const ExportGlobal = lazy(() => import('./pages/ExportGlobal'))
const ClubsGlobal = lazy(() => import('./pages/ClubsGlobal'))
const AiCopilotGlobal = lazy(() => import('./pages/AiCopilotGlobal'))
const ParentPortalApp = lazy(() => import('./portal/ParentPortalApp'))
import { IMPLEMENTED_MODULE_KEYS } from './data/navigation'
import { supabase } from './lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import { useAbsencesConfig } from './services/absencesConfigService'
import { useAnneesScolaires } from './services/anneesScolairesService'
import { usePeriodes } from './services/periodesService'
import { useSalles } from './services/sallesService'
import { useControlesConfig } from './services/controlesConfigService'
import { useMatieresConfig } from './services/matieresConfigService'
import { useClasses } from './services/classesService'
import { useTeachers } from './services/teachersService'
import { useTeacherExtras } from './services/teacherExtrasService'
import { useStudents } from './services/studentsService'
import { useStudentIdentities } from './services/studentIdentityService'
import { useIncidents, usePrestataires } from './services/helpdeskService'
import { useStudentExtras } from './services/studentDetailsService'
import { useClassSchedules, useScheduleHistory } from './services/classSchedulesService'
import { useInspections } from './services/inspectionsService'
import { useExamSessions } from './services/examPlannerService'
import { useExamPeriods } from './services/examPeriodService'
import { useProfiles } from './services/profilesService'
import { useProfileTypes } from './services/profileTypesService'
import { setCurrentUserId } from './services/currentUser'
import { useServicesCapacite } from './services/servicesCapaciteService'
import { useTransportLignes } from './services/transportLignesService'
import { useChauffeurs } from './services/chauffeursService'
import { useAidesMaitresses } from './services/aidesMaitressesService'
import { useAccountType } from './services/accountType'
import { useParents } from './services/parentsService'
import { useSoutienInscriptions, useSoutienSeances } from './services/soutienService'
import { useClubEcheances, useClubInscriptions, useClubs } from './services/clubsService'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  // window.__initialAuthHash/__initialAuthSearch sont capturés par un script inline dans index.html,
  // exécuté avant tout script de module — donc avant que la construction du client Supabase
  // (detectSessionInUrl) ne consomme et n'efface l'URL. Un lien d'invitation ou de réinitialisation
  // authentifie directement sans mot de passe, donc sans ce garde-fou la personne n'aurait plus
  // jamais moyen de se reconnecter une fois sa session expirée.
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(() => {
    const initialHash: string = (window as unknown as { __initialAuthHash?: string }).__initialAuthHash ?? ''
    const initialSearch: string = (window as unknown as { __initialAuthSearch?: string }).__initialAuthSearch ?? ''
    const hashParams = new URLSearchParams(initialHash.replace(/^#/, ''))
    const type = hashParams.get('type')
    if (type === 'invite' || type === 'recovery') return true
    // Flux PKCE (projets Supabase récents) : la redirection arrive en "?code=..." dans l'URL, sans
    // paramètre `type` exploitable côté client. Cette appli ne produit un tel paramètre "code" à
    // l'arrivée que via un lien d'invitation ou de réinitialisation (la connexion normale passe par
    // signInWithPassword, jamais par une redirection) — sa seule présence suffit donc ici.
    return new URLSearchParams(initialSearch).has('code')
  })
  const { data: accountType, isLoading: accountTypeLoading } = useAccountType(session?.user.id ?? null)
  const isStaff = !!session && accountType === 'staff'
  // Résolution de l'année active : nécessaire à TOUTE requête année-scopée (staff ET parent), pas
  // seulement staff — sinon getActiveYearIdSnapshot() reste sur son repli de bootstrap pour une
  // session parent et chaque requête du portail filtre sur le mauvais annee_scolaire_id.
  useAnneesScolaires(!!session)
  useAbsencesConfig(isStaff)
  usePeriodes(isStaff)
  useSalles(isStaff)
  useControlesConfig(isStaff)
  useMatieresConfig(isStaff)
  useClasses(isStaff)
  useTeachers(isStaff)
  useTeacherExtras(isStaff)
  useStudents(isStaff)
  useStudentIdentities(isStaff)
  useIncidents(isStaff)
  usePrestataires(isStaff)
  useStudentExtras(isStaff)
  useClassSchedules(isStaff)
  useScheduleHistory(isStaff)
  useInspections(isStaff)
  useExamSessions(isStaff)
  useExamPeriods(isStaff)
  useProfiles(isStaff)
  useProfileTypes(isStaff)
  useServicesCapacite(isStaff)
  useTransportLignes(isStaff)
  useChauffeurs(isStaff)
  useAidesMaitresses(isStaff)
  useParents(isStaff)
  useSoutienSeances(isStaff)
  useSoutienInscriptions(isStaff)
  useClubs(isStaff)
  useClubInscriptions(isStaff)
  useClubEcheances(isStaff)
  const [active, setActive] = useState('dashboard')
  const [navTarget, setNavTarget] = useState<{ studentId?: string; teacherId?: string; tab?: string; classe?: string } | null>(null)
  const [, setGlobalRefresh] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const notifyDataChanged = () => {
    setGlobalRefresh((v) => v + 1)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCurrentUserId(data.session?.user.id ?? null)
      setAuthChecked(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCurrentUserId(nextSession?.user.id ?? null)
      setAuthChecked(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSidebarSelect = (key: string) => {
    setNavTarget(null)
    setActive(key)
  }

  const navigateToStudent = (id: string, tab?: string) => {
    setNavTarget({ studentId: id, tab })
    setActive('list')
  }

  const navigateToTeacher = (id: string) => {
    setNavTarget({ teacherId: id })
    setActive('teachers')
  }

  const navigateToClasse = (classe: string) => {
    setNavTarget({ classe })
    setActive('list')
  }

  const navigateToRendezVous = () => {
    setActive('appointments')
  }

  const navigateToLunch = () => {
    setActive('lunch')
  }

  const navigateToTransport = () => {
    setActive('transport')
  }

  const navigateToClubsRecouvrement = () => {
    setNavTarget({ tab: 'recouvrement' })
    setActive('clubs')
  }

  const navigateToJournalAppelsParents = () => {
    setActive('journalAppelsParents')
  }

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  if (!authChecked) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f4f8]" />
  }

  if (!session) {
    return <LoginPage />
  }

  if (needsPasswordSetup) {
    return <SetPasswordGate onDone={() => setNeedsPasswordSetup(false)} />
  }

  if (accountTypeLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f4f8]" />
  }

  if (accountType === 'parent') {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f3f4f8]" />}>
        <ParentPortalApp onLogout={handleLogout} />
      </Suspense>
    )
  }

  if (accountType === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f3f4f8] px-6 text-center">
        <p className="text-sm font-semibold text-slate-700">Compte non configuré</p>
        <p className="max-w-sm text-sm text-slate-500">
          Ce compte n'est rattaché à aucun profil (staff ou parent). Contactez un administrateur.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Déconnexion
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#f3f4f8]">
      <Sidebar
        active={active}
        onSelect={handleSidebarSelect}
        onNavigateToStudent={navigateToStudent}
        onNavigateToTeacher={navigateToTeacher}
        onLogout={handleLogout}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <main className="flex h-screen flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold text-slate-800">Vie Scolaire</span>
        </div>
        <Suspense
          fallback={<div className="flex h-full items-center justify-center p-10 text-slate-400">Chargement...</div>}
        >
          <div className="flex-1 overflow-y-auto">
          {active === 'dashboard' && (
            <Dashboard
              onNavigateToStudent={navigateToStudent}
              onNavigateToTeacher={navigateToTeacher}
              onNavigateToClasse={navigateToClasse}
              onNavigateToRendezVous={navigateToRendezVous}
              onNavigateToLunch={navigateToLunch}
              onNavigateToTransport={navigateToTransport}
              onNavigateToClubs={navigateToClubsRecouvrement}
              onDataChanged={notifyDataChanged}
            />
          )}
          {active === 'dashboardLive' && (
            <CockpitLive onDataChanged={notifyDataChanged} onNavigateToJournalAppelsParents={navigateToJournalAppelsParents} />
          )}
          {active === 'list' && (
            <StudentsList
              key={navTarget?.studentId ?? 'list'}
              initialStudentId={navTarget?.studentId}
              initialTab={navTarget?.tab}
              initialClasse={navTarget?.classe}
            />
          )}
          {active === 'absences' && <AbsencesRetards />}
          {active === 'suiviEleves' && <SuiviElevesGlobal onNavigateToStudent={navigateToStudent} />}
          {active === 'discipline' && <DisciplineGlobal onDataChanged={notifyDataChanged} />}
          {active === 'grades' && <NotesGlobal />}
          {active === 'infirmerie' && <InfirmerieGlobal />}
          {active === 'delegues' && <DeleguesGlobal />}
          {active === 'reclamations' && <ReclamationsGlobal />}
          {active === 'appointments' && <RendezVousGlobal />}
          {active === 'circulaires' && <CirculairesGlobal />}
          {active === 'notesService' && <NotesServiceGlobal />}
          {active === 'teachers' && <TeachersGlobal key={navTarget?.teacherId ?? 'teachers'} initialTeacherId={navTarget?.teacherId} />}
          {active === 'inspections' && <InspectionsGlobal />}
          {active === 'classes' && <ClassesGlobal />}
          {active === 'replacements' && <RemplacementsGlobal />}
          {active === 'examPlanner' && <ExamPlannerGlobal />}
          {active === 'examPeriods' && <ExamPeriodsGlobal />}
          {active === 'reportsBI' && <ReportsBIGlobal onNavigateToClasse={navigateToClasse} />}
          {active === 'manager' && <EmploiDuTempsGlobal />}
          {active === 'calendar' && <CalendrierMensuel onNavigateToStudent={navigateToStudent} onNavigateToTeacher={navigateToTeacher} />}
          {active === 'lunch' && <GardeRepasGlobal onNavigateToStudent={navigateToStudent} onDataChanged={notifyDataChanged} />}
          {active === 'transport' && <TransportGlobal onDataChanged={notifyDataChanged} />}
          {active === 'garde' && <GardeGlobal onDataChanged={notifyDataChanged} />}
          {active === 'clubs' && <ClubsGlobal key={navTarget?.tab ?? 'clubs'} initialOnglet={navTarget?.tab} />}
          {active === 'personnel' && <PersonnelGlobal onDataChanged={notifyDataChanged} />}
          {active === 'helpdesk' && <HelpdeskGlobal />}
          {active === 'reservationSalles' && <ReservationSallesGlobal />}
          {active === 'referentiel' && <ReferentielGlobal onDataChanged={notifyDataChanged} />}
          {active === 'import' && <ImportExcelGlobal onDataChanged={notifyDataChanged} />}
          {active === 'users' && <UsersGlobal />}
          {active === 'parentAccounts' && <ParentsAdminGlobal />}
          {active === 'exportGeneral' && <ExportGlobal />}
          {active === 'journalAudit' && <JournalAuditGlobal />}
          {active === 'journalAppelsParents' && <JournalAppelsParentsGlobal />}
          {active === 'aiCopilot' && <AiCopilotGlobal />}
          {active === 'settings' && <ParametresGlobal onDataChanged={notifyDataChanged} />}
          {!IMPLEMENTED_MODULE_KEYS.includes(active) && (
            <div className="flex h-full items-center justify-center p-10 text-slate-400">
              Module « {active} » à venir.
            </div>
          )}
          </div>
        </Suspense>
      </main>
    </div>
  )
}

export default App
