-- Migration 035 : module Transport — chauffeurs, aides-maîtresses, 5 lignes (A-E) avec trajet/
-- capacité/personnel assigné en permanence, rotation hebdomadaire manuelle du trajet collège,
-- affectation des élèves à une ligne + exception horaire de sortie.

create table public.chauffeurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null default '',
  created_at timestamptz not null default now()
);

create table public.aides_maitresses (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null default '',
  created_at timestamptz not null default now()
);

-- Pas rattachées à annee_scolaire_id : ressources opérationnelles (véhicules/trajets), pas des
-- données pédagogiques par année, cohérent avec le fait qu'elles ne se recréent pas à la rentrée.
create table public.transport_lignes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  trajet text not null default '',
  capacite integer not null default 25,
  chauffeur_id uuid references public.chauffeurs(id) on delete set null,
  aide_id uuid references public.aides_maitresses(id) on delete set null,
  fait_college boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.transport_lignes (nom) values ('A'), ('B'), ('C'), ('D'), ('E');

-- Affectation élève -> ligne + exception horaire (soir), sur student_identities. Pas de contrainte
-- FK stricte sur transport_ligne (texte libre 'A'..'E') : cohérent avec students.classe, qui n'est
-- pas non plus une FK vers classes.nom dans ce projet — la validité est garantie côté UI (select).
alter table public.student_identities add column transport_ligne text;
alter table public.student_identities add column transport_sortie_17h boolean not null default false;
alter table public.student_identities add column transport_motif_exception text;
alter table public.student_identities add column transport_motif_autre text;

-- Horaires partagés par les 5 lignes (un seul départ matin, deux départs soir).
alter table public.services_capacite add column transport_heure_matin text not null default '07:30';
alter table public.services_capacite add column transport_heure_soir_primaire text not null default '16:00';
alter table public.services_capacite add column transport_heure_soir_college text not null default '17:00';

alter table public.chauffeurs enable row level security;
create policy "Authenticated users can do everything" on public.chauffeurs for all using (auth.role() = 'authenticated');
alter table public.aides_maitresses enable row level security;
create policy "Authenticated users can do everything" on public.aides_maitresses for all using (auth.role() = 'authenticated');
alter table public.transport_lignes enable row level security;
create policy "Authenticated users can do everything" on public.transport_lignes for all using (auth.role() = 'authenticated');
