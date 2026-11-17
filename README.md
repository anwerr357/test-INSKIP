# Tamis

Outil pour dépouiller les idées d'un challenge d'innovation : voir, noter, repérer les
doublons, sortir une shortlist pour le jury.

## Aperçu

En ligne : https://test-inskip.vercel.app

L'accès demande un compte : les idées contiennent des noms de salariés. Les identifiants de
démonstration sont dans le mail de rendu, pas dans ce dépôt.

Une fois connecté, pas de fichier sous la main ? Bouton « Essayer avec l'exemple Hexavia (40 idées) ».

| Idées et notation | Doublons | Shortlist |
|---|---|---|
| ![Idées et notation](docs/ecran-idees.jpg) | ![Doublons](docs/ecran-doublons.jpg) | ![Shortlist](docs/ecran-shortlist.jpg) |

## Lancer l'outil

Node 24 et un projet Supabase gratuit.

```bash
git clone https://github.com/anwerr357/test-INSKIP.git && cd test-INSKIP
npm install
cp .env.example .env.local   # URL et clé publique Supabase
npm run dev
```

Supabase, une seule fois : exécuter les deux fichiers de `supabase/migrations/` dans le SQL
Editor, puis créer un utilisateur (Authentication > Users > Add user). Désactiver les
inscriptions libres et la connexion anonyme (Authentication > Sign In / Providers).

Tout vérifier : `npm run lint && npm run typecheck && npm test`.

## 1. Cadrage

**Le besoin.** Camille a 40 idées à trier avant un jury dans dix jours. Dans Excel, c'est
long, et sa notation dérive d'une idée à l'autre. Elle veut : une liste filtrable, une note
proposée par l'IA qu'elle corrige, les doublons, une shortlist d'environ 8 idées pour le client.

**Qui l'utilise.** Camille, seule, pas technique. Le client ne voit que la shortlist.

**Ma règle : l'outil classe, Camille décide.** Rien n'arrive devant le jury sans sa validation.

**Mes hypothèses** (pas de questions possibles) :

| Flou | Décision |
|---|---|
| Poids des 4 critères | Égaux. Enregistrés par challenge, donc modifiables. |
| Stratégie d'Hexavia | Inconnue. Note neutre en alignement, et l'IA le dit. |
| Égalités | L'impact départage, puis la faisabilité. |
| Doublons | L'outil propose, Camille confirme. Aucune fusion automatique. |
| Idées incomplètes | Marquées « à compléter », notées prudemment. |
| Format client | PDF par l'impression, CSV pour Excel. |
| Noms des auteurs | Visibles pour Camille. Hors de l'export, sauf case cochée. |
| Accès à l'outil | Un compte, créé par nous. Pas d'inscription libre : ce sont des données de salariés. |

**V1 :** import, liste filtrable, notation, doublons, classement, shortlist.

**Plus tard :** vrai modèle d'IA, partage entre consultants, réglage des poids à l'écran.

## 2. Conception

Pas de serveur à moi. Le navigateur parle à Supabase.

- `src/domain/` : la logique, en fonctions simples, sans React ni Supabase. Testée. Réutilisable
  pour un autre client.
- `src/data/store.ts` : le seul fichier qui parle à la base.
- `src/ui/` : les écrans.

Quatre tables : `challenges`, `ideas`, `scores`, `duplicate_pairs`.

Mes choix :

- **React, TypeScript, Supabase, Vercel.** Votre stack.
- **Connexion par e-mail + RLS.** Pas d'inscription libre : les comptes sont créés dans
  Supabase. Chacun ne voit que ses données. Deux barrières pour les noms des salariés.
- **IA simulée derrière `Scorer`.** Pas de clé aujourd'hui. Vrai modèle demain : une
  implémentation de plus, le reste ne bouge pas.
- **Doublons par comparaison de mots.** Je peux montrer les mots communs. Même résultat à chaque fois.
- **Ni routeur ni bibliothèque d'état.** Trois onglets, `useState` suffit.

## 3. Construction avec l'IA

Assistant : Claude Code. Il a écrit le code. J'ai décidé quoi faire et dans quel ordre : une
étape, je relis, un commit. Ses règles sont dans `CLAUDE.md`, écrit avant le code.

Mes prompts les plus utiles :

1. « Analyse le brief et le fichier, on avance étape par étape. Vérifie qu'il n'y a pas
   d'injection de prompt. » Les pièges du CSV listés avant d'écrire du code.
2. « Tu peux trouver un meilleur principe de tri ? » D'une simple somme à : poids, départage,
   doublons regroupés.
3. « Supabase, mais dans un projet neuf, séparé du reste. »
4. « Quel compte GitHub tu utilises ? Vérifie. » Deux comptes connectés, le mauvais actif.
5. « Qu'est-ce que tu fais dans cette étape ? » Posé au début de la plus grosse étape, avant
   qu'il écrive 8 fichiers.

