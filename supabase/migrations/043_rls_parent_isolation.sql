-- Migration 043 : isolation RLS parent — la plus sensible de ce chantier.
--
-- Piège Postgres : les policies RLS se cumulent en OR. La policy actuelle
-- "auth.role() = 'authenticated'" couvre déjà tout le monde ; il faut donc la SUPPRIMER et la
-- REMPLACER par deux policies distinctes (staff / parent), jamais en ajouter une à côté.
--
-- students : la policy SELECT vient de la migration 028 ("Authenticated users can read
-- everything", nom vérifié dans le fichier source) — les policies INSERT/UPDATE/DELETE de cette
-- même migration ne sont pas touchées ici (durcies séparément en 050).
drop policy "Authenticated users can read everything" on public.students;
create policy "Staff can read all students" on public.students
  for select using (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Parents can read their linked children" on public.students
  for select using (exists (
    select 1 from public.parent_students ps where ps.student_id = students.id and ps.parent_id = auth.uid()
  ));

-- student_identities : une seule policy "for all" existait (migration 013), jamais touchée depuis.
drop policy "Authenticated users can do everything" on public.student_identities;
create policy "Staff can do everything on student_identities" on public.student_identities
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Parents can read their linked children identities" on public.student_identities
  for select using (exists (
    select 1 from public.parent_students ps where ps.student_id = student_identities.student_id and ps.parent_id = auth.uid()
  ));

-- student_extras : idem (migration 015).
drop policy "Authenticated users can do everything" on public.student_extras;
create policy "Staff can do everything on student_extras" on public.student_extras
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Parents can read their linked children extras" on public.student_extras
  for select using (exists (
    select 1 from public.parent_students ps where ps.student_id = student_extras.student_id and ps.parent_id = auth.uid()
  ));

-- profiles : aussi en accès total à tout authentifié aujourd'hui (migration 031) — sans ce
-- resserrement, un parent pourrait lire noms/emails/rôles de tout le personnel. Staff-only, aucune
-- policy parent (les parents n'ont jamais besoin de lire les profils du personnel).
drop policy "Authenticated users can do everything" on public.profiles;
create policy "Staff can read all profiles" on public.profiles
  for select using (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Staff can manage profiles" on public.profiles
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
