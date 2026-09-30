-- Corrige school_identity pour correspondre au vrai modèle de l'appli (SchoolIdentity)
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run (choisir "Run without RLS")

drop table if exists public.school_identity cascade;

create table school_identity (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  nom_ar text not null default '',
  tel1 text not null default '',
  tel2 text not null default '',
  fax text not null default '',
  cycle_maternelle boolean not null default true,
  cycle_primaire boolean not null default true,
  cycle_college boolean not null default true,
  cycle_lycee boolean not null default false,
  adresse text not null default '',
  site_web text not null default '',
  email text not null default '',
  facebook text not null default '',
  instagram text not null default '',
  linkedin text not null default '',
  logo text,
  updated_at timestamptz not null default now()
);

alter table school_identity enable row level security;

create policy "Authenticated users can do everything" on school_identity
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Le nom/logo de l'établissement doit être visible sur l'écran de connexion, avant authentification
create policy "Anyone can read school identity" on school_identity
  for select using (true);

-- Ligne unique par défaut (reprend les valeurs actuellement codées en dur dans l'appli)
insert into school_identity (nom, nom_ar, tel1, tel2, cycle_maternelle, cycle_primaire, cycle_college, cycle_lycee, adresse, site_web, email)
values (
  'Groupe Scolaire Mondrian',
  'مجموعة مدارس موندريان',
  '+212 522-123456',
  '+212 661-123456',
  true, true, true, false,
  'Casablanca, Maroc',
  'www.mondrian.ma',
  'contact@mondrian.ma'
);
