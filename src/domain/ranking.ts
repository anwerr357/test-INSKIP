import { CRITERIA, DEFAULT_WEIGHTS, MAX_SCORE, type Weights } from './criteria'
import type { Scores } from './scoring'

// Classement des idées. Principe : l'outil classe, Camille décide. Chaque position doit
// pouvoir s'expliquer en une phrase devant le client.

export type ScoreStatus = 'proposee' | 'validee'

export type ScoredIdea = { id: string; scores: Scores; statut: ScoreStatus }

export type RankedIdea = ScoredIdea & { total: number; rang: number }

/**
 * Note globale sur 20 : moyenne pondérée des 4 critères, ramenée sur 20.
 * Avec des poids égaux, c'est la somme des 4 notes.
 */
export function totalOn20(scores: Scores, weights: Weights = DEFAULT_WEIGHTS): number {
  const weightSum = CRITERIA.reduce((sum, { key }) => sum + weights[key], 0)
  if (weightSum <= 0) throw new Error('Au moins un critère doit avoir un poids supérieur à zéro.')
  const weighted = CRITERIA.reduce((sum, { key }) => sum + scores[key] * weights[key], 0)
  return Math.round((weighted / weightSum / MAX_SCORE) * 20 * 10) / 10
}

/**
 * Classe les idées de la meilleure à la moins bonne.
 * À égalité de note globale : l'impact départage, puis la faisabilité, puis l'identifiant
 * (pour un ordre stable d'un affichage à l'autre).
 * Dans un groupe de doublons confirmés, seule l'idée la mieux notée est classée : les
 * autres ne doivent pas occuper plusieurs places de la shortlist.
 */
export function rankIdeas(
  ideas: ScoredIdea[],
  weights: Weights = DEFAULT_WEIGHTS,
  duplicateGroups: string[][] = [],
): RankedIdea[] {
  const sorted = ideas
    .map((idea) => ({ ...idea, total: totalOn20(idea.scores, weights) }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.scores.impact - a.scores.impact ||
        b.scores.faisabilite - a.scores.faisabilite ||
        a.id.localeCompare(b.id),
    )

  const groupOf = new Map(duplicateGroups.flatMap((group, index) => group.map((id) => [id, index] as const)))
  const groupsSeen = new Set<number>()
  const kept = sorted.filter(({ id }) => {
    const group = groupOf.get(id)
    if (group === undefined) return true
    if (groupsSeen.has(group)) return false
    groupsSeen.add(group)
    return true
  })

  return kept.map((idea, index) => ({ ...idea, rang: index + 1 }))
}

export const SHORTLIST_SIZE = 8

/**
 * Shortlist suggérée : les mieux classées parmi les idées dont Camille a validé la note.
 * Une note seulement proposée par l'IA n'envoie jamais une idée devant le jury.
 */
export function suggestShortlist(ranked: RankedIdea[], size = SHORTLIST_SIZE): RankedIdea[] {
  return ranked.filter((idea) => idea.statut === 'validee').slice(0, size)
}

/** Répartition d'une sélection (par thème, par direction) pour juger de sa variété. */
export function countBy<T>(items: T[], keyOf: (item: T) => string | null): { cle: string; nombre: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item) ?? 'Non renseigné'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .map(([cle, nombre]) => ({ cle, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.cle.localeCompare(b.cle))
}
