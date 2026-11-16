import type { Idea } from './importIdeas'

// Détection des doublons. L'outil propose des paires, Camille confirme : rien n'est
// fusionné automatiquement. On compare les mots porteurs de sens du titre et de la
// description, en donnant plus de poids aux mots rares dans le lot d'idées
// ("compresseurs" pèse plus que "salariés"). Pas d'appel à un modèle : le résultat est
// explicable (on peut montrer les mots communs) et identique d'une fois sur l'autre.

const STOPWORDS = new Set(
  `a au aux avec ce ces chaque dans de des du elle en est et il ils la le les leur leurs ne nos notre
   on ou par pas plus pour qu que qui sa se ses son sur un une y d l n s c j
   afin ainsi aujourd hui avant apres aussi au-dela lors tous tout toute toutes meme entre depuis
   etre avoir fait font peut peuvent faut pouvoir permettre mettre place
   the of to and a an for in on with under from`.split(/\s+/),
)

/** Minuscules, sans accents, sans ponctuation, sans mots vides, réduits à leur radical. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // retire les accents, séparés des lettres par normalize('NFD')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/comptes? rendus?/g, 'rapport')
    .split(' ')
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem)
    .map((word) => SYNONYMS[word] ?? word)
}

// Une comparaison de mots ne voit pas que "chatbot" et "assistant" désignent la même chose,
// ni "compte rendu" et "rapport". Ce court lexique rapproche ces synonymes.
// C'est la limite assumée de la V1 : un vrai modèle (embeddings) le ferait sans lexique.
const SYNONYMS: Record<string, string> = {
  chatbot: 'assistant',
  robot: 'assistant',
  copilot: 'assistant',
}

// Radical approximatif : on retire les terminaisons courantes pour rapprocher
// "compresseurs" de "compresseur" et "dictent" de "dictée". Volontairement grossier.
function stem(word: string): string {
  if (word.length <= 4) return word
  return word.replace(/(ements?|ations?|ives?|ifs?|ees?|ent|er|es|s|x|e)$/, '')
}

type Vector = Map<string, number>

function toVector(idea: Idea): Vector {
  const vector: Vector = new Map()
  // Le titre résume l'idée : ses mots comptent double.
  const words = [...tokenize(idea.titre), ...tokenize(idea.titre), ...tokenize(idea.description ?? '')]
  for (const word of words) vector.set(word, (vector.get(word) ?? 0) + 1)
  // Fréquence amortie : un mot répété cinq fois ne compte pas cinq fois plus, sinon une
  // idée longue écrase les autres.
  for (const [word, count] of vector) vector.set(word, 1 + Math.log(count))
  return vector
}

function cosine(a: Vector, b: Vector): number {
  let dot = 0
  for (const [word, weight] of a) dot += weight * (b.get(word) ?? 0)
  const norm = (v: Vector) => Math.sqrt([...v.values()].reduce((sum, w) => sum + w * w, 0))
  const denominator = norm(a) * norm(b)
  return denominator === 0 ? 0 : dot / denominator
}

export type DuplicatePair = {
  a: string
  b: string
  /** Similarité de 0 (rien en commun) à 1 (même texte). */
  score: number
  motsCommuns: string[]
}

// Seuil calibré sur l'export Hexavia : les quatre doublons réels sont à 0,27 et plus, le
// bruit (deux idées qui partagent des mots courants) à 0,23 et moins. La marge est étroite :
// c'est une proposition à valider, pas une décision. L'outil propose aussi une paire
// voisine mais distincte (les deux covoiturages) : mieux vaut une proposition que Camille
// écarte en un clic qu'un doublon qui arrive devant le jury.
export const DUPLICATE_THRESHOLD = 0.25

export function findDuplicatePairs(ideas: Idea[], threshold = DUPLICATE_THRESHOLD): DuplicatePair[] {
  const raw = ideas.map(toVector)

  // Poids d'un mot = rareté dans le lot (IDF). Un mot présent partout ne distingue rien.
  const documentCount = new Map<string, number>()
  for (const vector of raw) for (const word of vector.keys()) documentCount.set(word, (documentCount.get(word) ?? 0) + 1)
  const weighted = raw.map((vector) => {
    const result: Vector = new Map()
    for (const [word, count] of vector) {
      result.set(word, count * Math.log(1 + ideas.length / documentCount.get(word)!))
    }
    return result
  })

  const pairs: DuplicatePair[] = []
  for (let i = 0; i < ideas.length; i++) {
    for (let j = i + 1; j < ideas.length; j++) {
      const score = cosine(weighted[i], weighted[j])
      if (score < threshold) continue
      const motsCommuns = [...raw[i].keys()].filter((word) => raw[j].has(word))
      pairs.push({ a: ideas[i].id, b: ideas[j].id, score: Math.round(score * 100) / 100, motsCommuns })
    }
  }
  return pairs.sort((x, y) => y.score - x.score)
}

/**
 * Regroupe les paires confirmées par Camille : si A=B et B=C, alors A, B et C forment
 * un seul groupe. Chaque groupe est trié, son premier élément sert de représentant.
 */
export function groupDuplicates(pairs: Pick<DuplicatePair, 'a' | 'b'>[]): string[][] {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const up = parent.get(id) ?? id
    if (up === id) return id
    const root = find(up)
    parent.set(id, root)
    return root
  }
  for (const { a, b } of pairs) parent.set(find(a), find(b))

  const groups = new Map<string, string[]>()
  for (const id of new Set(pairs.flatMap(({ a, b }) => [a, b]))) {
    const root = find(id)
    groups.set(root, [...(groups.get(root) ?? []), id])
  }
  return [...groups.values()].map((group) => group.sort()).sort((x, y) => x[0].localeCompare(y[0]))
}
