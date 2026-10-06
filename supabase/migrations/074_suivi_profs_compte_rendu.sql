-- Migration 074: compte-rendu structuré de la Réunion de suivi de classe (Phase 31).
-- Colonne dédiée sur suivi_profs, jamais touchée par le chemin générique « Suivi Profs » (colonne `notes`,
-- texte libre) : un suivi de niveau reste modifiable par les deux chemins sans risque d'écrasement.
--
-- Régularisation : cette colonne avait été ajoutée à la main sur la base en production lors de la Phase 31
-- sans fichier de migration. Le script est idempotent (`if not exists`) : sans effet là où la colonne existe
-- déjà, et il rend une base neuve reproductible.
alter table public.suivi_profs
  add column if not exists compte_rendu jsonb not null default '{}'::jsonb;
