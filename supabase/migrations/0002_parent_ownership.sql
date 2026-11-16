-- Corrige un trou trouvé en testant les règles avec deux utilisateurs : un utilisateur
-- pouvait insérer une idée rattachée au challenge d'un autre. Il ne voyait rien de ce
-- challenge (la lecture était bien protégée), mais sa ligne s'y accrochait quand même.
-- Cause : la règle ne vérifiait que owner_id, et le contrôle de clé étrangère ignore la RLS.
-- Désormais, on ne peut écrire une ligne que sous un parent qui nous appartient.
-- Les sous-requêtes passent elles-mêmes par la RLS : elles ne voient que nos propres lignes.

drop policy "proprietaire uniquement" on public.ideas;
create policy "proprietaire uniquement" on public.ideas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and challenge_id in (select id from public.challenges)
  );

drop policy "proprietaire uniquement" on public.scores;
create policy "proprietaire uniquement" on public.scores
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and idea_id in (select id from public.ideas)
  );

drop policy "proprietaire uniquement" on public.duplicate_pairs;
create policy "proprietaire uniquement" on public.duplicate_pairs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and challenge_id in (select id from public.challenges)
  );
