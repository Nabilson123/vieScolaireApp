-- Refonte du planning de garde (Phase 7) : créneaux à durée variable, blocs par index de créneau
-- (fusion visuelle par grid-row/span), événements groupés en familles colorables, roster explicite
-- par période, vendredi à deux modes (présences / bande "événement" fusionnée). Remplace le schéma
-- de la migration 058 qui ne contenait encore aucune vraie ligne (garde_affectations,
-- garde_vendredi_rotation, garde_config) — chauffeurs/vigiles/garde_periodes inchangés.

-- Script rejouable sans erreur ni doublon (relance complète après une première exécution
-- partielle ou totale) : tout est supprimé dans l'ordre de dépendance avant recréation.
drop table if exists public.garde_vendredi_presence;
drop table if exists public.garde_vendredi_rotation;
drop table if exists public.garde_vendredi;
drop table if exists public.garde_affectations;
drop table if exists public.garde_periode_agents;
drop table if exists public.garde_creneaux;
drop table if exists public.garde_evenements;
drop table if exists public.garde_familles;
drop table if exists public.garde_config;

create table public.garde_familles (
  key text primary key,
  label text not null,
  color text not null,
  soft text not null,
  fg text not null
);
alter table public.garde_familles enable row level security;
create policy "Staff can do everything on garde_familles" on public.garde_familles
  for all using (public.is_staff()) with check (public.is_staff());
insert into public.garde_familles (key, label, color, soft, fg) values
  ('repas', 'Garde repas', '#1FFFB4', '#1FFFB4', '#003824'),
  ('pause', 'Pause', 'oklch(0.72 0.01 260)', 'oklch(0.9 0.004 264)', 'oklch(0.35 0.01 260)'),
  ('surv', 'Maisonnette', '#FF441F', '#FF441F', '#FFFFFF'),
  ('admin', 'Accueil', '#1F6AFF', '#1F6AFF', '#FFFFFF'),
  ('neutral', 'Autres affectations', 'oklch(0.85 0.005 264)', 'oklch(0.99 0.003 90)', 'oklch(0.3 0.01 260)');

create table public.garde_evenements (
  id text primary key,
  label text not null,
  famille_key text not null references public.garde_familles(key),
  ordre int not null default 0
);
alter table public.garde_evenements enable row level security;
create policy "Staff can do everything on garde_evenements" on public.garde_evenements
  for all using (public.is_staff()) with check (public.is_staff());
insert into public.garde_evenements (id, label, famille_key, ordre) values
  ('transport_matin', 'TRANSPORT', 'neutral', 1),
  ('sortie_transport', 'SORTIE TRANSPORT', 'neutral', 2),
  ('porte_es', 'LA PORTE D''ENTRÉE ET SORTIE', 'neutral', 3),
  ('entree', 'L''ENTRÉE', 'neutral', 4),
  ('porte_principale', 'LA PORTE PRINCIPALE', 'neutral', 5),
  ('escalier', 'ESCALIER', 'neutral', 6),
  ('absence_mc', 'L''ABSENCE (M&C)', 'neutral', 7),
  ('absence_prim', 'L''ABSENCE (PRIMAIRE)', 'neutral', 8),
  ('absence', 'L''ABSENCE', 'neutral', 9),
  ('remplacement', 'REMPLACEMENT', 'neutral', 10),
  ('accompagnement', 'ACCOMPAGNEMENT SPORT + RÉCRÉATION', 'neutral', 11),
  ('maisonnette', 'MAISONNETTE', 'surv', 12),
  ('hall_grand', 'HALL GRAND PRIMAIRE', 'neutral', 13),
  ('hall_petit', 'HALL PETIT PRIMAIRE', 'neutral', 14),
  ('gouter_mat', 'GOÛTER MATERNELLE', 'neutral', 15),
  ('gouter_prim', 'GOÛTER PRIMAIRE / COLLÈGE', 'neutral', 16),
  ('gouter', 'GOÛTER', 'neutral', 17),
  ('accueil', 'ACCUEIL', 'admin', 18),
  ('caisse', 'CAISSE', 'neutral', 19),
  ('achat', 'ACHAT', 'neutral', 20),
  ('accueil_repas', 'ACCUEIL / RÉCEPTION DES REPAS', 'admin', 21),
  ('verif_accueil', 'VÉRIFICATION ACCUEIL', 'admin', 22),
  ('garde_hall_repas', 'GARDE HALL / RÉCEPTION DES REPAS', 'repas', 23),
  ('garde_repas_mat', 'GARDE REPAS MATERNELLE', 'repas', 24),
  ('garde_repas_prim', 'GARDE REPAS PRIMAIRE / COLLÈGE', 'repas', 25),
  ('garde_repas', 'GARDE REPAS', 'repas', 26),
  ('verif_refectoire', 'VÉRIFICATION DU RÉFECTOIRE', 'neutral', 27),
  ('les_repas', 'LES REPAS', 'neutral', 28),
  ('pause', 'PAUSE', 'pause', 29);

