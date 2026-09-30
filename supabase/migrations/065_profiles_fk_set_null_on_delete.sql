-- Suppression définitive d'un compte (Utilisateurs & Rôles → Supprimer définitivement) échouait
-- silencieusement dès que le compte avait la moindre trace ailleurs (ex. une ligne dans
-- audit_log en tant qu'acteur) : auth.admin.deleteUser() cascade sur profiles (on delete cascade,
-- migration 031), mais les tables ci-dessous référencent profiles(id) avec le comportement par
-- défaut de Postgres (NO ACTION) — Postgres refuse alors toute la suppression en bloc plutôt que
-- de casser silencieusement une seule référence. Correctif : ces colonnes sont déjà nullables
-- (aucune n'a de contrainte NOT NULL) et documentées comme telles côté app (ex.
-- notification_queue.created_by : "null = généré par le système" ; JournalAuditGlobal.tsx
-- affiche déjà "Utilisateur supprimé" pour un actor_id qui ne correspond plus à aucun profil) —
-- ON DELETE SET NULL laisse l'historique réel (note de service diffusée, sortie anticipée,
-- réservation de salle, ligne d'audit...) intact, seule l'attribution à l'auteur disparaît.
alter table public.audit_log
  drop constraint audit_log_actor_id_fkey,
  add constraint audit_log_actor_id_fkey foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.circulaires
  drop constraint circulaires_created_by_fkey,
  add constraint circulaires_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.evenements
  drop constraint evenements_created_by_fkey,
  add constraint evenements_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.notes_service
  drop constraint notes_service_created_by_fkey,
  add constraint notes_service_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.notes_service
  drop constraint notes_service_signataire_id_fkey,
  add constraint notes_service_signataire_id_fkey foreign key (signataire_id) references public.profiles(id) on delete set null;

alter table public.notification_queue
  drop constraint notification_queue_created_by_fkey,
  add constraint notification_queue_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.reservations_salles
  drop constraint reservations_salles_reserve_par_fkey,
  add constraint reservations_salles_reserve_par_fkey foreign key (reserve_par) references public.profiles(id) on delete set null;

alter table public.sorties_anticipees
  drop constraint sorties_anticipees_created_by_fkey,
  add constraint sorties_anticipees_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.suivi_profs
  drop constraint suivi_profs_created_by_fkey,
  add constraint suivi_profs_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
