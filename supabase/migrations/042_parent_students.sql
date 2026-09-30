-- Migration 042 : lien parent ↔ élève(s) — un parent peut couvrir plusieurs enfants, un élève peut
-- avoir plusieurs contacts parents rattachés. C'est la table pivot de toute l'isolation RLS de la
-- migration suivante (043).

create table public.parent_students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  relation text not null default 'Parent',
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

alter table public.parent_students enable row level security;
create policy "Staff can do everything on parent_students" on public.parent_students
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Parents can read their own links" on public.parent_students
  for select using (parent_id = auth.uid());
