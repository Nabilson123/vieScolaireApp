-- Ajoute la colonne seuil_heures manquante et seed la ligne par défaut
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run

alter table absences_config add column if not exists seuil_heures numeric not null default 10;

insert into absences_config (motifs, seuil_heures)
values (
  array['Maladie', 'Rendez-vous médical', 'Raison familiale', 'Convocation administrative', 'Non justifié', 'Autre'],
  10
);
