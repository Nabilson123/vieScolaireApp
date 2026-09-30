-- Migration 052 : email des parents sur la fiche identité élève (import Excel + saisie manuelle)
--
-- Nécessaire pour créer automatiquement les comptes parent à l'import Excel : sans email,
-- Supabase ne peut pas envoyer d'invitation ni créer de compte de connexion. Ces deux colonnes
-- sont un champ de saisie/staging (comme parent1_nom/parent1_tel déjà présents) — la source de
-- vérité pour "ce parent a un compte actif lié à cet élève" reste parents + parent_students,
-- pas ces colonnes.

alter table public.student_identities
  add column if not exists parent1_email text not null default '',
  add column if not exists parent2_email text not null default '';

-- Garde-fou : empêche deux comptes parent avec le même email (l'import comme la modale
-- d'invitation vérifient déjà l'existence avant d'inviter, ceci est une deuxième ligne de
-- défense au niveau base). Sûr à ajouter maintenant : le trigger handle_new_user() renseigne
-- toujours un email réel, jamais vide.
alter table public.parents
  add constraint parents_email_unique unique (email);
