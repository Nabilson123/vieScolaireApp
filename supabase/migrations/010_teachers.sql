-- Migration 010: Corps professoral (teachers)

drop table if exists public.teachers cascade;

create table public.teachers (
  id text primary key default gen_random_uuid()::text,
  prenom text not null,
  nom text not null,
  email text not null,
  telephone_mobile text not null default '',
  telephone_domicile text not null default '',
  matricule text not null default '',
  plateforme text not null default '',
  id_meeting text not null default '',
  lien_visio text not null default '',
  statut text not null check (statut in ('Permanent', 'Vacataire', 'Contractuel')) default 'Permanent',
  type text not null check (type in ('Principal', 'Remplaçant', 'Stagiaire')) default 'Principal',
  niveaux text[] not null default '{}',
  matieres text[] not null default '{}',
  classes text[] not null default '{}'
);

insert into public.teachers (id, prenom, nom, email, telephone_mobile, telephone_domicile, matricule, plateforme, id_meeting, lien_visio, statut, type, niveaux, matieres, classes) values
  ('t001', 'Youssef', 'Tazi', 'y.tazi@ecole.ma', '+212 611-223344', '', 'T001', '', '', '', 'Permanent', 'Principal', array['2APIC','3APIC'], array['Mathématiques'], array['2APIC-A','3APIC-A']),
  ('t002', 'Amina', 'Cherkaoui', 'amina.cherkaoui@ecole.ma', '+212 6XX-XXXXXX', '', 'T002', '', '', '', 'Permanent', 'Principal', array['2APIC','3APIC'], array['Français'], array['2APIC-A','2APIC-B','3APIC-A']),
  ('t003', 'Reda', 'Mansouri', 'reda.mansouri@ecole.ma', '+212 6XX-XXXXXX', '', 'T003', '', '', '', 'Permanent', 'Principal', array['2APIC','3APIC'], array['Physique-Chimie'], array['2APIC-A','3APIC-A']),
  ('t004', 'Sofia', 'Alaoui', 'sofia.alaoui@ecole.ma', '+212 6XX-XXXXXX', '', 'T004', '', '', '', 'Permanent', 'Principal', array['1APIC','2APIC'], array['SVT'], array['1APIC-A','2APIC-A']),
  ('t005', 'Anas', 'Berrada', 'anas.berrada@ecole.ma', '+212 6XX-XXXXXX', '', 'T005', '', '', '', 'Permanent', 'Principal', array['2APIC','3APIC'], array['Histoire-Géographie'], array['2APIC-A','3APIC-A']),
  ('t006', 'Meryem', 'Bennani', 'meryem.bennani@ecole.ma', '+212 6XX-XXXXXX', '', 'T006', '', '', '', 'Permanent', 'Principal', array['1APIC','2APIC','3APIC'], array['Éducation Islamique'], array['1APIC-A','2APIC-A','3APIC-A']),
  ('t007', 'Karim', 'Fassi', 'karim.fassi@ecole.ma', '+212 6XX-XXXXXX', '', 'T007', '', '', '', 'Permanent', 'Principal', array['2APIC','3APIC'], array['Anglais'], array['2APIC-A','3APIC-A']),
  ('t008', 'Nadia', 'Tazi', 'nadia.tazi@ecole.ma', '+212 6XX-XXXXXX', '', 'T008', '', '', '', 'Permanent', 'Principal', array['1APIC','2APIC'], array['Langue Arabe'], array['1APIC-A','2APIC-A']),
  ('t009', 'Khalid', 'Kadiri', 'khalid.kadiri@ecole.ma', '+212 6XX-XXXXXX', '', 'T009', '', '', '', 'Permanent', 'Remplaçant', array['2APIC','3APIC'], array['Sport'], array['2APIC-A','3APIC-A']),
  ('t010', 'Adnane', 'Oudghiri', 'adnane.oudghiri@ecole.ma', '+212 6XX-XXXXXX', '', 'T010', '', '', '', 'Vacataire', 'Principal', array['2APIC','3APIC'], array['Informatique'], array['2APIC-A','3APIC-A']),
  ('t011', 'Fatima', 'Alaoui', 'fatima.alaoui@ecole.ma', '+212 6XX-XXXXXX', '', 'T011', '', '', '', 'Permanent', 'Principal', array['2APIC','3APIC'], array['Philosophie'], array['2APIC-A','3APIC-A']);

alter table public.teachers enable row level security;
create policy "Authenticated users can do everything" on public.teachers for all using (auth.role() = 'authenticated');