create table public.garde_creneaux (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.garde_periodes(id) on delete cascade,
  index int not null,
  debut time not null,
  fin time not null,
  unique (periode_id, index)
);
alter table public.garde_creneaux enable row level security;
create policy "Staff can do everything on garde_creneaux" on public.garde_creneaux
  for all using (public.is_staff()) with check (public.is_staff());

create table public.garde_affectations (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.garde_periodes(id) on delete cascade,
  personnel_type text not null check (personnel_type in ('chauffeur','vigile')),
  personnel_id uuid not null,
  from_index int not null,
  to_index int not null,
  evenement_id text not null references public.garde_evenements(id),
  created_at timestamptz not null default now()
);
alter table public.garde_affectations enable row level security;
create policy "Staff can do everything on garde_affectations" on public.garde_affectations
  for all using (public.is_staff()) with check (public.is_staff());

create table public.garde_periode_agents (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.garde_periodes(id) on delete cascade,
  personnel_type text not null check (personnel_type in ('chauffeur','vigile')),
  personnel_id uuid not null,
  ordre int not null default 0,
  unique (periode_id, personnel_type, personnel_id)
);
alter table public.garde_periode_agents enable row level security;
create policy "Staff can do everything on garde_periode_agents" on public.garde_periode_agents
  for all using (public.is_staff()) with check (public.is_staff());

create table public.garde_vendredi (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.garde_periodes(id) on delete cascade,
  ordre int not null default 0,
  date_label text not null default '',
  mode text not null default 'marks' check (mode in ('marks','note')),
  note text not null default ''
);
alter table public.garde_vendredi enable row level security;
create policy "Staff can do everything on garde_vendredi" on public.garde_vendredi
  for all using (public.is_staff()) with check (public.is_staff());

create table public.garde_vendredi_presence (
  id uuid primary key default gen_random_uuid(),
  vendredi_id uuid not null references public.garde_vendredi(id) on delete cascade,
  periode_agent_id uuid not null references public.garde_periode_agents(id) on delete cascade,
  present boolean not null default false,
  unique (vendredi_id, periode_agent_id)
);
alter table public.garde_vendredi_presence enable row level security;
create policy "Staff can do everything on garde_vendredi_presence" on public.garde_vendredi_presence
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------------------------
-- Données réelles relevées du planning papier "Période 01" (08/09/2025 — 17/10/2025), déjà en
-- base (garde_periodes.nom = 'Période 01', chauffeurs Aziz/Houssine/Zohair/Ettaki/Moncef déjà
-- créés). Ancrages horaires fidèles ; répartition agent par agent à valider par la vie scolaire
-- au premier usage, directement dans l'écran une fois livré (cf. README du handoff).
-- ---------------------------------------------------------------------------------------------

insert into public.garde_creneaux (periode_id, index, debut, fin)
select (select id from public.garde_periodes where nom = 'Période 01' limit 1), s.idx, s.debut::time, s.fin::time
from (values
  (0,'07:30','07:45'),(1,'07:45','08:00'),(2,'08:00','08:15'),(3,'08:15','08:30'),
  (4,'08:30','08:45'),(5,'08:45','09:00'),(6,'09:00','09:15'),(7,'09:15','09:30'),
  (8,'09:30','09:45'),(9,'09:45','10:00'),(10,'10:00','10:15'),(11,'10:15','10:30'),
  (12,'10:30','10:45'),(13,'10:45','11:00'),(14,'11:00','11:15'),(15,'11:15','11:30'),
  (16,'11:30','11:45'),(17,'11:45','12:00'),(18,'12:00','12:15'),(19,'12:15','12:30'),
  (20,'12:30','12:45'),(21,'12:45','13:00'),(22,'13:00','13:15'),(23,'13:15','13:30'),
  (24,'13:30','13:45'),(25,'13:45','14:00'),(26,'14:00','14:15'),(27,'14:15','14:30'),
  (28,'14:30','14:45'),(29,'14:45','15:00'),(30,'15:00','15:15'),(31,'15:15','15:30'),
  (32,'15:30','15:45'),(33,'15:45','16:00'),(34,'16:00','18:00')
) as s(idx, debut, fin)
where exists (select 1 from public.garde_periodes where nom = 'Période 01');

insert into public.garde_periode_agents (periode_id, personnel_type, personnel_id, ordre)
select (select id from public.garde_periodes where nom = 'Période 01' limit 1), 'chauffeur', c.id, ord.ordre
from (values ('Aziz',0),('Houssine',1),('Zohair',2),('Ettaki',3),('Moncef',4)) as ord(nom, ordre)
join public.chauffeurs c on c.nom = ord.nom
where exists (select 1 from public.garde_periodes where nom = 'Période 01');

