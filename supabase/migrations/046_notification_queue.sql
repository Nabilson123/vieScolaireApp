-- Migration 046 : file d'attente des notifications, avec statut/relance. Le futur pipeline d'envoi
-- (Edge Function, non implémentée dans ce chantier) tourne en service-role et consomme cette table
-- directement — aucune policy parent : les parents ne lisent jamais la file côté client.

create type public.notification_status as enum ('pending', 'sent', 'failed', 'cancelled');

create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id text references public.students(id) on delete set null,
  template_code text not null references public.message_templates(code),
  canal text not null default 'email',
  destinataire text not null,
  rendered_subject text not null default '',
  rendered_body text not null default '',
  status public.notification_status not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notification_queue_status_next_attempt_idx on public.notification_queue (status, next_attempt_at);

alter table public.notification_queue enable row level security;
create policy "Staff can do everything on notification_queue" on public.notification_queue
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
