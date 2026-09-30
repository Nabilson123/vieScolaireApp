-- Migration 049 : accusés de lecture des circulaires — une ligne par (circulaire, parent) créée au
-- fan-out de publication ; read_at horodate la première ouverture côté portail.

create table public.circulaire_lectures (
  id uuid primary key default gen_random_uuid(),
  circulaire_id uuid not null references public.circulaires(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (circulaire_id, parent_id)
);

alter table public.circulaire_lectures enable row level security;
create policy "Staff can read all lecture receipts" on public.circulaire_lectures
  for select using (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Parents can read and mark their own lecture receipts" on public.circulaire_lectures
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- Complète la migration 048 : un parent lit le CONTENU d'une circulaire (titre/corps) uniquement
-- s'il existe une ligne circulaire_lectures le concernant — c'est cette appartenance déjà figée au
-- fan-out qui autorise la lecture, jamais un recalcul de cible_type/cible_niveau/cible_classe.
create policy "Parents can read circulaires they are a recipient of" on public.circulaires
  for select using (exists (
    select 1 from public.circulaire_lectures cl where cl.circulaire_id = circulaires.id and cl.parent_id = auth.uid()
  ));
