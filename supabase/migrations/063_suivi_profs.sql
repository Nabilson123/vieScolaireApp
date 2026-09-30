-- Migration 063: Suivi Profs (Rendez-vous Parents)
-- Entretiens de suivi pédagogique Direction/Vie Scolaire avec un ou plusieurs profs, distincts des
-- rendez-vous parents (RendezVousRecord, par élève) et des événements (Phase 26, par classe/école).

create table public.suivi_profs (
  id uuid primary key default gen_random_uuid(),
  teacher_ids uuid[] not null,
  date date not null,
  heure time not null,
  duree integer not null default 30,
  lieu text not null default '',
  motif text not null default '',
  statut text not null default 'Planifié' check (statut in ('Planifié', 'Réalisé', 'Annulé')),
  notes text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.suivi_profs enable row level security;
create policy "Staff can do everything on suivi_profs" on public.suivi_profs
  for all using (public.is_staff()) with check (public.is_staff());
