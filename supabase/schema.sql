-- ============================================================================
-- Vie Scolaire — Schéma Supabase (Phase 1)
-- À exécuter dans Supabase : Project > SQL Editor > New query > coller > Run
-- ============================================================================

-- Extension pour les UUID
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Référentiel / configuration (petites tables, une seule ligne pour l'instant)
-- ----------------------------------------------------------------------------

create table school_identity (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  logo text,
  updated_at timestamptz not null default now()
);

create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  cycle text not null check (cycle in ('maternelle', 'primaire', 'college', 'lycee')),
  seuil_moyenne_pedagogique numeric not null,
  seuil_points_climat_scolaire numeric not null,
  seuil_taux_presence numeric not null,
  seuil_retards_cumules_min numeric not null,
  seuil_alertes_pai numeric not null,
  seuil_incidents_helpdesk numeric not null,
  seuil_taux_remplacement numeric not null,
  unique (cycle)
);

create table alert_rules_history (
  id uuid primary key default gen_random_uuid(),
  cycle text not null,
  summary text not null,
  changed_at timestamptz not null default now()
);

create table absences_config (
  id uuid primary key default gen_random_uuid(),
  motifs text[] not null default '{}'
);

create table controles_config (
  id uuid primary key default gen_random_uuid(),
  config jsonb not null default '{}'
);

create table matieres_config (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nom text not null,
  coef numeric not null default 1
);

create table salles (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  nom text not null,
  capacite integer
);

create table periodes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  date_debut date not null,
  date_fin date not null
);

-- ----------------------------------------------------------------------------
-- Structure scolaire
-- ----------------------------------------------------------------------------

create table classes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  niveau text not null,
  cycle text not null check (cycle in ('maternelle', 'primaire', 'college', 'lycee')),
  active boolean not null default true
);

-- ----------------------------------------------------------------------------
-- Élèves
-- ----------------------------------------------------------------------------

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sexe text not null check (sexe in ('M', 'F')),
  classe_id uuid references classes(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Notes : pas de colonnes "taux" / "absencesHeures" / "totalHeures" ici —
-- ce sont des valeurs dérivées, à recalculer depuis la table `events` via une vue SQL.

create table student_identities (
  student_id uuid primary key references students(id) on delete cascade,
  prenom text,
  nom text,
  nom_ar text,
  prenom_ar text,
  code_massar text unique,
  cantine boolean not null default false,
  garde_apres_midi boolean not null default false,
  garde_matin boolean not null default false,
  garde_midi boolean not null default false,
  transport boolean not null default false,
  date_naissance date,
  lieu_naissance text,
  date_entree date,
  parent1_nom text,
  parent1_prenom text,
  parent1_tel text,
  parent2_nom text,
  parent2_prenom text,
  parent2_tel text
);

-- Absences / retards élèves (remplace StudentExtra.events)
create table student_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  type text not null check (type in ('ABSENCE', 'RETARD')),
  subject text,
  duree text not null, -- ex: "2h", "45min"
  start time,
  motif text,
  justified boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_student_events_student_date on student_events(student_id, date);

-- Discipline
create table discipline_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  title text not null,
  description text,
  points integer not null,
  author text,
  created_at timestamptz not null default now()
);
create index idx_discipline_events_student_date on discipline_events(student_id, date);

create table student_conduite (
  student_id uuid primary key references students(id) on delete cascade,
  conduite numeric not null default 20
);

-- Notes / évaluations
create table student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject text not null,
  coef numeric not null default 1,
  classe_average numeric
);

create table note_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_note_id uuid not null references student_notes(id) on delete cascade,
  label text,
  value numeric not null,
  coef numeric not null default 1,
  date date
);

-- Cantine (1:1)
create table student_cantine (
  student_id uuid primary key references students(id) on delete cascade,
  formule_lunchbox text,
  interdiction_sortie boolean not null default false,
  modalite_sortie text,
  rechauffage boolean not null default false,
  conservation boolean not null default false,
  alerte_pai boolean not null default false,
  decharge_signee boolean not null default false
);

create table cantine_flux (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  arrivee time,
  sortie time,
  surveillant text
);

-- Santé (1:1)
create table student_sante (
  student_id uuid primary key references students(id) on delete cascade,
  info jsonb not null default '{}'
);

-- Réclamations parents
create table reclamations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  categorie text,
  description text,
  statut text,
  reponse text
);

-- Rendez-vous parents
create table rendez_vous (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  heure time not null,
  duree integer not null,
  statut text not null check (statut in ('Planifié', 'Réalisé', 'Annulé')),
  mode text not null check (mode in ('Présentiel', 'Virtuel')),
  lieu text,
  motif text,
  notes_parents text,
  enseignant text,
  compte_rendu jsonb
);

-- ----------------------------------------------------------------------------
-- Enseignants
-- ----------------------------------------------------------------------------

create table teachers (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  email text,
  telephone_mobile text,
  telephone_domicile text,
  matricule text unique,
  plateforme text,
  id_meeting text,
  lien_visio text,
  statut text not null check (statut in ('Permanent', 'Vacataire', 'Contractuel')),
  type text not null check (type in ('Principal', 'Remplaçant', 'Stagiaire')),
  niveaux text[] not null default '{}',
  matieres text[] not null default '{}',
  classes text[] not null default '{}'
);

create table teacher_absences (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  date date not null,
  type text not null check (type in ('ABSENCE', 'RETARD')),
  classe text,
  duree numeric not null,
  motif text,
  slot_id uuid,
  justified boolean not null default false
);
create index idx_teacher_absences_teacher_date on teacher_absences(teacher_id, date);

create table remplacements (
  id uuid primary key default gen_random_uuid(),
  remplacant_id uuid not null references teachers(id) on delete cascade,
  date date not null,
  classe text not null,
  matiere text not null,
  prof_remplace text not null,
  heures numeric not null,
  consignes text
);

-- ----------------------------------------------------------------------------
-- Emplois du temps
-- ----------------------------------------------------------------------------

create table course_slots (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references classes(id) on delete cascade,
  day text not null check (day in ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI')),
  subject text not null,
  teacher_id uuid references teachers(id) on delete set null,
  salle_id uuid references salles(id) on delete set null,
  start time not null,
  "end" time not null,
  hours numeric not null
);
create index idx_course_slots_classe_day on course_slots(classe_id, day);

-- ----------------------------------------------------------------------------
-- Helpdesk / Maintenance
-- ----------------------------------------------------------------------------

create table prestataires (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  specialite text,
  telephone text
);

create table helpdesk_incidents (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  lieu text,
  categorie text,
  description text,
  statut text not null,
  prestataire_id uuid references prestataires(id) on delete set null
);

-- ============================================================================
-- Row Level Security — accès restreint aux utilisateurs authentifiés
-- (règles simples pour un usage mono-établissement ; à affiner si multi-comptes)
-- ============================================================================

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "Authenticated users can do everything" on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');',
      t
    );
  end loop;
end $$;
