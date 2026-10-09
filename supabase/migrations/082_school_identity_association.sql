-- Phase 37 (suite) — Clubs : identité de l'association sportive.
-- Les documents des clubs (reçus, listes, feuilles de présence, états) portent le nom et le logo de l'association sportive
-- et non ceux de l'école. Même mécanisme que le logo de l'école : image en base64 dans une colonne texte.

alter table public.school_identity add column if not exists association_nom text not null default '';
alter table public.school_identity add column if not exists association_logo text;

-- Nom de départ ; modifiable ensuite dans Référentiel → Informations (le logo se charge au même endroit).
update public.school_identity set association_nom = 'ASSOCIATION MONDRIAN SPORT ET CULTURE' where association_nom = '';
