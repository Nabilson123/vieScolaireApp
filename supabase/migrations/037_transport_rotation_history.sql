-- Migration 037 : historique des rotations hebdomadaires du trajet collège — chaque modification
-- de "quelles lignes font le collège" enregistre un instantané, pour équilibrer la charge entre
-- lignes sur l'année et pouvoir répondre à une contestation.
create table public.transport_rotation_history (
  id uuid primary key default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  lignes_college text[] not null
);

alter table public.transport_rotation_history enable row level security;
create policy "Authenticated users can do everything" on public.transport_rotation_history for all using (auth.role() = 'authenticated');
