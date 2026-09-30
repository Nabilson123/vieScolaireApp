-- Migration 061: Bon de Commande pour les Améliorations & Activités (helpdesk_demandes)
-- Même flux BC que helpdesk_incidents (prestataire, lignes, TVA, statut, historique) — la colonne
-- bc est ajoutée puis rétro-remplie pour les lignes déjà créées (ex. "Portes ouvertes") avec un
-- vrai numéro de BC, en continuant la séquence déjà utilisée côté pannes pour éviter toute
-- collision de numéro entre les deux tables.

alter table public.helpdesk_demandes add column bc jsonb;

with numbered as (
  select id, row_number() over (order by created_at) as rn
  from public.helpdesk_demandes
  where bc is null
),
max_bc as (
  select coalesce(max((regexp_match(bc->>'numero', 'BC-\d+-(\d+)'))[1]::int), 100) as max_n
  from public.helpdesk_incidents
)
update public.helpdesk_demandes d
set bc = jsonb_build_object(
  'numero', 'BC-' || extract(year from now())::text || '-' || lpad((m.max_n + n.rn)::text, 3, '0'),
  'typeIntervenant', 'Personnel Interne',
  'prestataireNom', 'Personnel Interne',
  'prestataireContact', '',
  'lignes', '[]'::jsonb,
  'transportManutention', 0,
  'modePaiement', 'Non défini',
  'dateIntervention', '',
  'garantieRemarques', '',
  'statut', 'BROUILLON'
)
from numbered n, max_bc m
where d.id = n.id;

alter table public.helpdesk_demandes alter column bc set not null;