with agent_map(idx, personnel_id) as (
  values
    (0, (select id from public.chauffeurs where nom = 'Aziz')),
    (1, (select id from public.chauffeurs where nom = 'Houssine')),
    (2, (select id from public.chauffeurs where nom = 'Zohair')),
    (3, (select id from public.chauffeurs where nom = 'Ettaki')),
    (4, (select id from public.chauffeurs where nom = 'Moncef'))
),
seed(agent_idx, from_index, to_index, evenement_id) as (
  values
    (0,0,0,'transport_matin'), (1,0,0,'transport_matin'), (2,0,0,'transport_matin'), (3,0,0,'transport_matin'), (4,0,0,'transport_matin'),
    (0,1,3,'entree'), (1,1,3,'porte_es'), (2,1,3,'entree'), (3,1,3,'accueil'), (4,1,3,'porte_es'),
    (0,4,5,'pause'), (1,4,5,'pause'), (2,4,5,'gouter_mat'), (3,4,5,'pause'), (4,4,5,'pause'),
    (0,6,7,'porte_principale'), (1,6,7,'absence_mc'), (2,6,7,'accueil'), (3,6,7,'hall_grand'), (4,6,7,'absence_prim'),
    (0,8,9,'maisonnette'), (1,8,9,'pause'), (2,8,9,'maisonnette'), (3,8,9,'pause'), (4,8,9,'pause'),
    (0,10,13,'caisse'), (1,10,13,'accueil_repas'), (2,10,13,'achat'), (3,10,13,'hall_petit'), (4,10,13,'gouter_prim'),
    (0,14,16,'accompagnement'), (1,14,16,'remplacement'), (2,14,16,'garde_hall_repas'), (3,14,16,'garde_repas_mat'), (4,14,16,'porte_es'),
    (0,17,21,'verif_refectoire'), (1,17,21,'les_repas'), (2,17,21,'verif_refectoire'), (3,17,21,'escalier'), (4,17,21,'garde_repas_prim'),
    (0,22,25,'pause'), (1,22,25,'accueil'), (2,22,25,'maisonnette'), (3,22,25,'pause'), (4,22,25,'pause'),
    (0,26,29,'absence'), (1,26,29,'pause'), (2,26,29,'pause'), (3,26,29,'accueil'), (4,26,29,'gouter'),
    (0,30,33,'porte_principale'), (1,30,33,'remplacement'), (2,30,33,'hall_grand'), (3,30,33,'hall_petit'), (4,30,33,'accompagnement'),
    (0,34,34,'sortie_transport'), (1,34,34,'porte_es'), (2,34,34,'transport_matin'), (3,34,34,'sortie_transport'), (4,34,34,'transport_matin')
)
insert into public.garde_affectations (periode_id, personnel_type, personnel_id, from_index, to_index, evenement_id)
select (select id from public.garde_periodes where nom = 'Période 01' limit 1), 'chauffeur', am.personnel_id, s.from_index, s.to_index, s.evenement_id
from seed s
join agent_map am on am.idx = s.agent_idx
where exists (select 1 from public.garde_periodes where nom = 'Période 01');

with fri(ordre, date_label, mode, note) as (
  values
    (0, 'Vendredi 12/09/2025', 'marks', ''),
    (1, 'Vendredi 19/09/2025', 'note', 'التحضير للقاء التواصلي الأول مع أولياء الأمور'),
    (2, 'Vendredi 26/09/2025', 'note', 'التحضير للقاء التواصلي الأول ابتدائي وإعدادي مع أولياء الأمور'),
    (3, 'Vendredi 03/10/2025', 'marks', ''),
    (4, 'Vendredi 10/10/2025', 'marks', ''),
    (5, 'Vendredi 17/10/2025', 'marks', '')
)
insert into public.garde_vendredi (periode_id, ordre, date_label, mode, note)
select (select id from public.garde_periodes where nom = 'Période 01' limit 1), ordre, date_label, mode, note
from fri
where exists (select 1 from public.garde_periodes where nom = 'Période 01');

-- Les 6 vendredis relevés sont tous "tout le monde présent" (les lignes 'marks' portaient déjà
-- [1,1,1,1,1] ; les lignes 'note' l'imposent par l'invariant du modèle — garde annulée = tous
-- présents).
insert into public.garde_vendredi_presence (vendredi_id, periode_agent_id, present)
select v.id, pa.id, true
from public.garde_vendredi v
join public.garde_periodes p on p.id = v.periode_id and p.nom = 'Période 01'
join public.garde_periode_agents pa on pa.periode_id = p.id;
