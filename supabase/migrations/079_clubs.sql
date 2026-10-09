-- Migration 079 : clubs (Phase 37) — catalogue, inscrits, mensualités, règlements, reçus et relances.
-- Tous les montants sont des centimes entiers (aucune virgule flottante pour l'argent).
-- teachers.id et students.id sont du texte ; salles.id, annees_scolaires.id et profiles.id sont des uuid.
-- Les clubs, inscriptions et échéances sont lisibles/modifiables par tout le personnel ; les règlements, imputations
-- et relances (l'argent encaissé) sont réservés aux comptes ayant le droit « clubsPaiements » (rôle Direction par défaut).

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  nom text not null,
  description text not null default '',
  -- enseignant de l'école…
  teacher_id text references public.teachers(id) on delete set null,
  -- …ou intervenant externe
  intervenant_nom text not null default '',
  jour text not null check (jour in ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI')),
  heure_debut time not null,
  heure_fin time not null,
  salle_id uuid references public.salles(id) on delete set null,
  -- null = places illimitées
  places_max integer check (places_max is null or places_max > 0),
  -- vide = ouvert à tous les niveaux
  niveaux text[] not null default '{}',
  mensualite_centimes integer not null default 0 check (mensualite_centimes >= 0),
  -- 1er jour du premier et du dernier mois facturés
  mois_debut date not null,
  mois_fin date not null,
  jour_echeance integer not null default 5 check (jour_echeance between 1 and 28),
  delai_grace_jours integer not null default 5 check (delai_grace_jours >= 0),
  archive boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (heure_fin > heure_debut),
  check (mois_fin >= mois_debut)
);

create table if not exists public.club_inscriptions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  statut text not null default 'actif' check (statut in ('actif', 'attente', 'arrete')),
  date_inscription date not null default current_date,
  date_arret date,
  exonere boolean not null default false,
  motif_exoneration text not null default '',
  derogation_niveau boolean not null default false,
  created_at timestamptz not null default now(),
  -- une ré-inscription réactive la même ligne
  unique (club_id, student_id)
);

create table if not exists public.club_echeances (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references public.club_inscriptions(id) on delete cascade,
  -- 1er jour du mois
  mois date not null,
  -- 0 pour un élève exonéré
  montant_centimes integer not null check (montant_centimes >= 0),
  date_echeance date not null,
  unique (inscription_id, mois)
);

create table if not exists public.club_reglements (
  id uuid primary key default gen_random_uuid(),
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  -- REC-2026-0001 : un compteur par année scolaire, un reçu annulé garde son numéro
  numero text not null,
  -- noms des parents normalisés (calculée par l'application)
  famille_cle text not null,
  -- « Famille X » affichée sur le reçu
  famille_libelle text not null,
  date_reglement date not null default current_date,
  mode text not null check (mode in ('especes', 'cheque', 'virement')),
  -- n° de chèque + banque, ou référence du virement
  reference text not null default '',
  montant_centimes integer not null check (montant_centimes > 0),
  statut text not null default 'valide' check (statut in ('valide', 'annule')),
  motif_annulation text not null default '',
  annule_par uuid references public.profiles(id),
  annule_le timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (annee_scolaire_id, numero)
);

-- Ce qu'un règlement paie : une ligne par mensualité couverte.
create table if not exists public.club_imputations (
  id uuid primary key default gen_random_uuid(),
  reglement_id uuid not null references public.club_reglements(id) on delete cascade,
  echeance_id uuid not null references public.club_echeances(id) on delete cascade,
  montant_centimes integer not null check (montant_centimes > 0)
);

create table if not exists public.club_relances (
  id uuid primary key default gen_random_uuid(),
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  famille_cle text not null,
  famille_libelle text not null,
  montant_du_centimes integer not null,
  langue text not null check (langue in ('fr', 'ar', 'both')),
  envoye_le timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists clubs_annee_idx on public.clubs (annee_scolaire_id);
create index if not exists club_inscriptions_student_idx on public.club_inscriptions (student_id);
create index if not exists club_echeances_inscription_idx on public.club_echeances (inscription_id);
create index if not exists club_reglements_famille_idx on public.club_reglements (annee_scolaire_id, famille_cle);
create index if not exists club_imputations_reglement_idx on public.club_imputations (reglement_id);
create index if not exists club_imputations_echeance_idx on public.club_imputations (echeance_id);
create index if not exists club_relances_famille_idx on public.club_relances (annee_scolaire_id, famille_cle);

-- Droit sur les paiements : entrée explicite permissions->'clubsPaiements', sinon rôle Direction par défaut.
create or replace function public.clubs_paiements_view() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.actif
      and coalesce((p.permissions->'clubsPaiements'->>'view')::boolean, p.role = 'Direction')
  );
$$;

create or replace function public.clubs_paiements_edit() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.actif
      and coalesce((p.permissions->'clubsPaiements'->>'edit')::boolean, p.role = 'Direction')
  );
$$;

alter table public.clubs enable row level security;
alter table public.club_inscriptions enable row level security;
alter table public.club_echeances enable row level security;
alter table public.club_reglements enable row level security;
alter table public.club_imputations enable row level security;
alter table public.club_relances enable row level security;

-- Catalogue, inscriptions et échéances : tout le personnel.
drop policy if exists "Staff can do everything on clubs" on public.clubs;
create policy "Staff can do everything on clubs" on public.clubs
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can do everything on club_inscriptions" on public.club_inscriptions;
create policy "Staff can do everything on club_inscriptions" on public.club_inscriptions
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can do everything on club_echeances" on public.club_echeances;
create policy "Staff can do everything on club_echeances" on public.club_echeances
  for all using (public.is_staff()) with check (public.is_staff());

-- Règlements, imputations et relances : lecture avec le droit d'aperçu, écriture avec le droit d'édition.
drop policy if exists "Clubs paiements can read club_reglements" on public.club_reglements;
create policy "Clubs paiements can read club_reglements" on public.club_reglements
  for select using (public.clubs_paiements_view());
drop policy if exists "Clubs paiements can insert club_reglements" on public.club_reglements;
create policy "Clubs paiements can insert club_reglements" on public.club_reglements
  for insert with check (public.clubs_paiements_edit());
drop policy if exists "Clubs paiements can update club_reglements" on public.club_reglements;
create policy "Clubs paiements can update club_reglements" on public.club_reglements
  for update using (public.clubs_paiements_edit()) with check (public.clubs_paiements_edit());
drop policy if exists "Clubs paiements can delete club_reglements" on public.club_reglements;
create policy "Clubs paiements can delete club_reglements" on public.club_reglements
  for delete using (public.clubs_paiements_edit());

drop policy if exists "Clubs paiements can read club_imputations" on public.club_imputations;
create policy "Clubs paiements can read club_imputations" on public.club_imputations
  for select using (public.clubs_paiements_view());
drop policy if exists "Clubs paiements can insert club_imputations" on public.club_imputations;
create policy "Clubs paiements can insert club_imputations" on public.club_imputations
  for insert with check (public.clubs_paiements_edit());
drop policy if exists "Clubs paiements can update club_imputations" on public.club_imputations;
create policy "Clubs paiements can update club_imputations" on public.club_imputations
  for update using (public.clubs_paiements_edit()) with check (public.clubs_paiements_edit());
drop policy if exists "Clubs paiements can delete club_imputations" on public.club_imputations;
create policy "Clubs paiements can delete club_imputations" on public.club_imputations
  for delete using (public.clubs_paiements_edit());

drop policy if exists "Clubs paiements can read club_relances" on public.club_relances;
create policy "Clubs paiements can read club_relances" on public.club_relances
  for select using (public.clubs_paiements_view());
drop policy if exists "Clubs paiements can insert club_relances" on public.club_relances;
create policy "Clubs paiements can insert club_relances" on public.club_relances
  for insert with check (public.clubs_paiements_edit());
drop policy if exists "Clubs paiements can update club_relances" on public.club_relances;
create policy "Clubs paiements can update club_relances" on public.club_relances
  for update using (public.clubs_paiements_edit()) with check (public.clubs_paiements_edit());
drop policy if exists "Clubs paiements can delete club_relances" on public.club_relances;
create policy "Clubs paiements can delete club_relances" on public.club_relances
  for delete using (public.clubs_paiements_edit());
