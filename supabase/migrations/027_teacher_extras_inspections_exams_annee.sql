-- Migration 027: Scope teacher_absences, teacher_remplacements, inspections, exam_sessions,
-- exam_periods par année scolaire (phase 5)

alter table public.teacher_absences add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.teacher_absences set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.teacher_absences alter column annee_scolaire_id set not null;
create index teacher_absences_annee_scolaire_id_idx on public.teacher_absences (annee_scolaire_id);

alter table public.teacher_remplacements add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.teacher_remplacements set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.teacher_remplacements alter column annee_scolaire_id set not null;
create index teacher_remplacements_annee_scolaire_id_idx on public.teacher_remplacements (annee_scolaire_id);

alter table public.inspections add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.inspections set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.inspections alter column annee_scolaire_id set not null;
create index inspections_annee_scolaire_id_idx on public.inspections (annee_scolaire_id);

alter table public.exam_sessions add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.exam_sessions set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.exam_sessions alter column annee_scolaire_id set not null;
create index exam_sessions_annee_scolaire_id_idx on public.exam_sessions (annee_scolaire_id);

alter table public.exam_periods add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.exam_periods set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.exam_periods alter column annee_scolaire_id set not null;
create index exam_periods_annee_scolaire_id_idx on public.exam_periods (annee_scolaire_id);
