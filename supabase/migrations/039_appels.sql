-- Migration 039 : "appels" — pointage de présence par créneau, saisi côté vie scolaire/CPE après
-- confirmation orale avec l'enseignant (l'appli n'a pas de connexion enseignant). Une ligne = appel
-- fait pour (classe, créneau, jour) ; l'absence de ligne pour le créneau en cours = appel non fait.
-- slot_id est déjà unique dans tout l'emploi du temps d'une année (voir findSlotOwner), donc classe
-- est redondant ici mais dupliqué pour éviter de re-résoudre le propriétaire du créneau à l'affichage.
create table public.appels (
  id uuid primary key default gen_random_uuid(),
  annee_scolaire_id uuid not null references public.annees_scolaires(id) on delete restrict,
  date text not null,
  classe text not null,
  slot_id text not null,
  marked_by text not null default '',
  marked_at timestamptz not null default now(),
  note text,
  unique (annee_scolaire_id, date, slot_id)
);

alter table public.appels enable row level security;
create policy "Authenticated users can do everything" on public.appels for all using (auth.role() = 'authenticated');
