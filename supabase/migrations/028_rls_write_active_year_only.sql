-- Migration 028: Phase 7 — RLS au niveau écriture, restreint à l'année active

-- Jusqu'ici chaque table année-scopée n'avait qu'une policy "for all" générique
-- (auth.role() = 'authenticated') : le verrouillage lecture-seule (Phase 6) n'existait qu'au
-- niveau UI. Cette migration ajoute un filet de sécurité côté base : un client techniquement
-- capable de contourner l'UI ne peut plus insérer/modifier/supprimer dans une année qui n'est
-- pas l'année active.
--
-- Cas particulier du INSERT : createNextYear() (Phase 2) duplique classes et enseignants dans
-- une nouvelle année pas encore activée (active = false). Le check INSERT autorise donc l'année
-- active OU toute année plus récente (annee_debut >=), jamais une année plus ancienne — ça laisse
-- passer la duplication légitime vers une nouvelle année tout en bloquant l'écriture dans une
-- année révolue.
--
-- La lecture (select) reste ouverte à tous les authentifiés : les années passées doivent rester
-- consultables. UPDATE/DELETE restent strictement limités à l'année active (aucun cas légitime
-- de modification/suppression hors année active, contrairement à l'INSERT).
--
-- Tables concernées : les 10 tables année-scopées des phases 2 à 5. student_identities et
-- student_extras ne sont volontairement pas couvertes ici (pas de colonne annee_scolaire_id
-- propre, seulement une FK vers students) — resteraient un filet à ajouter séparément si besoin.

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
    execute format('drop policy if exists "Authenticated users can do everything" on public.%I', t.tablename);

    execute format(
      'create policy "Authenticated users can read everything" on public.%I for select using (auth.role() = ''authenticated'')',
      t.tablename
    );

    execute format(
      'create policy "Insert only into active or future year" on public.%I for insert with check (
        annee_scolaire_id in (
          select id from public.annees_scolaires
          where annee_debut >= (select annee_debut from public.annees_scolaires where active)
        )
      )',
      t.tablename
    );

    execute format(
      'create policy "Update only within active year" on public.%I for update
        using (annee_scolaire_id = (select id from public.annees_scolaires where active))
        with check (annee_scolaire_id = (select id from public.annees_scolaires where active))',
      t.tablename
    );

    execute format(
      'create policy "Delete only within active year" on public.%I for delete
        using (annee_scolaire_id = (select id from public.annees_scolaires where active))',
      t.tablename
    );
  end loop;
end $$;
