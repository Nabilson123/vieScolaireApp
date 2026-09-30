-- Migration 016: Emplois du temps par classe + historique des modifications
-- Le planning hebdomadaire (jour -> créneaux) reste en jsonb : toujours lu/écrit en bloc par l'UI.
-- Les ids de créneaux (slot-N) sont préservés tels quels car ils sont déjà référencés par
-- teacher_absences.slot_id (migration 011, ex: 'slot-12', 'slot-13').

create table public.class_schedules (
  classe text primary key,
  schedule jsonb not null default '{}'::jsonb
);

create table public.class_schedule_history (
  id text primary key default gen_random_uuid()::text,
  date timestamptz not null default now(),
  classe text not null,
  action text not null check (action in ('Ajout', 'Modification', 'Suppression', 'Déplacement')),
  details text not null
);

insert into public.class_schedules (classe, schedule) values
  ('1APIC-A', '{"LUNDI":[],"MARDI":[{"id":"slot-1","subject":"SVT","teacherId":"t004","start":"08:30","end":"10:30","hours":2}],"MERCREDI":[{"id":"slot-2","subject":"Langue Arabe","teacherId":"t008","start":"10:45","end":"12:45","hours":2}],"JEUDI":[],"VENDREDI":[]}'::jsonb),
  ('2APIC-A', '{"LUNDI":[{"id":"slot-3","subject":"Philosophie","teacherId":"t011","start":"08:30","end":"10:30","hours":2},{"id":"slot-4","subject":"Mathématiques","teacherId":"t001","start":"10:45","end":"12:45","hours":2},{"id":"slot-5","subject":"Français","teacherId":"t002","start":"14:00","end":"16:00","hours":2},{"id":"slot-6","subject":"Anglais","teacherId":"t007","start":"16:15","end":"17:45","hours":1.5}],"MARDI":[{"id":"slot-7","subject":"Physique-Chimie","teacherId":"t003","start":"10:45","end":"12:45","hours":2},{"id":"slot-8","subject":"Histoire-Géographie","teacherId":"t005","start":"14:00","end":"15:30","hours":1.5}],"MERCREDI":[],"JEUDI":[],"VENDREDI":[{"id":"slot-9","subject":"Mathématiques","teacherId":"t001","start":"14:00","end":"16:00","hours":2}]}'::jsonb),
  ('2APIC-B', '{"LUNDI":[],"MARDI":[],"MERCREDI":[],"JEUDI":[{"id":"slot-10","subject":"Français","teacherId":"t002","start":"08:30","end":"10:30","hours":2}],"VENDREDI":[]}'::jsonb),
  ('3APIC-A', '{"LUNDI":[{"id":"slot-11","subject":"Sport","teacherId":"t009","start":"14:00","end":"16:00","hours":2}],"MARDI":[],"MERCREDI":[{"id":"slot-12","subject":"Mathématiques","teacherId":"t001","start":"08:30","end":"10:30","hours":2}],"JEUDI":[{"id":"slot-13","subject":"Anglais","teacherId":"t007","start":"10:45","end":"12:15","hours":1.5},{"id":"slot-14","subject":"Philosophie","teacherId":"t011","start":"14:00","end":"16:00","hours":2},{"id":"slot-15","subject":"Éducation Islamique","teacherId":"t006","start":"16:15","end":"17:15","hours":1}],"VENDREDI":[{"id":"slot-16","subject":"Physique-Chimie","teacherId":"t003","start":"08:30","end":"10:30","hours":2}]}'::jsonb);

alter table public.class_schedules enable row level security;
create policy "Authenticated users can do everything" on public.class_schedules for all using (auth.role() = 'authenticated');

alter table public.class_schedule_history enable row level security;
create policy "Authenticated users can do everything" on public.class_schedule_history for all using (auth.role() = 'authenticated');
