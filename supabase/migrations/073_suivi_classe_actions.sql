-- Migration 073: Actions décidées lors d'un suivi de classe (tâche + responsable + échéance),
-- rattachées à un niveau logique (ex. "CE1" ou "1-3APIC") plutôt qu'à un suivi daté précis —
-- une action reste ouverte d'une semaine à l'autre jusqu'à ce qu'elle soit faite.
create table public.suivi_classe_actions (
  id uuid primary key default gen_random_uuid(),
  niveau text not null,
  texte text not null,
  owner_name text not null default '',
  echeance date,
  done boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.suivi_classe_actions enable row level security;
create policy "Staff can do everything on suivi_classe_actions" on public.suivi_classe_actions
  for all using (public.is_staff()) with check (public.is_staff());
