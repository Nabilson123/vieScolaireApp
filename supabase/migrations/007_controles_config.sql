-- Migration 007: Contrôles / Compétences (types de contrôle, niveaux d'acquisition,
-- objectifs pédagogiques, compétences, appréciations)

create table if not exists public.types_controle_notes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ponderation integer not null
);

create table if not exists public.niveaux_acquisition (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  couleur text not null check (couleur in ('emerald', 'amber', 'rose', 'sky'))
);

create table if not exists public.objectifs_pedagogiques (
  id uuid primary key default gen_random_uuid(),
  matiere text not null,
  niveau text not null,
  texte text not null
);

create table if not exists public.competences (
  id uuid primary key default gen_random_uuid(),
  matiere text not null,
  niveau text not null,
  texte text not null
);

create table if not exists public.appreciations (
  id uuid primary key default gen_random_uuid(),
  categorie text not null check (categorie in ('Excellent', 'Bien', 'Peut mieux faire', 'Insuffisant')),
  texte text not null
);

insert into public.types_controle_notes (nom, ponderation) values
  ('Contrôle 1', 30),
  ('Contrôle 2', 30),
  ('Devoir Surveillé', 20),
  ('Examen', 20);

insert into public.niveaux_acquisition (nom, couleur) values
  ('Acquis', 'emerald'),
  ('En cours d''acquisition', 'amber'),
  ('Non Acquis', 'rose');

insert into public.objectifs_pedagogiques (matiere, niveau, texte) values
  ('Mathématiques', 'CE1', 'Maîtriser les additions et soustractions à deux chiffres.'),
  ('Français', 'CE1', 'Lire un texte court avec fluidité et en comprendre le sens.');

insert into public.competences (matiere, niveau, texte) values
  ('Mathématiques', 'CE3', 'Maîtrise des fractions simples'),
  ('SVT', '1APIC', 'Identifier les organes du système digestif');

insert into public.appreciations (categorie, texte) values
  ('Excellent', 'Excellent trimestre, élève sérieux et impliqué.'),
  ('Bien', 'Bon travail dans l''ensemble, continuez ainsi.'),
  ('Peut mieux faire', 'Des efforts sont à fournir, le potentiel est là.'),
  ('Insuffisant', 'Résultats insuffisants, un accompagnement est nécessaire.');

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('types_controle_notes', 'niveaux_acquisition', 'objectifs_pedagogiques', 'competences', 'appreciations')
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format(
      'create policy "Authenticated users can do everything" on public.%I for all using (auth.role() = ''authenticated'')',
      t.tablename
    );
  end loop;
end $$;
