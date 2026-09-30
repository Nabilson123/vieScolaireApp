-- Migration 034 : capacité (nombre de places) pour Transport, Cantine et Garde — jusqu'ici de purs
-- compteurs d'élèves inscrits (student_identities), sans notion de capacité maximale contrairement
-- aux classes (capacite_max). Singleton, même structure que school_identity (002).
create table public.services_capacite (
  id uuid primary key default gen_random_uuid(),
  transport_capacite integer not null default 150,
  cantine_capacite integer not null default 400,
  garde_capacite integer not null default 50,
  updated_at timestamptz not null default now()
);

insert into public.services_capacite (transport_capacite, cantine_capacite, garde_capacite)
values (150, 400, 50);

alter table public.services_capacite enable row level security;
create policy "Authenticated users can do everything" on public.services_capacite
  for all using (auth.role() = 'authenticated');
