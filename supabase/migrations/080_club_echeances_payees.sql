-- Migration 080 : mensualités de clubs déjà payées (Phase 37, lot 2).
-- Les règlements sont réservés aux comptes ayant le droit « clubsPaiements » (RLS de la migration 079). Or tout le
-- personnel peut arrêter un élève ou changer un tarif, ce qui supprime ou recalcule des mensualités : il faut savoir
-- lesquelles ont déjà reçu un paiement pour ne jamais les toucher. Cette fonction renvoie seulement les identifiants
-- des mensualités payées (jamais le montant, le règlement ni la famille).

create or replace function public.club_echeances_payees(p_echeance_ids uuid[])
returns setof uuid
language sql security definer set search_path = public stable as $$
  select distinct i.echeance_id
  from public.club_imputations i
  join public.club_reglements r on r.id = i.reglement_id
  where r.statut = 'valide'
    and i.echeance_id = any (p_echeance_ids)
    and public.is_staff();
$$;

revoke all on function public.club_echeances_payees(uuid[]) from public;
grant execute on function public.club_echeances_payees(uuid[]) to authenticated;
