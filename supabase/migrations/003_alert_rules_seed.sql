-- Seed les 4 lignes par défaut de alert_rules (une par cycle)
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run

insert into alert_rules (cycle, seuil_moyenne_pedagogique, seuil_points_climat_scolaire, seuil_taux_presence, seuil_retards_cumules_min, seuil_alertes_pai, seuil_incidents_helpdesk, seuil_taux_remplacement)
values
  ('maternelle', 12, 15, 90, 60, 3, 3, 70),
  ('primaire', 12, 15, 90, 60, 3, 3, 70),
  ('college', 12, 15, 90, 60, 3, 3, 70),
  ('lycee', 12, 15, 90, 60, 3, 3, 70);
