-- Lien d'invitation du groupe WhatsApp de l'équipe transport (chat.whatsapp.com/...), utilisé pour
-- prévenir le groupe des sorties/retours anticipés d'élèves affectés à une ligne de transport.

alter table public.services_capacite add column if not exists transport_whatsapp_groupe_url text not null default '';
