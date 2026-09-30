-- Migration 045 : préférences de notification par parent (canal, plages "ne pas déranger",
-- types d'événements souhaités). Pas de colonne fuseau horaire — école unique, fuseau codé en dur
-- côté pipeline d'envoi plutôt qu'exposé comme réglage.

create table public.parent_notification_preferences (
  parent_id uuid primary key references public.parents(id) on delete cascade,
  canal_email boolean not null default true,
  canal_sms boolean not null default false,
  canal_push boolean not null default false,
  types_souhaites text[] not null default array['absence','retard','incident_disciplinaire','circulaire']::text[],
  ne_pas_deranger_debut time,
  ne_pas_deranger_fin time,
  updated_at timestamptz not null default now()
);

alter table public.parent_notification_preferences enable row level security;
create policy "Staff can read all notification preferences" on public.parent_notification_preferences
  for select using (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Parents can manage their own preferences" on public.parent_notification_preferences
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- Ligne de préférences par défaut créée automatiquement à chaque provisioning d'un compte parent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  account_type text := coalesce(new.raw_user_meta_data->>'account_type', 'staff');
begin
  if account_type = 'parent' then
    insert into public.parents (id, email) values (new.id, new.email);
    insert into public.parent_notification_preferences (parent_id) values (new.id);
  else
    insert into public.profiles (id, email) values (new.id, new.email);
  end if;
  return new;
end;
$$;
