-- Migration 041 : identité parent (table + trigger de provisioning corrigé)
--
-- handle_new_user() (migration 031) insère aujourd'hui SANS CONDITION toute nouvelle ligne
-- auth.users dans public.profiles — un compte parent créé via le flux d'invitation existant
-- deviendrait donc un compte staff à accès permissif par défaut (permissions absent ⇒ accès
-- complet, cf. getModuleAccess()). Cette migration doit être appliquée et confirmée AVANT tout
-- premier envoi d'invitation avec account_type='parent'.

create table public.parents (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  nom_complet text not null default '',
  telephone text not null default '',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.parents enable row level security;
create policy "Staff can do everything on parents" on public.parents
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
create policy "Parents can read their own row" on public.parents
  for select using (id = auth.uid());

-- create or replace : additif, comportement 'staff' par défaut inchangé tant que manage-user
-- n'envoie pas account_type='parent' dans les métadonnées d'invitation.
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
  else
    insert into public.profiles (id, email) values (new.id, new.email);
  end if;
  return new;
end;
$$;
