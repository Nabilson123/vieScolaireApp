-- Migration 009: Structure scolaire (classes)

drop table if exists public.classes cascade;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  niveau text not null,
  capacite_max integer not null,
  salle text not null default '',
  statut text not null check (statut in ('Active', 'Archivée')) default 'Active',
  professeur_principal_id text
);

insert into public.classes (nom, niveau, capacite_max, salle, professeur_principal_id) values
  ('1APIC-A', '1APIC', 32, 'Bâtiment Collège - Salle 1', 't004'),
  ('2APIC-A', '2APIC', 32, 'Bâtiment Collège - Salle 2', 't002'),
  ('2APIC-B', '2APIC', 32, 'Bâtiment Collège - Salle 3', 't002'),
  ('3APIC-A', '3APIC', 32, 'Bâtiment Collège - Salle 4', 't001'),
  ('CE1-A', 'CE1', 30, 'Bâtiment Primaire - Salle 1', null),
  ('CE1-B', 'CE1', 30, 'Bâtiment Primaire - Salle 2', null),
  ('CE2-A', 'CE2', 30, 'Bâtiment Primaire - Salle 3', null),
  ('CE2-B', 'CE2', 30, 'Bâtiment Primaire - Salle 4', null),
  ('CE3-A', 'CE3', 30, 'Bâtiment Primaire - Salle 5', null),
  ('CE3-B', 'CE3', 30, 'Bâtiment Primaire - Salle 6', null),
  ('CE4-A', 'CE4', 30, 'Bâtiment Primaire - Salle 7', null),
  ('CE4-B', 'CE4', 30, 'Bâtiment Primaire - Salle 8', null),
  ('CE5-A', 'CE5', 30, 'Bâtiment Primaire - Salle 9', null),
  ('CE5-B', 'CE5', 30, 'Bâtiment Primaire - Salle 10', null),
  ('CE6-A', 'CE6', 30, 'Bâtiment Primaire - Salle 11', null),
  ('CE6-B', 'CE6', 30, 'Bâtiment Primaire - Salle 12', null),
  ('GS-A', 'GS', 24, 'Pavillon Maternelle - Salle 4', null),
  ('GS-B', 'GS', 24, 'Pavillon Maternelle - Salle 5', null),
  ('MS-A', 'MS', 24, 'Pavillon Maternelle - Salle 2', null),
  ('MS-B', 'MS', 24, 'Pavillon Maternelle - Salle 3', null),
  ('PS-A', 'PS', 24, 'Pavillon Maternelle - Salle 1', null);

alter table public.classes enable row level security;
create policy "Authenticated users can do everything" on public.classes for all using (auth.role() = 'authenticated');
