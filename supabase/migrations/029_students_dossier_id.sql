-- Migration 029: dossier_id — identité stable d'un élève à travers les années

-- Chaque fiche élève est aujourd'hui totalement indépendante d'une année sur l'autre (nouvel id à
-- chaque réinscription, aucun lien entre elles). dossier_id introduit une identité permanente
-- partagée par toutes les fiches annuelles d'un même élève réel : au moment de la réinscription,
-- si un élève avec le même code Massar existe dans une année précédente, la nouvelle fiche reprend
-- son dossier_id ; sinon elle en reçoit un nouveau. Permet de retrouver tout l'historique d'un
-- élève (comportement, santé, notes...) via `select * from students where dossier_id = X`.
--
-- Défaut volatile (gen_random_uuid()) : Postgres réécrit la table et calcule une valeur distincte
-- pour chaque ligne existante, donc les 446 élèves actuels reçoivent chacun leur propre dossier_id
-- indépendant (cohérent : aucun n'a encore de lignage inter-années).
alter table public.students add column dossier_id uuid not null default gen_random_uuid();
create index students_dossier_id_idx on public.students (dossier_id);
