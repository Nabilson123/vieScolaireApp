-- Rend modifiables les bornes Matin/Après-midi utilisées par le Bilan Journalier d'Assiduité
-- (écran + rapport imprimé), aujourd'hui codées en dur à plusieurs endroits.

alter table public.absences_config
  add column if not exists heure_debut_matin time not null default '08:30',
  add column if not exists heure_fin_matin time not null default '12:00',
  add column if not exists heure_debut_apres_midi time not null default '13:00',
  add column if not exists heure_fin_apres_midi time not null default '17:00';
