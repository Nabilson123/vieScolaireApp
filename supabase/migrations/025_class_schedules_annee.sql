-- Migration 025: Scope class_schedules + class_schedule_history par année scolaire (phase 3)

-- class_schedules.classe était la clé primaire à elle seule ; comme classes.nom n'est plus
-- unique globalement depuis la phase 2 (une classe existe une fois par année), "l'emploi du
-- temps de 2APIC-A" est ambigu sans année. La clé primaire devient (annee_scolaire_id, classe).
alter table public.class_schedules drop constraint class_schedules_pkey;
alter table public.class_schedules add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.class_schedules set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.class_schedules alter column annee_scolaire_id set not null;
alter table public.class_schedules add primary key (annee_scolaire_id, classe);

-- class_schedule_history garde son propre id text en clé primaire : recette standard.
alter table public.class_schedule_history add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.class_schedule_history set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.class_schedule_history alter column annee_scolaire_id set not null;
create index class_schedule_history_annee_scolaire_id_idx on public.class_schedule_history (annee_scolaire_id);
