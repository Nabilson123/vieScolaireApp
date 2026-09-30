-- Planning du Service Garde : chauffeurs (déjà gérés) + vigile(s) (nouveau), postes prédéfinis,
-- périodes historisées, créneaux par intervenant, rotation du vendredi.
create table public.vigiles (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null default '',
  created_at timestamptz not null default now()
);
alter table public.vigiles enable row level security;
create policy "Staff can do everything on vigiles" on public.vigiles
  for all using (public.is_staff()) with check (public.is_staff());
insert into public.vigiles (nom) values ('Benissa');

create table public.garde_config (
  id uuid primary key default gen_random_uuid(),
  postes text[] not null default '{}'
);
alter table public.garde_config enable row level security;
create policy "Staff can do everything on garde_config" on public.garde_config
  for all using (public.is_staff()) with check (public.is_staff());
insert into public.garde_config (postes) values (array[
  'Transport','Pause','Maisonnette','L''Absence (Primaire)','L''Absence (M&C)','Accueil',
  'Hall Grand Primaire','Hall Petit Primaire','Caisse','Accueil / Réception des repas','Achat',
  'Remplacement','Accompagnement Sport + Récréation','Vérification du Réfectoire','Garde Repas',
  'Escalier','Garde Hall / Réception des repas','Vérification Accueil'
]);

-- personnel_type + personnel_id (pas de FK unique possible vers deux tables différentes en
-- Postgres) : résolution du nom côté app via getChauffeursSnapshot()/getVigilesSnapshot().
create table public.garde_periodes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  date_debut date not null,
  date_fin date not null,
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  created_at timestamptz not null default now()
);
alter table public.garde_periodes enable row level security;
create policy "Staff can do everything on garde_periodes" on public.garde_periodes
  for all using (public.is_staff()) with check (public.is_staff());

create table public.garde_affectations (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.garde_periodes(id) on delete cascade,
  personnel_type text not null check (personnel_type in ('chauffeur','vigile')),
  personnel_id uuid not null,
  heure_debut time not null,
  heure_fin time not null,
  poste text not null,
  created_at timestamptz not null default now()
);
alter table public.garde_affectations enable row level security;
create policy "Staff can do everything on garde_affectations" on public.garde_affectations
  for all using (public.is_staff()) with check (public.is_staff());

create table public.garde_vendredi_rotation (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.garde_periodes(id) on delete cascade,
  date date not null,
  personnel_type text check (personnel_type in ('chauffeur','vigile')),
  personnel_id uuid,
  motif_reserve text,
  unique (periode_id, date)
);
alter table public.garde_vendredi_rotation enable row level security;
create policy "Staff can do everything on garde_vendredi_rotation" on public.garde_vendredi_rotation
  for all using (public.is_staff()) with check (public.is_staff());
