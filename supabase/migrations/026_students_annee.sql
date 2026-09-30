-- Migration 026: Scope students par année scolaire (phase 4)

-- student_identities et student_extras référencent déjà students(id) on delete cascade : les
-- scoper transitivement suffit, aucune colonne supplémentaire n'est nécessaire sur ces deux tables.
alter table public.students add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.students set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.students alter column annee_scolaire_id set not null;
create index students_annee_scolaire_id_idx on public.students (annee_scolaire_id);
