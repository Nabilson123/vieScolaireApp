-- Migration 030: Délégués de classe (FICHE PG-11 du Cahier de Procédures)
-- Un titulaire + un suppléant par classe, réélus chaque année scolaire (les classes étant déjà
-- des fiches indépendantes par année, ces colonnes le sont transitivement).

alter table public.classes add column delegue_titulaire_id text references public.students(id) on delete set null;
alter table public.classes add column delegue_suppleant_id text references public.students(id) on delete set null;
alter table public.classes add column delegue_election_date date;
