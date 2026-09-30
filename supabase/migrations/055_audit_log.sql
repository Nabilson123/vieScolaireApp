-- Migration 055 : journal d'audit (Phase 3)
--
-- Appels applicatifs explicites (logAudit()), pas de trigger Postgres : cohérent avec le reste du
-- schéma, où aucun trigger AFTER INSERT/UPDATE/DELETE n'existe (seuls handle_new_user() et
-- is_staff(), ni l'un ni l'autre n'est un trigger de log). Scope staff-only : les écritures parent
-- (sortie anticipée, lecture de circulaire) sont déjà auto-tracées par leurs propres colonnes
-- source/parent_id sur leurs tables dédiées.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text not null,
  action text not null,              -- 'insert' | 'update' | 'delete'
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;

create policy "Staff can read all audit logs" on public.audit_log
  for select using (public.is_staff());
create policy "Staff can insert audit logs" on public.audit_log
  for insert with check (public.is_staff());
