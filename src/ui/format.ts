import type { Idea, MissingField } from '../domain/importIdeas'

export const formatEuros = (amount: number) => `${amount.toLocaleString('fr-FR')} €`

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatTotal = (total: number) => total.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

export const formatBudget = (idea: Idea) => (idea.budgetEuros === null ? 'Non renseigné' : formatEuros(idea.budgetEuros))

export const authorOf = (idea: Idea) => [idea.prenom, idea.nom].filter(Boolean).join(' ') || 'Auteur non renseigné'

export const MISSING_LABELS: Record<MissingField, string> = {
  date: 'date de dépôt',
  direction: 'direction',
  site: 'site',
  theme: 'thème',
  description: 'description',
  benefices: 'bénéfices attendus',
  budget: 'budget',
}

export const NOT_PROVIDED = 'Non renseigné'
