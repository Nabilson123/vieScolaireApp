-- Migration 054 : réservation ponctuelle de salles (Phase 2)
--
-- Distinct de salles.id (référentiel) et de class_schedules (EDT régulier hebdomadaire) : une
-- réservation est un événement ponctuel daté, staff uniquement (pas de policy parent). Le conflit
-- avec l'EDT régulier ou une autre réservation est vérifié côté client et affiché en avertissement
-- non bloquant (décision validée) — pas de contrainte d'exclusion en base.

create table public.reservations_salles (
  id uuid primary key default gen_random_uuid(),
  salle_id uuid not null references public.salles(id) on delete cascade,
  titre text not null default '',
  date date not null,
  heure_debut time not null,
  heure_fin time not null,
  reserve_par uuid references public.profiles(id),
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  created_at timestamptz not null default now()
);
alter table public.reservations_salles enable row level security;

create policy "Staff can do everything on reservations_salles" on public.reservations_salles
  for all using (public.is_staff()) with check (public.is_staff());
