-- Migration 019: Planificateur d'Examens
-- Une session = un examen formel pour une classe/matière sur un créneau donné, avec salle et
-- surveillant(s). La salle et les surveillants sont stockés en clair (label / ids) plutôt qu'en
-- clé étrangère stricte, comme le reste de l'app (ex: classe/matière en text ailleurs).

create table public.exam_sessions (
  id text primary key default gen_random_uuid()::text,
  date text not null,
  start_time text not null,
  end_time text not null,
  classe text not null,
  matiere text not null,
  salle_label text not null default '',
  surveillant_ids jsonb not null default '[]'::jsonb,
  consignes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.exam_sessions enable row level security;
create policy "Authenticated users can do everything" on public.exam_sessions for all using (auth.role() = 'authenticated');
