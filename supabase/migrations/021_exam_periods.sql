-- Migration 021: Sessions d'examens (regroupement d'épreuves sur une même période)
-- Une "session" (ex: session normale de juin, rattrapage...) regroupe plusieurs examens
-- (exam_sessions) créés sur une même période — typiquement CE6 + 3APIC en même temps.
-- Les surveillants ne sont plus assignés à la volée pendant la saisie : on saisit tous les
-- examens de la session d'abord, puis on dispatche les surveillants à la fin, créneau par créneau.

create table public.exam_periods (
  id text primary key default gen_random_uuid()::text,
  label text not null,
  created_at timestamptz not null default now()
);

alter table public.exam_periods enable row level security;
create policy "Authenticated users can do everything" on public.exam_periods for all using (auth.role() = 'authenticated');

alter table public.exam_sessions add column if not exists period_id text references public.exam_periods(id) on delete set null;
