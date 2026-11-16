// La grille de notation du client : 4 critères, chacun noté de 1 à 5.
// Les poids sont portés par le challenge pour que l'outil serve à d'autres clients ;
// par défaut ils sont égaux, faute d'indication de Camille sur une pondération.

export const CRITERIA = [
  { key: 'impact', label: "Impact pour l'entreprise" },
  { key: 'faisabilite', label: 'Faisabilité' },
  { key: 'alignement', label: 'Alignement avec la stratégie' },
  { key: 'innovation', label: 'Caractère innovant' },
] as const

export type CriterionKey = (typeof CRITERIA)[number]['key']

export type Weights = Record<CriterionKey, number>

export const DEFAULT_WEIGHTS: Weights = {
  impact: 1,
  faisabilite: 1,
  alignement: 1,
  innovation: 1,
}

export const MIN_SCORE = 1
export const MAX_SCORE = 5
