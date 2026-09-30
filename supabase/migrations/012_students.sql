-- Migration 012: Élèves (students) — dossier de base + statistiques d'assiduité dérivées

drop table if exists public.students cascade;

create table public.students (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  sexe text not null check (sexe in ('M', 'F')),
  classe text not null,
  absences_heures text not null default '0h',
  absences_fois integer not null default 0,
  retards_min text not null default '0h',
  retards_fois integer not null default 0,
  total_heures text not null default '0h',
  taux numeric not null default 100
);

insert into public.students (id, name, sexe, classe, absences_heures, absences_fois, retards_min, retards_fois, total_heures, taux) values
  ('s1', 'Anas Alami', 'M', '3APIC-A', '5h 30min', 3, '30min', 1, '6h', 94.6),
  ('s2', 'Salma Bennani', 'F', '3APIC-A', '2h', 1, '0h', 0, '2h', 98.2),
  ('s3', 'Youssef Tazi', 'M', '3APIC-A', '0h', 0, '0h', 0, '0h', 100.0),
  ('s4', 'Kenza Kadiri', 'F', '3APIC-A', '0h', 0, '0h', 0, '0h', 100.0),
  ('s5', 'Mehdi El Fassi', 'M', '3APIC-A', '0h', 0, '0h', 0, '0h', 100.0),
  ('s6', 'Amina Cherkaoui', 'F', '2APIC-A', '0h', 0, '0h', 0, '0h', 100.0),
  ('s7', 'Yassine Idrissi', 'M', '2APIC-A', '1h', 1, '15min', 1, '1h 15min', 97.5),
  ('s8', 'Nour Ziani', 'F', '2APIC-B', '0h', 0, '0h', 0, '0h', 100.0),
  ('s9', 'Omar Sekkat', 'M', '1APIC-A', '3h', 2, '0h', 0, '3h', 96.1),
  ('s10', 'Lina Chraibi', 'F', '1APIC-A', '0h', 0, '0h', 0, '0h', 100.0);

alter table public.students enable row level security;
create policy "Authenticated users can do everything" on public.students for all using (auth.role() = 'authenticated');
