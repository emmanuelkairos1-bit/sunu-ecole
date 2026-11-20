-- SUNU ÉCOLE - schéma complet. À coller dans Supabase > SQL Editor > Run.
create extension if not exists pgcrypto;

create table if not exists ecoles (
  id uuid primary key default gen_random_uuid(),
  nom_ecole text not null,
  type_etablissement text not null default 'Collège' check (type_etablissement in ('Primaire','Collège','Lycée','Université','Autre')),
  ville text, pays text, annee_scolaire text, email_ecole text, logo_ecole text,
  code_parrainage_unique text unique not null,
  seuil_retard int not null default 3,
  seuil_absence int not null default 3,
  seuil_renvoi int not null default 1,
  onboarding_fait boolean not null default false,
  cree_par_id uuid,
  date_creation timestamptz not null default now()
);

create table if not exists utilisateurs (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ecoles(id) on delete cascade,
  nom text not null,
  email_enc text not null,              -- AES-256-GCM
  email_hash text unique not null,      -- HMAC-SHA256 pour la recherche
  password_hash varchar(255) not null,  -- Argon2id
  role text not null check (role in ('Surveillant Général','Surveillant')),
  permissions jsonb not null default '{"journal":true,"eleves":true,"synthese":true,"fiches":true,"utilisateurs":false}',
  actif boolean not null default true,
  invite_par_id uuid,
  invite_par_nom text,
  password_changed_at timestamptz not null default now(),
  date_arrivee timestamptz not null default now()
);
create index if not exists idx_users_ecole on utilisateurs(ecole_id);

create table if not exists password_history (
  id bigserial primary key,
  user_id uuid not null references utilisateurs(id) on delete cascade,
  password_hash varchar(255) not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,      -- SHA-256 du jeton du cookie
  user_id uuid not null references utilisateurs(id) on delete cascade,
  ip text, user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists password_resets (
  id bigserial primary key,
  user_id uuid not null references utilisateurs(id) on delete cascade,
  token_hash text unique not null,      -- SHA-256 du jeton envoyé par email
  expires_at timestamptz not null,
  used boolean not null default false
);

create table if not exists login_attempts (
  id bigserial primary key,
  cle text unique not null,             -- 'e:<email_hash>' ou 'i:<ip>'
  email text,                           -- hash de l'email (jamais en clair)
  ip_adresse text, user_agent text,
  tentatives_echouees int not null default 0,
  derniere_tentative_at timestamptz,
  bloque_jusqua_at timestamptz,
  statut text not null default 'ok' check (statut in ('ok','bloque'))
);

create table if not exists eleves (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ecoles(id) on delete cascade,
  prenom text not null, nom text not null, classe text not null,
  photo_path text,
  telephone_parent_enc text, email_parent_enc text,
  date_creation timestamptz not null default now()
);
create index if not exists idx_eleves_ecole on eleves(ecole_id, classe);
create unique index if not exists uq_eleves_identite on eleves(ecole_id, lower(nom), lower(prenom), lower(classe));

create table if not exists journal (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ecoles(id) on delete cascade,
  eleve_id uuid not null references eleves(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('Retard','Absence','Renvoi')),
  heure text, justifie text not null default 'Non' check (justifie in ('Oui','Non')),
  motif text, decision text,
  parents_informes text not null default 'Non' check (parents_informes in ('Oui','Non')),
  photo_justificatif_url text,          -- chemin dans le bucket privé
  saisi_par_id uuid references utilisateurs(id) on delete set null,
  saisi_par_nom text,
  date_creation timestamptz not null default now()
);
create index if not exists idx_journal_ecole on journal(ecole_id, date desc);
create index if not exists idx_journal_eleve on journal(eleve_id);

create table if not exists historique (
  id bigserial primary key,
  ecole_id uuid references ecoles(id) on delete cascade,
  date_heure timestamptz not null default now(),
  user_id uuid, qui text, action text not null, details text,
  ip text, user_agent text
);
create index if not exists idx_hist_ecole on historique(ecole_id, date_heure desc);

create table if not exists fiches_renvoi (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ecoles(id) on delete cascade,
  eleve_id uuid not null references eleves(id) on delete cascade,
  date date not null default current_date,
  motif text not null, duree_jours int not null default 1,
  date_retour date, cumul int not null default 0, pdf_url text,
  cree_par_nom text,
  date_creation timestamptz not null default now()
);

-- Vue des statistiques par élève
create or replace view v_eleves_stats as
select e.*,
  count(j.id) filter (where j.type='Retard') as retards,
  count(j.id) filter (where j.type='Absence') as absences,
  count(j.id) filter (where j.type='Absence' and j.justifie='Non') as absences_nj,
  count(j.id) filter (where j.type='Renvoi') as renvois
from eleves e left join journal j on j.eleve_id = e.id
group by e.id;

-- Synthèse par classe
create or replace function synthese(p_ecole uuid, p_from date, p_to date, s_retard int, s_abs int, s_renvoi int)
returns table(classe text, effectif bigint, retards bigint, absences bigint, renvois bigint, a_convoquer bigint, a_surveiller bigint)
language sql security definer set search_path = public as $$
  with t as (
    select e.id, e.classe,
      count(*) filter (where j.type='Retard') r_all,
      count(*) filter (where j.type='Absence' and j.justifie='Non') a_all,
      count(*) filter (where j.type='Renvoi') v_all,
      count(*) filter (where j.type='Retard' and j.date between p_from and p_to) r_p,
      count(*) filter (where j.type='Absence' and j.date between p_from and p_to) a_p,
      count(*) filter (where j.type='Renvoi' and j.date between p_from and p_to) v_p
    from eleves e left join journal j on j.eleve_id = e.id
    where e.ecole_id = p_ecole group by e.id, e.classe)
  select classe, count(*)::bigint, coalesce(sum(r_p),0)::bigint, coalesce(sum(a_p),0)::bigint, coalesce(sum(v_p),0)::bigint,
    (count(*) filter (where v_all >= s_renvoi))::bigint,
    (count(*) filter (where v_all < s_renvoi and (r_all >= s_retard or a_all >= s_abs)))::bigint
  from t group by classe order by classe;
$$;

-- Sécurité : RLS activé, AUCUNE policy => l'API publique (anon) ne voit rien.
-- Seul le serveur (clé service_role) accède aux données et filtre par ecole_id.
do $$ declare t text; begin
  foreach t in array array['ecoles','utilisateurs','password_history','sessions','password_resets','login_attempts','eleves','journal','historique','fiches_renvoi'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
revoke all on v_eleves_stats from anon, authenticated;
revoke all on function synthese(uuid,date,date,int,int,int) from anon, authenticated, public;
grant execute on function synthese(uuid,date,date,int,int,int) to service_role;
grant all on all tables in schema public to service_role;

-- Bucket privé pour les justificatifs (URLs signées 1h)
insert into storage.buckets (id, name, public) values ('justificatifs','justificatifs',false) on conflict (id) do nothing;
