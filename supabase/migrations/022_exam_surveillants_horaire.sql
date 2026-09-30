-- Migration 022: Surveillance à horaire ajustable par prof
-- Un surveillant peut désormais couvrir une plage horaire différente de la durée complète de l'examen
-- (ex: 30min au lieu d'une heure) pour permettre de partager la surveillance entre plusieurs profs sur
-- un même examen. Remplace le tableau plat d'ids (surveillant_ids: string[]) par un tableau d'objets
-- (surveillants: {teacherId, start, end}[]) — les surveillants existants sont migrés avec la durée
-- complète de leur examen comme horaire par défaut (comportement inchangé pour les données existantes).

alter table public.exam_sessions rename column surveillant_ids to surveillants;

update public.exam_sessions
set surveillants = (
  select coalesce(
    jsonb_agg(jsonb_build_object('teacherId', elem, 'start', start_time, 'end', end_time)),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(coalesce(surveillants, '[]'::jsonb)) as elem
)
where surveillants is not null and jsonb_typeof(surveillants) = 'array';

alter table public.exam_sessions alter column surveillants set default '[]'::jsonb;
