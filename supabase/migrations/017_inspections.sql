-- Migration 017: Inspections & rapports pédagogiques des enseignants
-- Les critères (base/PP/maternelle) et le plan de progrès restent en jsonb : toujours
-- lus/écrits en bloc par l'UI, jamais filtrés/agrégés côté SQL.

create table public.inspections (
  id text primary key,
  teacher_id text not null references public.teachers(id) on delete cascade,
  date text not null,
  inspecteur text not null,
  is_pp boolean not null default false,
  is_maternelle boolean not null default false,
  criteres_base jsonb not null,
  criteres_pp jsonb,
  criteres_maternelle jsonb,
  feedback_parents numeric,
  piece_jointe text,
  note_globale numeric not null,
  rapport text not null default '',
  auto_evaluation text,
  formation_recommandee text,
  commentaire_enseignant text,
  plan_progres jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.inspections (id, teacher_id, date, inspecteur, is_pp, is_maternelle, criteres_base, criteres_pp, note_globale, rapport, plan_progres, created_at) values
  (
    'INSP-2026-001',
    't001',
    '2026-03-10',
    'Direction Pédagogique',
    false,
    false,
    '{"clarte":3,"tenue":4,"innovation":3}'::jsonb,
    null,
    13,
    'Bon suivi initial de la classe, marge de progression sur la diversification des outils pédagogiques.',
    '[]'::jsonb,
    '2026-03-10T09:00:00.000Z'
  ),
  (
    'INSP-2026-002',
    't004',
    '2026-07-25',
    'Direction Pédagogique',
    false,
    false,
    '{"clarte":5,"tenue":4,"innovation":4}'::jsonb,
    null,
    17,
    'Pédagogie innovante et excellente gestion des cours.',
    '[]'::jsonb,
    '2026-07-25T09:00:00.000Z'
  ),
  (
    'INSP-2026-003',
    't001',
    '2026-07-28',
    'Nabil LAHRACHE (Directeur)',
    true,
    false,
    '{"clarte":4,"tenue":5,"innovation":3}'::jsonb,
    '{"suivi":4,"relation":5,"conseil":4}'::jsonb,
    17,
    'Excellent suivi de sa classe de 3APIC-A. Très bonne relation avec les parents.',
    '[{"objectif":"Diversifier les outils numériques en classe","echeance":"2026-10-01","statut":"En cours"}]'::jsonb,
    '2026-07-28T09:00:00.000Z'
  );

alter table public.inspections enable row level security;
create policy "Authenticated users can do everything" on public.inspections for all using (auth.role() = 'authenticated');
