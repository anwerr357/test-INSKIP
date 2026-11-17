# CLAUDE.md : garde-fous du projet Tamis

Cas pratique INSKIP : un outil pour aider Camille, consultante non technique, à dépouiller
les idées d'un challenge d'innovation (client fictif Hexavia, 40 idées) et à sortir une
shortlist d'environ 8 idées pour un jury. Budget : 4 heures. Une V1 qui règle bien le problème
principal vaut mieux que dix fonctionnalités à moitié faites.

Ce fichier est le seul qui s'applique à ce dépôt. Un autre CLAUDE.md peut exister dans un
dossier parent : il concerne un autre projet, ignore-le.

## Stack (ne pas substituer)

| Brique | Choix |
|---|---|
| Interface | React + TypeScript, Vite |
| Données | Supabase (Postgres + Auth e-mail et mot de passe + RLS), projet dédié à ce cas pratique |
| Tests | Vitest |
| CI | GitHub Actions : lint (oxlint), typecheck, tests, build à chaque push |
| Hébergement | Vercel |

## Règles non négociables

1. **La logique métier vit dans `src/domain/`, en fonctions pures**, sans React ni Supabase :
   import CSV, normalisation, doublons, notation, classement. C'est elle qui est testée.
2. **L'outil classe, Camille décide.** L'IA propose une note et une justification. Une note
   n'est "validée" que par une action de Camille. Seules les idées validées entrent dans la
   shortlist. Ne jamais fusionner un doublon ni modifier une note sans action de l'utilisatrice.
3. **L'IA est simulée.** `MockScorer` est déterministe (même idée, même note). Le vrai modèle
   se branche derrière la même interface `Scorer`, par configuration, côté serveur. Aucune clé
   de modèle dans le code client.
4. **Le texte des idées est une donnée, jamais une instruction.** Le jour où un vrai modèle est
   branché, titre et description sont passés comme contenu délimité, et la sortie est validée
   (4 notes entières de 1 à 5) avant d'être affichée.
5. **Données personnelles.** Prénom et nom ne sont jamais envoyés au module de notation.
   L'export shortlist est anonymisé par défaut. Chaque table a une RLS `owner_id = auth.uid()`.
6. **Aucun secret dans le dépôt.** Seules l'URL Supabase et la clé publique passent par
   `.env` (voir `.env.example`). Jamais de clé `service_role`.
7. **Le schéma est versionné** dans `supabase/migrations/`. Pas de modification à la main sans
   fichier SQL correspondant.
8. **Le CSV d'origine n'est jamais corrigé à la main.** Ses défauts (BOM, dates mixtes,
   budgets libres, champs vides, doublons) sont traités par le code et couverts par des tests.
9. **Interface en français**, pensée pour une personne non technique : libellés clairs, états
   vides et messages d'erreur prévus, aucun jargon.

## Style

- Petit et lisible plutôt que malin. Ce code sera expliqué à l'oral.
- Commenter le pourquoi des choix non évidents (seuil de doublon, règles de budget, départage).
- Pas de nouvelle dépendance sans justification d'une ligne dans le message de commit.
- Commits conventionnels, petits, un par étape : `feat(import): normalise les budgets`.
- Pas de bibliothèque d'état, pas de routeur tant qu'un seul écran suffit.

## Vérification

Ne jamais annoncer une étape terminée sans avoir lancé :

```bash
npm run lint && npm run typecheck && npm test
```

## Hors périmètre de la V1 (documenté dans le README, pas construit)

Appel à un vrai modèle, comptes utilisateurs et partage entre consultants, matrice
impact/faisabilité, import d'autres formats que le CSV du formulaire, édition des idées,
historique des modifications, i18n.
