alter table public.teacher_absences add column if not exists ignored_gaps jsonb not null default '[]'::jsonb;
