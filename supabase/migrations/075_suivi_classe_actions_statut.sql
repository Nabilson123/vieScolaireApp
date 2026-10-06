-- Migration 075: statut à quatre états pour les actions de suivi de classe (Phase 31), à la place du booléen
-- `done` créé par la migration 073 : À faire / En cours / À relancer / Faite (voir
-- src/data/suiviClasseActions.ts — le code n'utilise plus `done`).
--
-- Régularisation : le changement avait été appliqué à la main sur la base en production sans fichier de
-- migration (la colonne `done` n'y existe plus). Le script est idempotent : sans effet là où `statut` existe
-- et où `done` a disparu, et il met à niveau une base issue de la seule migration 073.
alter table public.suivi_classe_actions
  add column if not exists statut text not null default 'a_faire'
  check (statut in ('a_faire', 'en_cours', 'a_relancer', 'faite'));

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'suivi_classe_actions' and column_name = 'done'
  ) then
    -- Les actions déjà cochées deviennent « Faite » ; les autres restent « À faire » (valeur par défaut).
    update public.suivi_classe_actions set statut = 'faite' where done;
    alter table public.suivi_classe_actions drop column done;
  end if;
end $$;
