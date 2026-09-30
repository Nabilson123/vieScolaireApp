-- Migration 014: Helpdesk & Maintenance (incidents, bons de commande, prestataires)
-- Le bon de commande (avec ses lignes) et l'historique restent en jsonb : ce sont des
-- sous-objets toujours lus/écrits en bloc par l'UI, pas besoin de les normaliser en tables.

drop table if exists public.helpdesk_incidents cascade;
drop table if exists public.prestataires cascade;

create table public.prestataires (
  id text primary key default gen_random_uuid()::text,
  nom text not null,
  type_intervenant text not null,
  telephone text not null default ''
);

create table public.helpdesk_incidents (
  id text primary key default gen_random_uuid()::text,
  titre text not null,
  categorie text not null,
  lieu text not null,
  priorite text not null check (priorite in ('URGENT', 'NORMALE', 'BASSE')),
  description text not null default '',
  statut text not null check (statut in ('A_TRAITER', 'EN_COURS', 'RESOLU')),
  declarant text not null,
  date_signalement text not null,
  photo text,
  bc jsonb not null,
  historique jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.prestataires (id, nom, type_intervenant, telephone) values
  ('p1', 'STÉ MAROCAINE DE MAINTENANCE SARL', 'Plombier', '05 22 30 40 50'),
  ('p2', 'ÉLEC PRO SERVICES', 'Électricien', '05 22 31 41 51'),
  ('p3', 'INFOTECH SOLUTIONS', 'Technicien IT / Informatique', '06 61 22 33 44'),
  ('p4', 'Personnel Interne', 'Personnel Interne', '—');

insert into public.helpdesk_incidents (id, titre, categorie, lieu, priorite, description, statut, declarant, date_signalement, bc, historique, created_at) values
  (
    'inc-1',
    'Projecteur HS / Lampe grillée',
    'Informatique & Audio-visuel',
    'Salle 12 (3APIC-A)',
    'URGENT',
    'La lampe du vidéoprojecteur s''est éteinte pendant le cours de Mathématiques.',
    'A_TRAITER',
    'Prof. Youssef Tazi',
    '2026-07-29',
    '{"numero":"BC-2026-101","typeIntervenant":"Personnel Interne","prestataireNom":"Personnel Interne","prestataireContact":"","lignes":[],"transportManutention":0,"modePaiement":"Non défini","dateIntervention":"","garantieRemarques":"","statut":"BROUILLON"}'::jsonb,
    '[{"id":"hist-seed-1","date":"2026-07-29T09:00:00.000Z","action":"Incident déclaré","auteur":"Prof. Youssef Tazi"}]'::jsonb,
    '2026-07-29T09:00:00.000Z'
  ),
  (
    'inc-2',
    'Fuite d’eau sous lavabo',
    'Plomberie & Sanitaires',
    'Sanitaires Filles 1er étage',
    'NORMALE',
    'Écoulement d’eau sous le 2ème lavabo.',
    'EN_COURS',
    'Karim Bennani (Surveillant)',
    '2026-07-28',
    '{"numero":"BC-2026-102","typeIntervenant":"Plombier","prestataireId":"p1","prestataireNom":"STÉ MAROCAINE DE MAINTENANCE SARL","prestataireContact":"05 22 30 40 50","lignes":[{"id":"ligne-1","categorie":"Matériel","designation":"Fuite d’eau sous lavabo","quantite":1,"unite":"U","puHT":120,"regimeTVA":"TVA 20%"},{"id":"ligne-2","categorie":"Main d''œuvre","designation":"Main d''œuvre & intervention technicien","quantite":1,"unite":"Forfait","puHT":100,"regimeTVA":"HT (0%)"}],"transportManutention":0,"modePaiement":"Non défini","dateIntervention":"2026-08-04","garantieRemarques":"Garantie 6 mois pièces & main d’œuvre","statut":"BROUILLON"}'::jsonb,
    '[{"id":"hist-seed-2b","date":"2026-07-28T10:00:00.000Z","action":"Bon de commande créé (BC-2026-102)","auteur":"Karim Bennani (Surveillant)"},{"id":"hist-seed-2a","date":"2026-07-28T09:00:00.000Z","action":"Incident déclaré","auteur":"Karim Bennani (Surveillant)"}]'::jsonb,
    '2026-07-28T09:00:00.000Z'
  ),
  (
    'inc-3',
    'Prise électrique défectueuse',
    'Électricité & Éclairage',
    'Salle Informatique 2',
    'URGENT',
    'Prise murale desserrée à vérifier en urgence.',
    'A_TRAITER',
    'Service Technique',
    '2026-07-30',
    '{"numero":"BC-2026-103","typeIntervenant":"Personnel Interne","prestataireNom":"Personnel Interne","prestataireContact":"","lignes":[],"transportManutention":0,"modePaiement":"Non défini","dateIntervention":"","garantieRemarques":"","statut":"BROUILLON"}'::jsonb,
    '[{"id":"hist-seed-3","date":"2026-07-30T09:00:00.000Z","action":"Incident déclaré","auteur":"Service Technique"}]'::jsonb,
    '2026-07-30T09:00:00.000Z'
  ),
  (
    'inc-4',
    'Climatisation réparée',
    'Mobilier & Infrastructures',
    'Salle des Professeurs',
    'BASSE',
    'Filtre nettoyé et télécommande remplacée.',
    'RESOLU',
    'Service Technique',
    '2026-07-27',
    '{"numero":"BC-2026-104","typeIntervenant":"Climatisation","prestataireNom":"Personnel Interne","prestataireContact":"","lignes":[{"id":"ligne-3","categorie":"Matériel","designation":"Télécommande climatisation","quantite":1,"unite":"U","puHT":80,"regimeTVA":"TVA 20%"}],"transportManutention":0,"modePaiement":"Non défini","dateIntervention":"2026-07-27","garantieRemarques":"","statut":"VALIDE"}'::jsonb,
    '[{"id":"hist-seed-4c","date":"2026-07-27T15:00:00.000Z","action":"Bon de commande validé par Direction","auteur":"Direction"},{"id":"hist-seed-4b","date":"2026-07-27T11:00:00.000Z","action":"Incident marqué résolu","auteur":"Service Technique"},{"id":"hist-seed-4a","date":"2026-07-27T09:00:00.000Z","action":"Incident déclaré","auteur":"Service Technique"}]'::jsonb,
    '2026-07-27T09:00:00.000Z'
  );

alter table public.prestataires enable row level security;
create policy "Authenticated users can do everything" on public.prestataires for all using (auth.role() = 'authenticated');

alter table public.helpdesk_incidents enable row level security;
create policy "Authenticated users can do everything" on public.helpdesk_incidents for all using (auth.role() = 'authenticated');
