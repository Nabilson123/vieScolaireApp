-- Migration 023: Années scolaires (dimension multi-année, phase 1 — infrastructure de base)

create table public.annees_scolaires (
  id uuid primary key default gen_random_uuid(),
  annee_debut integer not null unique,
  libelle text not null,
  date_debut date,
  date_fin date,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Garantit "au plus une ligne active" sans trigger (index unique partiel).
create unique index annees_scolaires_active_unique on public.annees_scolaires (active) where active;

insert into public.annees_scolaires (annee_debut, libelle, date_debut, date_fin, active) values
  (2026, '2026/2027', '2026-09-01', '2027-08-31', true);

alter table public.annees_scolaires enable row level security;
create policy "Authenticated users can do everything" on public.annees_scolaires for all using (auth.role() = 'authenticated');
