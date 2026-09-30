-- Ajoute la colonne type manquante et seed les 3 périodes par défaut
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run

alter table periodes add column if not exists type text not null default 'Trimestre';

insert into periodes (type, nom, date_debut, date_fin)
values
  ('Trimestre', 'Trimestre 1', '2026-09-07', '2026-12-18'),
  ('Trimestre', 'Trimestre 2', '2027-01-05', '2027-03-26'),
  ('Trimestre', 'Trimestre 3', '2027-04-06', '2027-06-25');
