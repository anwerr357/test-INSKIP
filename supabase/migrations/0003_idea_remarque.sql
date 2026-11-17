-- Remarques personnelles de Camille sur une idée, prises pendant le dépouillement.
-- Privées : elles ne sont ni exportées pour le client, ni transmises au modèle de notation.
-- La colonne est couverte par la règle RLS existante de la table ideas.
alter table public.ideas add column remarque text;
