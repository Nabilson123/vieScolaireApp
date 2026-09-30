-- Migration 040 : créneaux fixes de la journée (récréation, cantine, étude...) affichés sur la
-- timeline du Cockpit Opérationnel. Liste libre de longueur variable → jsonb sur le singleton
-- services_capacite plutôt qu'une table dédiée (même raisonnement que les horaires transport, qui
-- vivent déjà sur cette même ligne).
alter table public.services_capacite add column creneaux_fixes jsonb not null default '[]'::jsonb;
