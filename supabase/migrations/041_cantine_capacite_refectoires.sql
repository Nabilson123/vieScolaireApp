-- L'école a en réalité deux réfectoires physiques distincts : Sous-Sol (maternelle + CE1/CE2) et
-- Terrasse (CE3 à 3APIC) — remplace le champ unique cantine_capacite (laissé en place, non
-- supprimé, comme transport_capacite avant lui) par deux capacités indépendantes.
alter table public.services_capacite add column cantine_capacite_sous_sol integer not null default 200;
alter table public.services_capacite add column cantine_capacite_terrasse integer not null default 200;
