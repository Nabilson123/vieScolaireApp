-- Migration 050 : durcissement écriture — les policies INSERT/UPDATE/DELETE créées par la
-- migration 028 sur les 10 tables année-scopées ne vérifient que l'année, jamais le rôle. Une
-- session parent authentifiée les satisferait techniquement dès qu'un compte existe (migration
-- 041). Ajoute la vérification "exists (select 1 from profiles where id = auth.uid())" en plus de
-- la condition d'année déjà en place, même style de boucle dynamique que la migration 028.

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
        exists (select 1 from public.profiles where id = auth.uid())
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
        using (
          exists (select 1 from public.profiles where id = auth.uid())
          and annee_scolaire_id = (select id from public.annees_scolaires where active)
        )
        with check (
          exists (select 1 from public.profiles where id = auth.uid())
          and annee_scolaire_id = (select id from public.annees_scolaires where active)
        )',
      t.tablename
    );

    execute format('drop policy "Delete only within active year" on public.%I', t.tablename);
    execute format(
      'create policy "Delete only within active year" on public.%I for delete
        using (
          exists (select 1 from public.profiles where id = auth.uid())
          and annee_scolaire_id = (select id from public.annees_scolaires where active)
        )',
      t.tablename
    );
  end loop;
end $$;
