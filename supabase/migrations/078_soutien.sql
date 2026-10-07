-- Migration 078 : soutien scolaire (Phase 36).
-- Une séance de soutien = une matière, un jour et un horaire hebdomadaires sur une période, un enseignant, une salle
-- et les classes visées. Les élèves y sont inscrits (soutien_inscriptions) ; pour chacun, la vie scolaire note la réponse
-- des parents (reste au soutien / ne reste pas) reçue par WhatsApp. Staff uniquement (aucun accès parent).

create table if not exists public.soutien_seances (
  id uuid primary key default gen_random_uuid(),
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  matiere text not null,
  jour text not null check (jour in ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI')),
  heure_debut time not null,
  heure_fin time not null,
  -- teachers.id est du texte (pas un uuid)
  teacher_id text references public.teachers(id) on delete set null,
  salle_id uuid references public.salles(id) on delete set null,
  -- classes visées : proposées à l'inscription et affichées dans leur emploi du temps
  classes text[] not null default '{}',
  date_debut date not null,
  -- null = jusqu'à la fin de l'année
  date_fin date,
  -- dates précises où la séance n'a pas lieu
  dates_annulees date[] not null default '{}',
  note text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (heure_fin > heure_debut)
);

create table if not exists public.soutien_inscriptions (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.soutien_seances(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  statut text not null default 'a_confirmer' check (statut in ('a_confirmer', 'reste', 'ne_reste_pas')),
  message_envoye_le timestamptz,
  repondu_le timestamptz,
  created_at timestamptz not null default now(),
  unique (seance_id, student_id)
);

create index if not exists soutien_seances_annee_idx on public.soutien_seances (annee_scolaire_id);
create index if not exists soutien_inscriptions_student_idx on public.soutien_inscriptions (student_id);

alter table public.soutien_seances enable row level security;
alter table public.soutien_inscriptions enable row level security;

drop policy if exists "Staff can do everything on soutien_seances" on public.soutien_seances;
create policy "Staff can do everything on soutien_seances" on public.soutien_seances
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can do everything on soutien_inscriptions" on public.soutien_inscriptions;
create policy "Staff can do everything on soutien_inscriptions" on public.soutien_inscriptions
  for all using (public.is_staff()) with check (public.is_staff());
