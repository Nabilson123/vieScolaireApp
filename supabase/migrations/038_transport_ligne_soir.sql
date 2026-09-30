-- Migration 038 : un élève peut prendre une ligne différente le matin et le soir (ex. déposé par
-- un voisin sur la ligne A le matin, récupéré par un proche accessible via la ligne C le soir).
-- transport_ligne reste la ligne du matin (inchangé) ; transport_ligne_soir est un override
-- optionnel pour le soir — laissé vide, il vaut implicitement "même ligne que le matin" côté appli.
alter table public.student_identities add column transport_ligne_soir text;
