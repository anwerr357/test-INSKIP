# Tamis

Un outil pour dépouiller les idées d'un challenge d'innovation, les noter sur la grille du
client et sortir une shortlist pour le jury.

## Aperçu

URL de l'application : https://test-inskip.vercel.app

_Captures à ajouter : liste des idées, fiche de notation, shortlist._

## Lancer l'outil

Prérequis : Node 24 et npm.

```bash
git clone https://github.com/anwerr357/test-INSKIP.git && cd test-INSKIP
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé publique Supabase
npm run dev
```

Vérifications : `npm run lint`, `npm run typecheck`, `npm test`.

## 1. Cadrage

**Le besoin de Camille.** Camille accompagne Hexavia sur son challenge d'innovation interne.
Elle dépouille 40 idées à la main dans Excel avant un jury dans dix jours. C'est long, et elle
a du mal à noter de façon cohérente d'une idée à l'autre. Elle veut tout voir au même endroit,
noter sur la grille du client avec une première proposition de l'IA, repérer les doublons et
envoyer au client une shortlist d'environ 8 idées.

**Qui utilisera l'outil.** Camille, consultante, non technique, seule sur ce dépouillement.
Le client et le jury ne voient que la shortlist exportée, pas l'outil.

**Le principe retenu : l'outil classe, Camille décide.** L'IA propose, Camille valide ou
corrige, et chaque position du classement s'explique par des notes qu'elle a validées.

**Mes hypothèses** (je ne peux pas poser de questions à Camille) :

| Point flou | Hypothèse |
|---|---|
| Pondération de la grille | Les 4 critères comptent autant par défaut. Les poids sont réglables par challenge. |
| Stratégie d'Hexavia | Non fournie. Je prends les thèmes du formulaire comme axes stratégiques. |
| Classement | Total pondéré, puis départage par l'impact, puis par la faisabilité. |
| Doublons | L'outil propose des groupes, Camille confirme. Une seule idée par groupe est classée. |
| Idées incomplètes | Signalées "à compléter", notées prudemment, sans pénalité cachée. |
| Format pour le client | Une page imprimable (PDF via le navigateur) et un export CSV. |
| Noms des auteurs | Utiles à Camille, mais absents par défaut de ce qui part chez le client. |
| Shortlist | L'outil suggère les 8 premières et montre la répartition par thème et direction. Camille ajuste. |

**Dans la V1 :** import du CSV, liste filtrable, notation proposée puis corrigée, détection
des doublons, classement, shortlist exportable.

**Ce qui attendra :** un vrai modèle d'IA, le partage entre plusieurs consultants, la matrice
impact/faisabilité, l'édition des idées, l'import d'autres formats.

## 2. Conception

**Architecture.** Une application web monopage. La logique métier (import, doublons,
notation, classement) est écrite en fonctions pures dans `src/domain/`, sans dépendance à
l'interface ni à la base : c'est ce qui la rend testable et réutilisable pour un autre client.

**Modèle de données.**

| Table | Contenu |
|---|---|
| `challenges` | Un challenge client : nom, poids des 4 critères |
| `ideas` | Une idée importée : champs d'origine, champs normalisés (date, budget), groupe de doublons |
| `scores` | Les 4 notes d'une idée, la justification, le statut "proposée" ou "validée" |
| `duplicate_pairs` | Les décisions de Camille sur les doublons proposés : confirmé ou écarté |

Chaque ligne porte un `owner_id`. Une règle RLS limite la lecture et l'écriture à son
propriétaire.

**Stack et raisons.**

| Choix | Raison |
|---|---|
| React + TypeScript + Vite | La stack d'INSKIP. Les types sécurisent les données d'un CSV imparfait. |
| Supabase | La stack d'INSKIP. Les notes de Camille survivent à un changement de navigateur. |
| Connexion anonyme + RLS | L'outil s'ouvre par une simple URL, sans écran de connexion, et les noms des salariés ne sont lisibles par personne d'autre. |
| IA simulée derrière une interface `Scorer` | Pas de clé API aujourd'hui. Brancher un vrai modèle revient à ajouter une implémentation et une variable de configuration. |
| Vitest + GitHub Actions | Tests rapides sur la logique qui compte, lancés à chaque push. |
| Vercel | Déploiement à chaque push, offre gratuite. |

## 3. Construction avec l'IA

_À compléter au fil du travail : assistant utilisé, prompts les plus utiles, une erreur de
l'IA et comment elle a été repérée._

## 4. Fiabilisation

_À compléter : ce qui est testé et pourquoi, ce que fait la CI._

## 5. Livraison

_À compléter : configuration, ce qui manque avant de confier l'outil à Camille._

## 6. Journal

| Heure | Étape |
|---|---|
| 16/11, 19:32 | Création du dépôt, cadrage, `CLAUDE.md` |
| 19:54 | Socle Vite + React + TypeScript, Vitest, CI GitHub Actions, `.env.example` |
| 19:57 | Import du CSV et normalisation (dates, budgets, champs manquants), tests sur les 40 lignes du fichier |
| 20:00 | Détection des doublons : similarité de mots pondérée, seuil calibré sur le fichier, 5 paires proposées |
| 20:06 | Notation : interface `Scorer`, modèle simulé, contrôle des réponses ; classement pondéré et shortlist |
| 20:20 | Schéma Supabase et règles RLS (`supabase/migrations/0001_init.sql`) |
| 20:45 | Test des règles RLS avec deux utilisateurs : un trou trouvé et corrigé (`0002`), script `scripts/test-rls.sh` |
| Lendemain, 11:00 | Première mise en ligne sur Vercel |
| 11:10 | Interface branchée sur Supabase : import, liste filtrable, fiche de notation, doublons |

## 7. Suite et questions pour Camille

_À compléter._
