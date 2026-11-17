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

type Token = { stem: string; word: string }

/**
 * Découpe un texte en mots porteurs de sens. Chaque mot est comparé par son radical
 * (minuscules, sans accents, sans terminaison), mais on garde le mot tel qu'il est écrit
 * pour pouvoir le montrer à Camille.
 */
function tokens(text: string): Token[] {
  return text
    .toLowerCase()
    .replace(/comptes? rendus?/g, 'rapport')
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => ({ word, plain: word.normalize('NFD').replace(/\p{M}/gu, '') }))
    .filter(({ plain }) => plain.length > 1 && !STOPWORDS.has(plain))
    .map(({ word, plain }) => {
      const stemmed = stem(plain)
      return { word, stem: SYNONYMS[stemmed] ?? stemmed }
    })
}

/** Les radicaux d'un texte, sans les mots vides. */
export function tokenize(text: string): string[] {
  return tokens(text).map((token) => token.stem)
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
  // Le pluriel d'abord, sinon "accidents" et "accident" n'aboutissent pas au même radical.
  return word.replace(/[sx]$/, '').replace(/(ement|ation|ive|if|ee|ent|er|e)$/, '')
}

type Vector = Map<string, number>

function toVector(idea: Idea): { vector: Vector; words: Map<string, string> } {
  const vector: Vector = new Map()
  const words = new Map<string, string>()
  const title = tokens(idea.titre)
  // Le titre résume l'idée : ses mots comptent double.
  for (const { stem, word } of [...title, ...title, ...tokens(idea.description ?? '')]) {
    vector.set(stem, (vector.get(stem) ?? 0) + 1)
    if (!words.has(stem)) words.set(stem, word)
  }
  // Fréquence amortie : un mot répété cinq fois ne compte pas cinq fois plus, sinon une
  // idée longue écrase les autres.
  for (const [stem, count] of vector) vector.set(stem, 1 + Math.log(count))
  return { vector, words }
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
  /** Les mots partagés, tels qu'écrits dans la première idée : la raison de la proposition. */
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
  for (const { vector } of raw) for (const stem of vector.keys()) documentCount.set(stem, (documentCount.get(stem) ?? 0) + 1)
  const weighted = raw.map(({ vector }) => {
    const result: Vector = new Map()
    for (const [stem, count] of vector) {
      result.set(stem, count * Math.log(1 + ideas.length / documentCount.get(stem)!))
    }
    return result
  })

  const pairs: DuplicatePair[] = []
  for (let i = 0; i < ideas.length; i++) {
    for (let j = i + 1; j < ideas.length; j++) {
      const score = cosine(weighted[i], weighted[j])
      if (score < threshold) continue
      const motsCommuns = [...raw[i].words].filter(([stem]) => raw[j].vector.has(stem)).map(([, word]) => word)
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
