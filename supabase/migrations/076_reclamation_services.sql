-- Migration 076: services de traitement des réclamations parents (Phase 34).
-- Chaque service traite certaines catégories de réclamation (ex. Cantine, Transport…) ; chaque assistant
-- (profil) peut appartenir à plusieurs services. Le service d'une réclamation se déduit de sa catégorie.
-- La liste est modifiable dans Référentiel ; les services ci-dessous ne sont qu'un point de départ à adapter.
create table public.reclamation_services (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  categories text[] not null default '{}',
  ordre int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reclamation_services enable row level security;
create policy "Staff can do everything on reclamation_services" on public.reclamation_services
  for all using (public.is_staff()) with check (public.is_staff());

-- Services auxquels appartient chaque assistant (identifiants de reclamation_services, sans clé étrangère :
-- un tableau d'uuid ne peut pas en porter ; l'application ignore les identifiants de services supprimés).
alter table public.profiles add column if not exists service_ids uuid[] not null default '{}';

-- Services de départ : les 19 catégories de réclamation, chacune dans un seul service.
insert into public.reclamation_services (nom, categories, ordre)
select * from (values
  ('Vie scolaire & discipline', array['Absence / Assiduité', 'Comportement', 'Harcèlement / Intimidation', 'Sécurité'], 1),
  ('Pédagogie', array['Notes', 'Examens / Évaluations', 'Pédagogie / Enseignement', 'Emploi du temps'], 2),
  ('Cantine', array['Cantine'], 3),
  ('Transport', array['Transport'], 4),
  ('Infirmerie', array['Infirmerie / Santé'], 5),
  ('Administration & finances', array['Frais de scolarité / Facturation', 'Inscription / Admission', 'Communication / Administration', 'Accueil / Réception', 'Uniforme / Tenue vestimentaire', 'Autre'], 6),
  ('Maintenance & locaux', array['Hygiène / Locaux'], 7),
  ('Activités périscolaires', array['Activités périscolaires / Sorties'], 8)
) as v(nom, categories, ordre)
where not exists (select 1 from public.reclamation_services);
