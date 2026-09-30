-- Migration 032 : statut actif/inactif d'un profil (nécessaire pour la désactivation de compte)
alter table public.profiles add column actif boolean not null default true;
