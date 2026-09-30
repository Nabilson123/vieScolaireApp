-- Précise quel parent a effectivement été joint lors de l'appel (Parent 1, Parent 2, les deux,
-- ou une autre personne) — jusqu'ici la table ne gardait que qui côté staff avait appelé
-- (marked_by), pas qui côté famille avait décroché.
alter table public.appels_parents add column parent_appele text not null default '';
