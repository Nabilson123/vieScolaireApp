-- Phase 37 (suite) — Clubs : frais d'inscription.
-- Chaque club peut avoir des frais d'inscription (montant unique, dus à la date d'inscription). Ils sont facturés comme une
-- mensualité de plus (même circuit : règlements, imputation, reçus, recouvrement) : une échéance de type « inscription ».

alter table public.clubs add column if not exists frais_inscription_centimes integer not null default 0 check (frais_inscription_centimes >= 0);

-- Les échéances existantes sont toutes des mensualités.
alter table public.club_echeances add column if not exists type text not null default 'mensualite' check (type in ('mensualite', 'inscription'));

-- Les frais d'inscription tombent dans le mois d'inscription, comme la première mensualité : l'unicité (inscription, mois)
-- devient (inscription, mois, type). On retire l'ancienne contrainte quel que soit son nom.
do $$
declare
  nom_contrainte text;
begin
  for nom_contrainte in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.club_echeances'::regclass
      and con.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from pg_attribute a
        where a.attrelid = con.conrelid and a.attnum = any (con.conkey)
      ) = array['inscription_id', 'mois']
  loop
    execute format('alter table public.club_echeances drop constraint %I', nom_contrainte);
  end loop;
end $$;

alter table public.club_echeances add constraint club_echeances_inscription_mois_type_key unique (inscription_id, mois, type);
