-- Migration 077: types de profil modifiables (CPE, Surveillant, Direction de la vie scolaire…).
-- La valeur stockée dans profiles.role reste la clé (`cle`) ; seul le libellé affiché devient modifiable, et de
-- nouveaux types peuvent s'ajouter. Les six types d'origine gardent leur clé : les droits qui en dépendent
-- (notes de service) continuent de fonctionner. profiles.role n'a pas de contrainte, rien à y changer.
create table public.profile_types (
  cle text primary key,
  libelle text not null,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profile_types enable row level security;
create policy "Staff can do everything on profile_types" on public.profile_types
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.profile_types (cle, libelle, ordre) values
  ('CPE', 'CPE', 1),
  ('Surveillant', 'Surveillant', 2),
  ('Direction', 'Direction de la vie scolaire', 3),
  ('AED', 'AED', 4),
  ('Secrétariat', 'Secrétariat', 5),
  ('Autre', 'Autre', 6);