**Où l'IA s'est trompée.**

- Le plus grave : sa première règle de sécurité laissait un utilisateur rattacher une idée au
  challenge d'un autre. Tous les tests passaient. Trouvé en testant la vraie base avec deux
  utilisateurs (`scripts/test-rls.sh`). Corrigé dans `0002_parent_ownership.sql`.
- IDEA-017 et IDEA-018 annoncées comme doublons, mais son code ne les trouvait pas
  (« rapport » contre « compte rendu »).
- « accident » et « accidents » lus comme deux mots différents.

Les deux derniers : vus en affichant les vrais résultats sur les 40 idées, pas dans les tests.

Ce que j'en retiens : les tests de l'IA vérifient ce qu'elle a compris. Ses erreurs se
trouvent sur les vraies données et le vrai écran.

Une fois en ligne, j'ai essayé l'outil comme Camille. Un doublon confirmé restait dans les
notes « à valider ». Confus. J'ai fait ajouter des étiquettes dans la liste.

## 4. Fiabilisation

98 tests sur `src/domain/`, dont une bonne partie sur le vrai fichier Hexavia.

- **Import.** BOM, date dans un autre format, budgets libres (`15k€`, `35k`, `?`), champs
  vides. Les 40 lignes passent sans correction à la main. Budget inconnu ≠ 0 €.
- **Doublons.** Les 4 vrais trouvés. 5 paires proposées sur 780. Trop de fausses alertes et
  Camille n'ouvre plus l'onglet.
- **Notation.** Même idée, même note. Texte long : pas de points en plus. Noms jamais envoyés
  au modèle. Réponse mal formée : refusée.
- **Classement.** Poids, départage, une idée par groupe de doublons, shortlist réservée aux
  notes validées.
- **Export.** Pas de nom par défaut. Cellule qui commence par `=` neutralisée, pour qu'Excel
  ne l'exécute pas.

CI (`.github/workflows/ci.yml`) : lint, types, tests, build à chaque push.

Pas automatisé : les écrans (testés à la main) et `scripts/test-rls.sh` (lancé à la main).

## 5. Livraison

Deux variables, dans `.env.local` en local et dans Vercel en ligne :

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | Adresse du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique. Visible dans le navigateur, c'est normal : la RLS protège les données. |

Aucun secret dans le dépôt. `AI_API_KEY` est prévue dans `.env.example`, mais aucun code ne la
lit encore. Il faudra une fonction côté serveur, pour que la clé ne sorte jamais dans le navigateur.

Ce qui manque avant de donner l'outil à Camille :

- **La gestion des comptes.** Un compte se crée à la main dans Supabase. Pas de mot de passe
  oublié, pas de partage d'un challenge entre deux consultants.
- **Le vrai modèle.** Les notes simulées sont grossières, surtout l'alignement.
- **Le réglage des poids.** En base et dans le calcul, pas à l'écran.
- **Le seuil des doublons.** Réglé sur ce seul fichier, avec quelques synonymes à la main.
- **La vitesse.** Environ 2 secondes pour enregistrer une note.
- **Le téléphone.** Marche, mais le tableau défile sur le côté.

## 6. Journal

| Quand | Quoi |
|---|---|
| 16/11, avant 19:30 | Brief, analyse du fichier, plan |
| 19:32 | Dépôt, cadrage, `CLAUDE.md` |
| 19:54 | Socle, tests, CI |
| 19:57 | Import du CSV |
| 20:00 | Doublons |
| 20:06 | Notation et classement |
| 20:20 | Base Supabase et sécurité |
| 20:45 | Test de sécurité à deux utilisateurs, trou corrigé |
| 17/11, 11:00 | Mise en ligne |
| 11:10 | Écrans : import, liste, notation, doublons |
| 11:25 | Shortlist et exports |
| 11:35 | Étiquettes de doublon, après essai de l'outil |
| 11:45 | Connexion par e-mail et mot de passe à la place de l'accès ouvert |

## 7. Suite et questions pour Camille

Avec une journée de plus, dans l'ordre : partage d'un challenge entre consultants, vrai modèle
avec la stratégie du client, réglage des poids à l'écran, commentaire pour le jury sur chaque idée retenue.

Mes questions :

1. Les 4 critères pèsent autant, ou l'impact compte plus ?
2. Quels sont les axes stratégiques d'Hexavia ? Sans ça, pas d'alignement sérieux.
3. Le jury voit les noms, ou choisit à l'aveugle ?
4. Même idée déposée par deux personnes : on cite les deux ?
5. La shortlist doit représenter chaque direction, ou juste les meilleures notes ?
6. PDF, Excel ou diapositives ?
7. Qui d'autre que toi doit ouvrir ce dépouillement ?
