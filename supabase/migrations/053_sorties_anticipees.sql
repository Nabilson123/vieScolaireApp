-- Migration 053 : sorties anticipées (Phase 2)
--
-- Table dédiée plutôt qu'un 3e EventRecord.type dans student_extras.events : une policy RLS
-- "update" ne peut pas restreindre un parent à "ajouter une seule entrée" dans une colonne JSONB —
-- lui donner un accès en écriture sur events lui permettrait de réécrire/supprimer les absences
-- saisies par le staff. Même schéma de sécurité que circulaire_lectures/notification_queue
-- (Phase 1) : policy INSERT strictement scopée par parent_students, table à part.

create table public.sorties_anticipees (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  date date not null default current_date,
  heure time not null,
  recupere_par text not null default '',
  motif text not null default '',
  source text not null default 'staff',  -- 'staff' | 'parent'
  created_by uuid references public.profiles(id),   -- rempli si source='staff'
  parent_id uuid references public.parents(id),      -- rempli si source='parent'
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  created_at timestamptz not null default now()
);
alter table public.sorties_anticipees enable row level security;

create policy "Staff can do everything on sorties_anticipees" on public.sorties_anticipees
  for all using (public.is_staff()) with check (public.is_staff());

create policy "Parents can read sorties of their linked children" on public.sorties_anticipees
  for select using (exists (
    select 1 from public.parent_students ps where ps.student_id = sorties_anticipees.student_id and ps.parent_id = auth.uid()
  ));

create policy "Parents can declare sorties for their linked children" on public.sorties_anticipees
  for insert with check (
    source = 'parent' and parent_id = auth.uid() and
    exists (select 1 from public.parent_students ps where ps.student_id = sorties_anticipees.student_id and ps.parent_id = auth.uid())
  );
