-- Migration 013: Identité complète des élèves (fiche civile, contacts parents, cantine/transport)

drop table if exists public.student_identities cascade;

create table public.student_identities (
  student_id text primary key references public.students(id) on delete cascade,
  prenom text not null default '',
  nom text not null default '',
  nom_ar text not null default '',
  prenom_ar text not null default '',
  code_massar text not null default '',
  cantine boolean not null default false,
  garde_apres_midi boolean not null default false,
  garde_matin boolean not null default false,
  garde_midi boolean not null default false,
  transport boolean not null default false,
  date_naissance text not null default '',
  lieu_naissance text not null default '',
  date_entree text not null default '',
  parent1_nom text not null default '',
  parent1_prenom text not null default '',
  parent1_tel text not null default '',
  parent2_nom text not null default '',
  parent2_prenom text not null default '',
  parent2_tel text not null default ''
);

alter table public.student_identities enable row level security;
create policy "Authenticated users can do everything" on public.student_identities for all using (auth.role() = 'authenticated');
