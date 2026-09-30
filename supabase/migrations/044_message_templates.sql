-- Migration 044 : modèles de messages éditables (notifications parents), avec variables
-- {{eleve}}, {{classe}}, {{date}}, {{motif}} résolues au moment de l'enfilement en file d'attente.

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  libelle text not null default '',
  canal text not null default 'email',
  sujet text not null default '',
  corps text not null default '',
  actif boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.message_templates (code, libelle, canal, sujet, corps) values
  ('absence', 'Absence constatée', 'email', 'Absence de {{eleve}}', '{{eleve}} ({{classe}}) a été signalé(e) absent(e) le {{date}}. Motif : {{motif}}.'),
  ('retard', 'Retard constaté', 'email', 'Retard de {{eleve}}', '{{eleve}} ({{classe}}) a été signalé(e) en retard le {{date}}. Motif : {{motif}}.'),
  ('incident_disciplinaire', 'Incident disciplinaire', 'email', 'Incident concernant {{eleve}}', 'Un incident disciplinaire a été enregistré pour {{eleve}} ({{classe}}) le {{date}}. Motif : {{motif}}.'),
  ('circulaire', 'Nouvelle circulaire', 'email', 'Nouvelle circulaire', 'Une nouvelle circulaire a été publiée : {{motif}}.'),
  ('circulaire_relance', 'Relance circulaire non lue', 'email', 'Rappel : circulaire non lue', 'Une circulaire publiée le {{date}} n''a pas encore été consultée : {{motif}}.');

alter table public.message_templates enable row level security;
create policy "Staff can do everything on message_templates" on public.message_templates
  for all using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
