-- Migration 031 : identité par utilisateur (table profiles + trigger de création automatique)
--
-- `role` reste un simple champ texte avec une valeur par défaut ici (pas de `check` avant la
-- Phase 3) : ça évite une migration de renommage/relâchement plus tard, et correspond au
-- comportement voulu dès le départ — tant qu'un profil n'a pas été explicitement classé, il
-- affiche "Autre" (cohérent avec le screenshot de référence où le libellé par défaut est "Autre").
--
-- Premier trigger Postgres et première fonction `security definer` de ce projet : nécessaire car
-- `auth.users` est dans le schéma `auth`, hors de portée normale du rôle `authenticated`, et parce
-- qu'il n'existe aucun autre mécanisme pour réagir à la création d'un compte Supabase Auth.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  nom_complet text not null default '',
  role text not null default 'Autre',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill : le trigger ne s'applique qu'aux futures insertions dans auth.users. Le(s) compte(s)
-- déjà existant(s) n'ont pas encore de ligne profiles. On ne devine PAS de vrai nom ici (on ne l'a
-- pas vérifié) — nom_complet part de l'email, modifiable ensuite par la personne elle-même dans
-- Paramètres dès que cette migration est appliquée.
insert into public.profiles (id, email, nom_complet, role)
select id, coalesce(email, ''), coalesce(email, ''), 'Autre'
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
create policy "Authenticated users can do everything" on public.profiles for all using (auth.role() = 'authenticated');
