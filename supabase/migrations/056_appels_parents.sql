-- Journal des appels téléphoniques passés aux parents suite à une absence, un retard ou un
-- incident disciplinaire du jour. Un seul enregistrement par élève et par jour (on appelle une
-- fois, même si l'élève cumule plusieurs événements le même jour) — la liste "à appeler" elle-même
-- n'est pas stockée : elle est recalculée côté application à partir des événements du jour, moins
-- les élèves déjà présents dans cette table pour aujourd'hui (même principe que la table `appels`
-- pour le pointage de présence : seuls les appels FAITS sont enregistrés).
create table public.appels_parents (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  date date not null,
  marked_by text not null default '',
  marked_at timestamptz not null default now(),
  note text,
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  unique (student_id, date)
);

alter table public.appels_parents enable row level security;

create policy "Staff can do everything on appels_parents" on public.appels_parents
  for all using (public.is_staff()) with check (public.is_staff());
