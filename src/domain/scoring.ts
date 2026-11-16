import { CRITERIA, MAX_SCORE, MIN_SCORE, type CriterionKey } from './criteria'
import type { Idea } from './importIdeas'

// Notation d'une idée sur la grille du client. L'IA propose, Camille valide ou corrige.
// Tout modèle, simulé ou réel, passe par l'interface Scorer : brancher un vrai modèle
// revient à ajouter une implémentation, sans toucher au reste de l'outil.

export type Scores = Record<CriterionKey, number>

export type ScoreProposal = {
  scores: Scores
  /** Une phrase par critère : c'est elle qui permet à Camille de corriger vite. */
  justifications: Record<CriterionKey, string>
}

/**
 * Ce qu'un modèle a le droit de voir d'une idée. Ni prénom, ni nom, ni direction, ni site :
 * la note ne doit dépendre que du contenu, et aucune donnée personnelle ne part vers un
 * fournisseur d'IA.
 */
export type ScoringInput = Pick<Idea, 'titre' | 'description' | 'benefices' | 'theme' | 'budgetEuros'>

export function toScoringInput(idea: Idea): ScoringInput {
  const { titre, description, benefices, theme, budgetEuros } = idea
  return { titre, description, benefices, theme, budgetEuros }
}

export interface Scorer {
  score(input: ScoringInput): Promise<ScoreProposal>
}

/**
 * Contrôle la réponse d'un modèle avant de l'afficher : 4 notes entières de 1 à 5 et une
 * justification par critère. Un vrai modèle peut répondre n'importe quoi, y compris parce
 * que le texte d'une idée cherche à l'influencer : on ne fait confiance qu'à ce format.
 */
export function parseProposal(raw: unknown): ScoreProposal {
  const candidate = raw as Partial<ScoreProposal> | null
  const scores = {} as Scores
  const justifications = {} as Record<CriterionKey, string>

  for (const { key, label } of CRITERIA) {
    const score = candidate?.scores?.[key]
    if (typeof score !== 'number' || !Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
      throw new Error(`Note invalide pour le critère « ${label} » : ${JSON.stringify(score)}.`)
    }
    const justification = candidate?.justifications?.[key]
    if (typeof justification !== 'string' || !justification.trim()) {
      throw new Error(`Justification manquante pour le critère « ${label} ».`)
    }
    scores[key] = score
    justifications[key] = justification.trim()
  }
  return { scores, justifications }
}
