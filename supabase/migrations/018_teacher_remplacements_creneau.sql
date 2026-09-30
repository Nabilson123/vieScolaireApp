-- Migration 018: Ajoute le créneau horaire exact (start_time/end_time) aux remplacements,
-- pour permettre de diviser une séance entre plusieurs remplaçants.

alter table public.teacher_remplacements
  add column if not exists start_time text,
  add column if not exists end_time text;
