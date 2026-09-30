import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Activity,
  GraduationCap,
  ClipboardList,
  ShieldAlert,
  BookOpen,
  HeartPulse,
  MessageSquareWarning,
  CalendarClock,
  Vote,
  UserCheck,
  Users,
  ClipboardCheck,
  Eye,
  School,
  Repeat,
  CalendarDays,
  Calendar,
  UtensilsCrossed,
  Wrench,
  FileText,
  FileCheck2,
  BarChart4,
  BookMarked,
  Upload,
  RefreshCw,
  UserCog,
  Sparkles,
  Settings,
  FileEdit,
  Layers,
  Bus,
  Clock3,
  IdCard,
  DoorOpen,
  History,
  FileDown,
  PhoneCall,
} from 'lucide-react'

export interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  live?: boolean
}

export interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

export const topLevelNav: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'dashboardLive', label: 'Vue Live Cockpit', icon: Activity, live: true },
  { key: 'aiCopilot', label: 'Assistant IA', icon: Sparkles },
]

export const navGroups: NavGroup[] = [
  {
    key: 'scolarite',
    label: 'Scolarité',
    items: [
      { key: 'list', label: 'Fiches Élèves', icon: GraduationCap },
      { key: 'suiviEleves', label: 'Suivi des Élèves', icon: Eye },
      { key: 'absences', label: 'Absences & Retards', icon: ClipboardList },
      { key: 'discipline', label: 'Suivi Disciplinaire', icon: ShieldAlert },
      { key: 'grades', label: 'Suivi des Notes', icon: BookOpen },
      { key: 'infirmerie', label: 'Infirmerie', icon: HeartPulse },
      { key: 'delegues', label: 'Délégués de Classe', icon: UserCheck },
    ],
  },
  {
    key: 'services',
    label: 'Services',
    items: [
      { key: 'lunch', label: 'Garde Repas & Cantine', icon: UtensilsCrossed },
      { key: 'transport', label: 'Transport', icon: Bus },
      { key: 'garde', label: 'Garde', icon: Clock3 },
      { key: 'personnel', label: 'Personnel', icon: IdCard },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    items: [
      { key: 'reclamations', label: 'Réclamations Parents', icon: MessageSquareWarning },
      { key: 'appointments', label: 'Rendez-vous', icon: CalendarClock },
      { key: 'circulaires', label: 'Circulaires', icon: FileText },
      { key: 'notesService', label: 'Notes de service', icon: FileEdit },
      { key: 'journalAppelsParents', label: "Journal d'Appels Parents", icon: PhoneCall },
    ],
  },
  {
    key: 'organisation',
    label: 'Organisation',
    items: [
      { key: 'teachers', label: 'Corps Professoral', icon: Users },
      { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
      { key: 'classes', label: 'Structure Scolaire', icon: School },
      { key: 'replacements', label: 'Remplacements', icon: Repeat },
      { key: 'examPlanner', label: 'Planificateur d’Examens', icon: FileCheck2 },
      { key: 'examPeriods', label: 'Sessions d’Examens', icon: Layers },
      { key: 'reportsBI', label: 'Rapports BI', icon: BarChart4 },
    ],
  },
  {
    key: 'logistique',
    label: 'Logistique & Planning',
    items: [
      { key: 'manager', label: 'Emplois du Temps', icon: CalendarDays },
      { key: 'calendar', label: 'Calendrier Scolaire', icon: Calendar },
      { key: 'helpdesk', label: 'Helpdesk & Maintenance', icon: Wrench },
      { key: 'reservationSalles', label: 'Réservation Salles', icon: DoorOpen },
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    items: [
      { key: 'referentiel', label: 'Référentiel Pédagogique', icon: BookMarked },
      { key: 'import', label: 'Import Excel', icon: Upload },
      { key: 'users', label: 'Utilisateurs & Rôles', icon: UserCog },
      { key: 'parentAccounts', label: 'Comptes Parents', icon: UserCheck },
      { key: 'exportGeneral', label: 'Export Généralisé', icon: FileDown },
      { key: 'journalAudit', label: 'Journal d\'Audit', icon: History },
      { key: 'settings', label: 'Paramètres', icon: Settings },
    ],
  },
  {
    key: 'avenir',
    label: 'À Venir',
    items: [
      { key: 'polls', label: 'Sondages & Élections', icon: Vote },
      { key: 'purchaseOrder', label: 'Bons de Commande', icon: FileText },
      { key: 'massarSync', label: 'Synchronisation Massar', icon: RefreshCw },
      { key: 'form', label: 'Guichet de Saisie Rapide', icon: FileEdit },
    ],
  },
]

export const IMPLEMENTED_MODULE_KEYS = [
  'dashboard',
  'dashboardLive',
  'aiCopilot',
  'list',
  'suiviEleves',
  'absences',
  'discipline',
  'grades',
  'infirmerie',
  'delegues',
  'reclamations',
  'appointments',
  'circulaires',
  'notesService',
  'journalAppelsParents',
  'teachers',
  'inspections',
  'classes',
  'replacements',
  'examPlanner',
  'examPeriods',
  'reportsBI',
  'manager',
  'calendar',
  'lunch',
  'transport',
  'garde',
  'personnel',
  'helpdesk',
  'referentiel',
  'import',
  'users',
  'parentAccounts',
  'reservationSalles',
  'exportGeneral',
  'journalAudit',
  'settings',
]
