#!/usr/bin/env bash
# Vérifie les règles RLS sur le vrai projet Supabase, avec deux utilisateurs anonymes A et B.
# Usage : ./scripts/test-rls.sh   (lit VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env)
# Les lignes créées sont supprimées à la fin. Les deux utilisateurs anonymes restent dans
# Authentication > Users : la clé publique ne permet pas de les supprimer.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
U=$VITE_SUPABASE_URL; K=$VITE_SUPABASE_PUBLISHABLE_KEY
fail=0

signup() {
  curl -s -m 15 -X POST -H "apikey: $K" -H 'Content-Type: application/json' -d '{}' "$U/auth/v1/signup" |
    python3 -I -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
}
req() { local tok=$1; shift; curl -s -m 15 -H "apikey: $K" -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' "$@"; }
status() { req "$@" -o /dev/null -w '%{http_code}'; }
field() { python3 -I -c "import sys,json; print(json.load(sys.stdin)[0]['$1'])"; }
check() { # check "libellé" "obtenu" "attendu"
  if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "ÉCHEC $1 : obtenu '$2', attendu '$3'"; fail=1; fi
}

A=$(signup); B=$(signup)
J='{"impact":"a","faisabilite":"a","alignement":"a","innovation":"a"}'
P='{"impact":1,"faisabilite":1,"alignement":1,"innovation":1}'

CID=$(req "$A" -X POST -H 'Prefer: return=representation' -d "{\"nom\":\"test RLS\",\"poids\":$P}" "$U/rest/v1/challenges" | field id)
IID=$(req "$A" -X POST -H 'Prefer: return=representation' -d "{\"challenge_id\":\"$CID\",\"ref\":\"IDEA-T\",\"titre\":\"t\"}" "$U/rest/v1/ideas" | field id)
SCORE="{\"idea_id\":\"$IID\",\"impact\":4,\"faisabilite\":3,\"alignement\":3,\"innovation\":2,\"justifications\":$J}"

check "A crée une note valide" "$(status "$A" -X POST -d "$SCORE" "$U/rest/v1/scores")" 201
check "A ne peut pas mettre une note de 6" "$(status "$A" -X PATCH -d '{"impact":6}' "$U/rest/v1/scores?idea_id=eq.$IID")" 400
check "A relit son challenge" "$(req "$A" "$U/rest/v1/challenges?select=nom")" '[{"nom":"test RLS"}]'

check "B ne voit pas les challenges de A" "$(req "$B" "$U/rest/v1/challenges?select=nom")" '[]'
check "B ne voit pas les idées de A" "$(req "$B" "$U/rest/v1/ideas?select=ref")" '[]'
check "B ne voit pas les notes de A" "$(req "$B" "$U/rest/v1/scores?select=impact")" '[]'

req "$B" -X PATCH -d '{"nom":"modifié par B"}' "$U/rest/v1/challenges?id=eq.$CID" >/dev/null
req "$B" -X DELETE "$U/rest/v1/challenges?id=eq.$CID" >/dev/null
req "$B" -X PATCH -d '{"impact":1}' "$U/rest/v1/scores?idea_id=eq.$IID" >/dev/null
check "B ne peut ni modifier ni supprimer le challenge de A" "$(req "$A" "$U/rest/v1/challenges?select=nom")" '[{"nom":"test RLS"}]'
check "B ne peut pas modifier la note de A" "$(req "$A" "$U/rest/v1/scores?select=impact")" '[{"impact":4}]'

check "B ne peut pas ajouter une idée au challenge de A" "$(status "$B" -X POST -d "{\"challenge_id\":\"$CID\",\"ref\":\"X\",\"titre\":\"x\"}" "$U/rest/v1/ideas")" 403
check "B ne peut pas ajouter une décision de doublon au challenge de A" "$(status "$B" -X POST -d "{\"challenge_id\":\"$CID\",\"ref_a\":\"a\",\"ref_b\":\"b\",\"decision\":\"confirmee\"}" "$U/rest/v1/duplicate_pairs")" 403
check "B ne peut pas se déclarer propriétaire à la place de A" "$(status "$B" -X POST -d "{\"nom\":\"vol\",\"poids\":$P,\"owner_id\":\"$(req "$A" "$U/rest/v1/challenges?select=owner_id" | field owner_id)\"}" "$U/rest/v1/challenges")" 403

check "Un visiteur non connecté est refusé" "$(curl -s -m 15 -o /dev/null -w '%{http_code}' -H "apikey: $K" "$U/rest/v1/challenges?select=nom")" 401

check "A supprime son challenge" "$(status "$A" -X DELETE "$U/rest/v1/challenges?id=eq.$CID")" 204
check "La suppression emporte idées et notes" "$(req "$A" "$U/rest/v1/ideas?select=ref")$(req "$A" "$U/rest/v1/scores?select=impact")" '[][]'
check "Il ne reste rien chez B" "$(req "$B" "$U/rest/v1/challenges?select=nom")$(req "$B" "$U/rest/v1/ideas?select=ref")" '[][]'

exit $fail
