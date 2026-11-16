-- Schéma de Tamis. À exécuter une fois dans le SQL Editor du projet Supabase.
--
-- Sécurité : l'application s'ouvre sans écran de connexion, grâce à la connexion anonyme
-- de Supabase. Chaque visiteur reçoit un identifiant (auth.uid()) et ne voit que ses propres
-- lignes. La clé publique présente dans le navigateur ne donne donc accès à aucune donnée
-- d'un autre utilisateur : c'est ce qui protège les noms des salariés.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null,
  -- Poids des 4 critères, réglables par challenge : {"impact":1,"faisabilite":1,...}
  poids jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ref text not null, -- identifiant d'origine, par exemple IDEA-001
  date_depot date,
  prenom text,
  nom text,
  direction text,
  site text,
  theme text,
  titre text not null,
  description text,
  benefices text,
  budget_saisi text, -- tel que saisi dans le formulaire
  budget_euros integer, -- lu par l'import, null si illisible
  manques text[] not null default '{}',
  shortlist boolean not null default false,
  unique (challenge_id, ref)
);

create table public.scores (
  idea_id uuid primary key references public.ideas (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  impact smallint not null check (impact between 1 and 5),
  faisabilite smallint not null check (faisabilite between 1 and 5),
  alignement smallint not null check (alignement between 1 and 5),
  innovation smallint not null check (innovation between 1 and 5),
  justifications jsonb not null,
  -- 'proposee' : note de l'IA, pas encore relue. 'validee' : confirmée ou corrigée par Camille.
  statut text not null default 'proposee' check (statut in ('proposee', 'validee')),
  updated_at timestamptz not null default now()
);

-- Décisions de Camille sur les paires proposées. Une paire absente est encore à examiner.
create table public.duplicate_pairs (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ref_a text not null,
  ref_b text not null,
  decision text not null check (decision in ('confirmee', 'ecartee')),
  primary key (challenge_id, ref_a, ref_b)
);

create index ideas_owner_idx on public.ideas (owner_id);
create index scores_owner_idx on public.scores (owner_id);

alter table public.challenges enable row level security;
alter table public.ideas enable row level security;
alter table public.scores enable row level security;
alter table public.duplicate_pairs enable row level security;

-- Une seule règle par table : on ne lit et n'écrit que ses propres lignes.
-- (select auth.uid()) est évalué une fois par requête et non une fois par ligne.
create policy "proprietaire uniquement" on public.challenges
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "proprietaire uniquement" on public.ideas
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "proprietaire uniquement" on public.scores
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "proprietaire uniquement" on public.duplicate_pairs
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Un visiteur non connecté (rôle anon) n'a aucun droit sur ces tables.
revoke all on public.challenges, public.ideas, public.scores, public.duplicate_pairs from anon;
grant select, insert, update, delete
  on public.challenges, public.ideas, public.scores, public.duplicate_pairs to authenticated;
