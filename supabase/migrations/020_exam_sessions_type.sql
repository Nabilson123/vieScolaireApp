-- Migration 020: Type d'examen (Examen Officiel / Examen Blanc) sur les sessions du Planificateur d'Examens.

alter table public.exam_sessions
  add column if not exists type text not null default 'Examen Officiel';
