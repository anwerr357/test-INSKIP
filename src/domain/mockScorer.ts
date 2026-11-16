import { MAX_SCORE, MIN_SCORE } from './criteria'
import { tokenize } from './duplicates'
import { parseProposal, type ScoreProposal, type Scorer, type ScoringInput } from './scoring'

// Modèle simulé : des règles simples et lisibles à la place d'un appel à une IA.
// Deux propriétés comptent plus que la finesse des notes :
// - déterministe : la même idée reçoit toujours la même note (c'est le problème de
//   cohérence de Camille), et les tests peuvent vérifier les résultats ;
// - la longueur du texte ne rapporte rien : une idée bien rédigée n'est pas une idée
//   meilleure. On regarde ce qui est dit (un gain chiffré, un budget), pas combien.

const clamp = (score: number) => Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(score)))

// Un gain chiffré : "15 %", "3 jours", "20 k€", "45 minutes", "divisé par deux".
const QUANTIFIED = /\d+\s*(%|k€|€|euros?|jours?|heures?|minutes?|mois|postes?)|divis|doubl|moitié/i

// Les listes sont écrites en mots courants puis passées par tokenize(), pour être réduites
// aux mêmes radicaux que le texte des idées.
const lexicon = (words: string) => tokenize(words)

// Enjeux lourds pour un industriel : arrêts, pannes, accidents, coûts, revenus.
const HIGH_STAKES = lexicon('arrêt panne accident coût revenu facture production stock rupture')

const NOVEL = lexicon('IA prédictive twin augmentée exosquelette capteur caméra céramique modèle')
const COMMONPLACE = lexicon('café parrainage enquête wifi covoiturage tri horaire vidéo')

const formatEuros = (amount: number) => `${amount.toLocaleString('fr-FR')} €`

export class MockScorer implements Scorer {
  async score(input: ScoringInput): Promise<ScoreProposal> {
    const words = new Set(tokenize([input.titre, input.description, input.benefices].join(' ')))
    const has = (stems: string[]) => stems.filter((stem) => words.has(stem))

    // parseProposal en sortie : le modèle simulé respecte le même contrat qu'un vrai.
    return parseProposal({
      scores: {
        impact: this.impact(input, has).score,
        faisabilite: this.feasibility(input).score,
        alignement: this.alignment(input).score,
        innovation: this.innovation(has).score,
      },
      justifications: {
        impact: this.impact(input, has).why,
        faisabilite: this.feasibility(input).why,
        alignement: this.alignment(input).why,
        innovation: this.innovation(has).why,
      },
    })
  }

  private impact(input: ScoringInput, has: (stems: string[]) => string[]) {
    if (!input.benefices) {
      return { score: 2, why: 'Aucun bénéfice attendu renseigné : note prudente, à revoir avec l’auteur.' }
    }
    const quantified = QUANTIFIED.test(input.benefices)
    const stakes = has(HIGH_STAKES).length > 0
    const score = clamp(2 + (quantified ? 2 : 0) + (stakes ? 1 : 0))
    const parts = [
      quantified ? 'Le gain annoncé est chiffré' : 'Le gain annoncé n’est pas chiffré',
      stakes ? 'et touche un enjeu lourd (production, coûts ou sécurité).' : 'et reste éloigné des enjeux de production ou de coûts.',
    ]
    return { score, why: parts.join(' ') }
  }

  private feasibility({ budgetEuros }: ScoringInput) {
    if (budgetEuros === null) {
      return { score: 3, why: 'Budget non renseigné : note neutre, à préciser avant le jury.' }
    }
    const [score, level] =
      budgetEuros <= 10_000 ? [5, 'très faible']
      : budgetEuros <= 30_000 ? [4, 'modéré']
      : budgetEuros <= 80_000 ? [3, 'significatif']
      : budgetEuros <= 200_000 ? [2, 'élevé']
      : [1, 'très élevé']
    return { score, why: `Budget estimé à ${formatEuros(budgetEuros)}, soit un investissement ${level}.` }
  }

  // La stratégie d'Hexavia n'est pas fournie. Hypothèse : les thèmes du formulaire sont ses
  // axes. Faute de mieux, le modèle simulé reste au milieu de l'échelle et le dit.
  private alignment({ theme }: ScoringInput) {
    return theme
      ? { score: 3, why: `Rattachée au thème « ${theme} » du challenge. Note neutre : à ajuster selon les priorités stratégiques du client.` }
      : { score: 2, why: 'Aucun thème du challenge choisi par l’auteur : rattachement à la stratégie à vérifier.' }
  }

  private innovation(has: (stems: string[]) => string[]) {
    const novel = has(NOVEL).length > 0
    const commonplace = has(COMMONPLACE).length > 0
    if (novel && !commonplace) return { score: 4, why: 'S’appuie sur une technologie encore peu répandue dans l’industrie.' }
    if (commonplace && !novel) return { score: 2, why: 'Pratique déjà courante dans beaucoup d’entreprises.' }
    return { score: 3, why: 'Amélioration utile de l’existant, sans rupture technologique.' }
  }
}
