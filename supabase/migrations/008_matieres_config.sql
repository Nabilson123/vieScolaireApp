-- Migration 008: Référentiel matières (matieres + configuration par niveau)

create table if not exists public.matieres (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  nom_ar text not null default '',
  code text not null,
  rtl boolean not null default false
);

create table if not exists public.matiere_niveau_config (
  id uuid primary key default gen_random_uuid(),
  matiere_id uuid not null references public.matieres(id) on delete cascade,
  niveau text not null,
  active boolean not null default true,
  coefficient integer not null default 2,
  exporter_massar boolean not null default true,
  afficher_bulletin boolean not null default true,
  exporter_par_chapitres boolean not null default false,
  hors_max_examens boolean not null default false,
  unique (matiere_id, niveau)
);

do $$
declare
  niveaux text[] := array['PS','MS','GS','CE1','CE2','CE3','CE4','CE5','CE6','1APIC','2APIC','3APIC'];
  matiere record;
  n text;
  new_id uuid;
begin
  for matiere in
    select * from (values
      ('Éducation Islamique', 'EI', 2),
      ('Langue Arabe', 'AR', 3),
      ('Français', 'FR', 5),
      ('Mathématiques', 'MATHS', 5),
      ('Anglais', 'ANG', 2),
      ('Sport', 'EPS', 1),
      ('Communication', 'COM', 1),
      ('Éveil Scientifique', 'ESC', 2),
      ('Physique-Chimie', 'PC', 4),
      ('SVT', 'SVT', 3),
      ('Histoire-Géographie', 'HG', 2),
      ('Philosophie', 'PHI', 2),
      ('Informatique', 'INFO', 1),
      ('Arts Plastiques', 'ART', 1)
    ) as t(nom, code, coefficient)
  loop
    insert into public.matieres (nom, nom_ar, code, rtl) values (matiere.nom, '', matiere.code, false)
      returning id into new_id;
    foreach n in array niveaux loop
      insert into public.matiere_niveau_config (matiere_id, niveau, coefficient) values (new_id, n, matiere.coefficient);
    end loop;
  end loop;
end $$;

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('matieres', 'matiere_niveau_config')
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format(
      'create policy "Authenticated users can do everything" on public.%I for all using (auth.role() = ''authenticated'')',
      t.tablename
    );
  end loop;
end $$;
