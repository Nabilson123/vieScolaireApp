-- Migration 051 : correctif URGENT — "infinite recursion detected in policy for relation profiles"
-- (Postgres 42P17). Les policies "Staff can ..." créées en 041/042/043/044/045/046/048/049/050
-- référencent toutes "exists (select 1 from public.profiles where id = auth.uid())" — sur la table
-- profiles elle-même, cette condition doit s'évaluer via la policy SELECT de profiles, qui contient
-- cette même sous-requête : boucle infinie détectée par Postgres. Comme absolument toutes les
-- autres policies staff référencent aussi profiles, l'échec se propage à TOUTE table interrogée
-- (students, teachers, etc.) — casse en cascade l'app staff entière, pas seulement les nouvelles
-- fonctionnalités parent.
--
-- Correctif standard Postgres/Supabase : une fonction SECURITY DEFINER contourne la RLS lors de sa
-- propre exécution interne — son résultat ne redéclenche donc jamais la policy qu'elle sert à
-- évaluer.

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- profiles (043)
drop policy "Staff can read all profiles" on public.profiles;
create policy "Staff can read all profiles" on public.profiles for select using (public.is_staff());
drop policy "Staff can manage profiles" on public.profiles;
create policy "Staff can manage profiles" on public.profiles for all using (public.is_staff()) with check (public.is_staff());

-- students (043)
drop policy "Staff can read all students" on public.students;
create policy "Staff can read all students" on public.students for select using (public.is_staff());

-- student_identities (043)
drop policy "Staff can do everything on student_identities" on public.student_identities;
create policy "Staff can do everything on student_identities" on public.student_identities for all using (public.is_staff()) with check (public.is_staff());

-- student_extras (043)
drop policy "Staff can do everything on student_extras" on public.student_extras;
create policy "Staff can do everything on student_extras" on public.student_extras for all using (public.is_staff()) with check (public.is_staff());

-- parents (041)
drop policy "Staff can do everything on parents" on public.parents;
create policy "Staff can do everything on parents" on public.parents for all using (public.is_staff()) with check (public.is_staff());

-- parent_students (042)
drop policy "Staff can do everything on parent_students" on public.parent_students;
create policy "Staff can do everything on parent_students" on public.parent_students for all using (public.is_staff()) with check (public.is_staff());

-- message_templates (044)
drop policy "Staff can do everything on message_templates" on public.message_templates;
create policy "Staff can do everything on message_templates" on public.message_templates for all using (public.is_staff()) with check (public.is_staff());

-- parent_notification_preferences (045)
drop policy "Staff can read all notification preferences" on public.parent_notification_preferences;
create policy "Staff can read all notification preferences" on public.parent_notification_preferences for select using (public.is_staff());

-- notification_queue (046)
drop policy "Staff can do everything on notification_queue" on public.notification_queue;
create policy "Staff can do everything on notification_queue" on public.notification_queue for all using (public.is_staff()) with check (public.is_staff());

-- circulaires (048)
drop policy "Staff can do everything on circulaires" on public.circulaires;
create policy "Staff can do everything on circulaires" on public.circulaires for all using (public.is_staff()) with check (public.is_staff());

-- circulaire_lectures (049)
drop policy "Staff can read all lecture receipts" on public.circulaire_lectures;
create policy "Staff can read all lecture receipts" on public.circulaire_lectures for select using (public.is_staff());

-- 10 tables de la migration 050 (write-hardening) — même correctif sur leurs 3 policies d'écriture.
do $$
declare
  t record;
begin
  for t in
    select unnest(array[
      'classes', 'teachers', 'students',
      'class_schedules', 'class_schedule_history',
      'teacher_absences', 'teacher_remplacements',
      'inspections', 'exam_sessions', 'exam_periods'
    ]) as tablename
  loop
    execute format('drop policy "Insert only into active or future year" on public.%I', t.tablename);
    execute format(
      'create policy "Insert only into active or future year" on public.%I for insert with check (
        public.is_staff()
        and annee_scolaire_id in (
          select id from public.annees_scolaires
          where annee_debut >= (select annee_debut from public.annees_scolaires where active)
        )
      )',
      t.tablename
    );

    execute format('drop policy "Update only within active year" on public.%I', t.tablename);
    execute format(
      'create policy "Update only within active year" on public.%I for update
        using (public.is_staff() and annee_scolaire_id = (select id from public.annees_scolaires where active))
        with check (public.is_staff() and annee_scolaire_id = (select id from public.annees_scolaires where active))',
      t.tablename
    );

    execute format('drop policy "Delete only within active year" on public.%I', t.tablename);
    execute format(
      'create policy "Delete only within active year" on public.%I for delete
        using (public.is_staff() and annee_scolaire_id = (select id from public.annees_scolaires where active))',
      t.tablename
    );
  end loop;
end $$;
