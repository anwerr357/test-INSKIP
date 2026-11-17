import Papa from 'papaparse'
import { CRITERIA } from './criteria'
import type { Idea } from './importIdeas'
import type { Scores } from './scoring'

// Export de la shortlist pour le client. Deux précautions :
// - les noms des auteurs n'y figurent que si Camille le demande explicitement ;
// - le texte des idées vient d'un formulaire ouvert à 4 000 salariés. Une cellule qui
//   commence par "=" serait exécutée comme une formule par Excel : on la neutralise.

export type ShortlistItem = { idea: Idea; scores: Scores; total: number }

// Marque d'ordre d'octets : sans elle, Excel affiche mal les accents d'un CSV en UTF-8.
const BOM = String.fromCharCode(0xfeff)

export function shortlistToCsv(items: ShortlistItem[], options: { withAuthors: boolean }): string {
  const rows = items.map(({ idea, scores, total }, index) => ({
    Rang: index + 1,
    Identifiant: idea.id,
    Titre: idea.titre,
    'Thème': idea.theme ?? '',
    Direction: idea.direction ?? '',
    Site: idea.site ?? '',
    ...(options.withAuthors ? { Auteur: [idea.prenom, idea.nom].filter(Boolean).join(' ') } : {}),
    'Budget estimé (€)': idea.budgetEuros ?? '',
    ...Object.fromEntries(CRITERIA.map(({ key, label }) => [`${label} (sur 5)`, scores[key]])),
    'Note globale (sur 20)': total.toLocaleString('fr-FR'),
    Description: idea.description ?? '',
    'Bénéfices attendus': idea.benefices ?? '',
  }))
  // Point-virgule et fins de ligne Windows : le format qu'attend un Excel français.
  return BOM + Papa.unparse(rows, { delimiter: ';', newline: '\r\n', escapeFormulae: true })
}
