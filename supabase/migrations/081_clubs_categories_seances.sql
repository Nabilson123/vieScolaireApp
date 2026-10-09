-- Phase 37 (suite) — Clubs : plusieurs séances par semaine et catégories (U9, U12, U14…).
-- Une catégorie = une fiche de club à part (ses séances, son encadrant, ses places, ses niveaux, son tarif, ses inscrits) ;
-- les fiches qui portent le même nom (« Football ») sont regroupées à l'écran.

alter table public.clubs add column if not exists categorie text not null default '';

-- Séances de la semaine : [{ "jour": "LUNDI", "heureDebut": "16:00", "heureFin": "17:30", "salleId": "uuid" | null }, …]
alter table public.clubs add column if not exists seances jsonb not null default '[]'::jsonb;

-- Reprise des clubs existants : leur séance unique devient la première (et seule) séance.
update public.clubs
set seances = jsonb_build_array(jsonb_build_object(
  'jour', jour,
  'heureDebut', to_char(heure_debut, 'HH24:MI'),
  'heureFin', to_char(heure_fin, 'HH24:MI'),
  'salleId', salle_id
))
where seances = '[]'::jsonb and jour is not null;

-- Les anciennes colonnes (jour, heure_debut, heure_fin, salle_id) ne sont plus renseignées pour les nouveaux clubs :
-- elles restent en place (jamais supprimées, comme ailleurs dans le dépôt) mais deviennent facultatives.
alter table public.clubs alter column jour drop not null;
alter table public.clubs alter column heure_debut drop not null;
alter table public.clubs alter column heure_fin drop not null;
