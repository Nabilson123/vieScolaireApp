-- Un élève sorti de façon anticipée peut revenir dans la journée (ex. rendez-vous médical
-- terminé plus tôt que prévu) — la sortie elle-même reste un fait réel, pas une erreur à
-- supprimer (cf. useDeleteSortieAnticipee, réservé aux déclarations par erreur). heure_retour
-- nullable : null = pas encore réintégré, renseignée = l'élève a terminé sa journée normalement.
alter table public.sorties_anticipees add column if not exists heure_retour time;
