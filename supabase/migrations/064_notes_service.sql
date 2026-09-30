-- Migration 064: Notes de Service (module Communication)
-- Instructions écrites datées, numérotées et tracées (familles ou personnel), distinctes des
-- Circulaires par leur circuit de validation par type et leur caractère potentiellement nominatif.

alter table public.profiles add column if not exists signature_image text;

create table public.notes_service (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  type text not null check (type in ('INFORMATION','RAPPEL','AVERTISSEMENT','CONVOCATION','ATTESTATION')),
  audience text not null check (audience in ('PARENTS','ENSEIGNANTS','ADMINISTRATIF','TOUS')),
  cible_type text not null default 'etablissement' check (cible_type in ('etablissement','niveau','classe','eleves','personnes')),
  cible_niveau text,
  cible_classe text,
  cible_eleve_ids text[],
  cible_personne_ids text[],
  objet text not null default '',
  corps text not null default '',
  coupon_actif boolean not null default false,
  coupon_type text check (coupon_type in ('autorisation','accuse_lecture','libre')),
  coupon_date_limite date,
  signataire_id uuid references public.profiles(id),
  statut text not null default 'BROUILLON' check (statut in ('BROUILLON','EN_ATTENTE_VALIDATION','VALIDEE','DIFFUSEE','ANNULEE')),
  date_diffusion timestamptz,
  rectificatif_de_id uuid references public.notes_service(id),
  historique jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  annee_scolaire_id uuid not null references public.annees_scolaires(id),
  created_at timestamptz not null default now()
);

alter table public.notes_service enable row level security;
create policy "Staff can do everything on notes_service" on public.notes_service
  for all using (public.is_staff()) with check (public.is_staff());
