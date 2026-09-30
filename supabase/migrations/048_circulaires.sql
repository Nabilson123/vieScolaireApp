-- Migration 048 : circulaires ciblées (établissement / niveau / classe / liste d'élèves).
--
-- Le ciblage (cible_*) est figé au moment de la publication : un fan-out one-shot crée les lignes
-- circulaire_lectures (migration 049, qui ajoute aussi la policy SELECT parent sur CETTE table —
-- elle référence circulaire_lectures, donc ne peut être créée qu'après) pour les parents concernés,
-- pas de recalcul dynamique ensuite.

create table public.circulaires (
  id uuid primary key default gen_random_uuid(),
  titre text not null default '',
  corps text not null default '',
  cible_type text not null default 'etablissement',
  cible_niveau text,
  cible_classe text,
  cible_eleve_ids text[],
  relance_jours int,
  publie_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  annee_scolaire_id uuid not null references public.annees_scolaires(id)
);

alter table public.circulaires enable row level security;
create policy "Staff can do everything on circulaires" on public.circulaires
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
