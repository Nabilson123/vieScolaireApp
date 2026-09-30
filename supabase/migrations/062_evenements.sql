-- Migration 062: Événements libres (Rendez-vous Parents)
-- Événements institutionnels non rattachés à un élève (ex. jour des élections de délégués de
-- classe) — table dédiée car RendezVousRecord vit dans student_extras.rendez_vous (JSONB par
-- élève), sans propriétaire naturel pour un événement concernant toute l'école ou plusieurs classes.

create table public.evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  date date not null,
  heure time,
  description text not null default '',
  classes text[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.evenements enable row level security;
create policy "Staff can do everything on evenements" on public.evenements
  for all using (public.is_staff()) with check (public.is_staff());
