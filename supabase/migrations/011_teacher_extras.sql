-- Migration 011: Absences et remplacements des enseignants (teacherExtras)

drop table if exists public.teacher_absences cascade;
drop table if exists public.teacher_remplacements cascade;

create table public.teacher_absences (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references public.teachers(id) on delete cascade,
  date text not null,
  type text not null check (type in ('ABSENCE', 'RETARD')),
  justified boolean not null default false,
  classe text not null,
  duree numeric not null,
  motif text not null default '',
  slot_id text
);

create table public.teacher_remplacements (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references public.teachers(id) on delete cascade,
  date text not null,
  classe text not null,
  matiere text not null,
  prof_remplace text not null,
  heures numeric not null,
  consignes text
);

insert into public.teacher_absences (teacher_id, date, type, justified, classe, duree, motif, slot_id) values
  ('t001', '2026-05-20', 'ABSENCE', true, '3APIC-A', 2, 'Conférence pédagogique régionale', 'slot-12'),
  ('t002', '2026-05-12', 'RETARD', false, '2APIC-A', 0.5, 'Embouteillage', null),
  ('t003', '2026-05-06', 'ABSENCE', false, '3APIC-A', 2, 'Non signalé', null),
  ('t004', '2026-05-20', 'ABSENCE', true, '1APIC-A', 2, 'Rendez-vous médical', null),
  ('t007', '2026-07-30', 'ABSENCE', true, '3APIC-A', 1.5, 'Grippe', 'slot-13');

insert into public.teacher_remplacements (teacher_id, date, classe, matiere, prof_remplace, heures) values
  ('t003', '2026-05-20', '3APIC-A', 'Mathématiques', 'Youssef Tazi', 2);

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('teacher_absences', 'teacher_remplacements')
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format(
      'create policy "Authenticated users can do everything" on public.%I for all using (auth.role() = ''authenticated'')',
      t.tablename
    );
  end loop;
end $$;
