-- Migration 036 : horodatage de la dernière modification de la rotation hebdomadaire du trajet
-- collège (quelles lignes font le collège cette semaine), pour repérer si elle a été oubliée.
alter table public.services_capacite add column transport_rotation_updated_at timestamptz;
