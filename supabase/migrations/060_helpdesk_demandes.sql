-- Migration 060: Améliorations & Activités nécessitant préparation (Helpdesk)
-- Flux distinct des pannes (helpdesk_incidents) : pas de bon de commande, statut à 3 états adapté
-- à une échéance de préparation plutôt qu'à une résolution technique.

create table public.helpdesk_demandes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('AMELIORATION', 'ACTIVITE_PREPARATION')),
  titre text not null,
  lieu text not null default '',
  description text not null default '',
  priorite text not null default 'NORMALE' check (priorite in ('URGENT', 'NORMALE', 'BASSE')),
  date_cible date not null,
  heure_cible time,
  statut text not null default 'A_PREPARER' check (statut in ('A_PREPARER', 'EN_PREPARATION', 'PRET')),
  declarant text not null default '',
  date_signalement date not null default current_date,
  historique jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.helpdesk_demandes enable row level security;
create policy "Staff can do everything on helpdesk_demandes" on public.helpdesk_demandes
  for all using (public.is_staff()) with check (public.is_staff());
