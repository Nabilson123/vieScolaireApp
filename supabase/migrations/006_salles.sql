-- Ajoute la colonne batiment manquante et seed les salles actuellement utilisées par les classes
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run

alter table salles add column if not exists batiment text not null default '';

insert into salles (batiment, nom, capacite)
values
  ('Bâtiment Collège', 'Salle 1', 32),
  ('Bâtiment Collège', 'Salle 2', 32),
  ('Bâtiment Collège', 'Salle 3', 32),
  ('Bâtiment Collège', 'Salle 4', 32),
  ('Bâtiment Primaire', 'Salle 1', 30),
  ('Bâtiment Primaire', 'Salle 2', 30),
  ('Bâtiment Primaire', 'Salle 3', 30),
  ('Bâtiment Primaire', 'Salle 4', 30),
  ('Bâtiment Primaire', 'Salle 5', 30),
  ('Bâtiment Primaire', 'Salle 6', 30),
  ('Bâtiment Primaire', 'Salle 7', 30),
  ('Bâtiment Primaire', 'Salle 8', 30),
  ('Bâtiment Primaire', 'Salle 9', 30),
  ('Bâtiment Primaire', 'Salle 10', 30),
  ('Bâtiment Primaire', 'Salle 11', 30),
  ('Bâtiment Primaire', 'Salle 12', 30),
  ('Pavillon Maternelle', 'Salle 1', 24),
  ('Pavillon Maternelle', 'Salle 2', 24),
  ('Pavillon Maternelle', 'Salle 3', 24),
  ('Pavillon Maternelle', 'Salle 4', 24),
  ('Pavillon Maternelle', 'Salle 5', 24);
