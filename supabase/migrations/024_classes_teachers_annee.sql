-- Migration 024: Scope classes + teachers par année scolaire (phase 2)

-- Correction : la ligne bootstrap de la migration 023 avait été seedée comme "2026/2027",
-- mais les données actuellement en base (classes, profs, emplois du temps...) sont bien
-- celles de l'année scolaire 2025/2026. On corrige l'identité de cette même ligne (aucune
-- autre table ne la référence encore à ce stade) plutôt que d'en créer une nouvelle.
update public.annees_scolaires
set annee_debut = 2025, libelle = '2025/2026', date_debut = '2025-09-01', date_fin = '2026-08-31'
where annee_debut = 2026;

-- classes : la contrainte d'unicité globale sur "nom" doit devenir "par année", sinon
-- dupliquer une classe dans une nouvelle année échouera dès qu'un même nom existe déjà.
alter table public.classes drop constraint classes_nom_key;

alter table public.classes add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.classes set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.classes alter column annee_scolaire_id set not null;
create index classes_annee_scolaire_id_idx on public.classes (annee_scolaire_id);
alter table public.classes add constraint classes_annee_nom_unique unique (annee_scolaire_id, nom);

alter table public.teachers add column annee_scolaire_id uuid references public.annees_scolaires(id) on delete restrict;
update public.teachers set annee_scolaire_id = (select id from public.annees_scolaires where annee_debut = 2025);
alter table public.teachers alter column annee_scolaire_id set not null;
create index teachers_annee_scolaire_id_idx on public.teachers (annee_scolaire_id);
