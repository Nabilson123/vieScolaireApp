-- Migration 072: lien optionnel entre un Suivi Prof récurrent et le niveau pédagogique qu'il
-- couvre (ex. "CE1" pour une réunion regroupant les PP de CE1-A et CE1-B) — alimente le dashboard
-- "Suivi de Classe" pour distinguer un niveau déjà réellement planifié d'un niveau juste suggéré.
alter table public.suivi_profs add column if not exists niveau text;
