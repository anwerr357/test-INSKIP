import Papa from 'papaparse'
import { cleanText, parseBudget, parseDate } from './normalize'

// Import de l'export du formulaire. Le fichier d'origine n'est jamais corrigé à la main :
// ses défauts sont absorbés ici, et ce qui reste illisible est signalé à Camille.

export const REQUIRED_COLUMNS = [
  'id',
  'date_depot',
  'prenom',
  'nom',
  'direction',
  'site',
  'theme',
  'titre',
  'description',
  'benefices_attendus',
  'budget_estime',
] as const

/** Les champs dont l'absence gêne la notation. Affichés sous le badge "à compléter". */
export type MissingField = 'date' | 'direction' | 'site' | 'theme' | 'description' | 'benefices' | 'budget'

export type Idea = {
  id: string
  dateDepot: string | null
  prenom: string | null
  nom: string | null
  direction: string | null
  site: string | null
  theme: string | null
  titre: string
  description: string | null
  benefices: string | null
  /** Le budget tel que saisi, conservé pour que Camille puisse vérifier la lecture. */
  budgetSaisi: string | null
  budgetEuros: number | null
  manques: MissingField[]
}

export type RejectedRow = { ligne: number; raison: string }

export type ImportResult = { ideas: Idea[]; rejets: RejectedRow[] }

/** Erreur qui empêche tout l'import. Son message est affiché tel quel à l'utilisatrice. */
export class ImportError extends Error {}

export function importIdeas(csv: string): ImportResult {
  // Excel enregistre les CSV en UTF-8 avec une marque d'ordre d'octets (BOM) : sans ce
  // retrait, la première colonne s'appellerait "\uFEFFid" et serait déclarée manquante.
  const text = csv.replace(/^\uFEFF/, '')
  if (!text.trim()) throw new ImportError('Le fichier est vide.')

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t'],
    transformHeader: (header) => header.trim().toLowerCase(),
  })

  const columns = parsed.meta.fields ?? []
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !columns.includes(column))
  if (missingColumns.length > 0) {
    throw new ImportError(
      `Ce fichier ne ressemble pas à l'export du formulaire : il manque ${
        missingColumns.length === 1 ? 'la colonne' : 'les colonnes'
      } ${missingColumns.join(', ')}.`,
    )
  }

  const ideas: Idea[] = []
  const rejets: RejectedRow[] = []
  const seenIds = new Set<string>()

  parsed.data.forEach((row, index) => {
    const ligne = index + 2 // la ligne 1 du fichier est l'en-tête
    const id = cleanText(row.id)
    const titre = cleanText(row.titre)

    if (!id) return rejets.push({ ligne, raison: "L'identifiant de l'idée est vide." })
    if (!titre) return rejets.push({ ligne, raison: `L'idée ${id} n'a pas de titre.` })
    if (seenIds.has(id)) {
      return rejets.push({ ligne, raison: `L'identifiant ${id} apparaît déjà plus haut dans le fichier.` })
    }
    seenIds.add(id)

    const idea: Idea = {
      id,
      dateDepot: parseDate(row.date_depot),
      prenom: cleanText(row.prenom),
      nom: cleanText(row.nom),
      direction: cleanText(row.direction),
      site: cleanText(row.site),
      theme: cleanText(row.theme),
      titre,
      description: cleanText(row.description),
      benefices: cleanText(row.benefices_attendus),
      budgetSaisi: cleanText(row.budget_estime),
      budgetEuros: parseBudget(row.budget_estime),
      manques: [],
    }
    idea.manques = findMissingFields(idea)
    ideas.push(idea)
  })

  if (ideas.length === 0) throw new ImportError("Aucune idée n'a pu être lue dans ce fichier.")
  return { ideas, rejets }
}

function findMissingFields(idea: Idea): MissingField[] {
  const checks: [MissingField, unknown][] = [
    ['date', idea.dateDepot],
    ['direction', idea.direction],
    ['site', idea.site],
    ['theme', idea.theme],
    ['description', idea.description],
    ['benefices', idea.benefices],
    ['budget', idea.budgetEuros],
  ]
  return checks.filter(([, value]) => value === null).map(([field]) => field)
}
