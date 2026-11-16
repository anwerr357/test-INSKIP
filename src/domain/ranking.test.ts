import { describe, expect, it } from 'vitest'
import { countBy, rankIdeas, suggestShortlist, totalOn20, type ScoredIdea } from './ranking'
import type { Scores } from './scoring'

const scores = (impact: number, faisabilite: number, alignement: number, innovation: number): Scores => ({
  impact, faisabilite, alignement, innovation,
})
const idea = (id: string, s: Scores, statut: ScoredIdea['statut'] = 'validee'): ScoredIdea => ({ id, scores: s, statut })

describe('totalOn20', () => {
  it('vaut la somme des 4 notes quand les poids sont égaux', () => {
    expect(totalOn20(scores(4, 5, 4, 2))).toBe(15)
    expect(totalOn20(scores(1, 1, 1, 1))).toBe(4)
    expect(totalOn20(scores(5, 5, 5, 5))).toBe(20)
  })

  it('applique les poids du challenge', () => {
    const weights = { impact: 3, faisabilite: 1, alignement: 1, innovation: 1 }
    // (5×3 + 1 + 1 + 1) / 6 = 3 sur 5, soit 12 sur 20
    expect(totalOn20(scores(5, 1, 1, 1), weights)).toBe(12)
  })

  it('ignore un critère de poids zéro', () => {
    const weights = { impact: 1, faisabilite: 1, alignement: 1, innovation: 0 }
    expect(totalOn20(scores(5, 5, 5, 1), weights)).toBe(20)
  })

  it('refuse une grille dont tous les poids sont à zéro', () => {
    expect(() => totalOn20(scores(3, 3, 3, 3), { impact: 0, faisabilite: 0, alignement: 0, innovation: 0 })).toThrow()
  })
})

describe('rankIdeas', () => {
  it('classe par note globale décroissante et numérote les rangs', () => {
    const ranked = rankIdeas([idea('A', scores(2, 2, 2, 2)), idea('B', scores(5, 5, 5, 5)), idea('C', scores(3, 3, 3, 3))])
    expect(ranked.map((r) => [r.id, r.rang, r.total])).toEqual([['B', 1, 20], ['C', 2, 12], ['A', 3, 8]])
  })

  it('départage par l’impact, puis la faisabilité, puis l’identifiant', () => {
    const ranked = rankIdeas([
      idea('D', scores(3, 4, 3, 4)),
      idea('C', scores(3, 4, 4, 3)),
      idea('B', scores(4, 2, 4, 4)),
      idea('A', scores(4, 3, 4, 3)),
    ])
    expect(ranked.map((r) => r.id)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('change le classement quand les poids changent', () => {
    const ideas = [idea('Impact', scores(5, 1, 3, 3)), idea('Facile', scores(1, 5, 3, 4))]
    expect(rankIdeas(ideas)[0].id).toBe('Facile')
    expect(rankIdeas(ideas, { impact: 3, faisabilite: 1, alignement: 1, innovation: 1 })[0].id).toBe('Impact')
  })

  it('ne classe que la mieux notée d’un groupe de doublons confirmés', () => {
    const ranked = rankIdeas(
      [idea('IDEA-003', scores(2, 4, 3, 4)), idea('IDEA-019', scores(2, 3, 3, 3)), idea('IDEA-037', scores(5, 5, 3, 3))],
      undefined,
      [['IDEA-003', 'IDEA-019']],
    )
    expect(ranked.map((r) => r.id)).toEqual(['IDEA-037', 'IDEA-003'])
    expect(ranked.map((r) => r.rang)).toEqual([1, 2])
  })

  it('rend une liste vide sans idée', () => {
    expect(rankIdeas([])).toEqual([])
  })
})

describe('suggestShortlist', () => {
  const ranked = rankIdeas(
    Array.from({ length: 12 }, (_, i) => idea(`IDEA-${String(i + 1).padStart(3, '0')}`, scores(5, 5, 5, 5), i < 10 ? 'validee' : 'proposee')),
  )

  it('propose 8 idées par défaut', () => {
    expect(suggestShortlist(ranked)).toHaveLength(8)
  })

  it('écarte une idée dont la note n’a pas été validée par Camille, même très bien notée', () => {
    const list = suggestShortlist(rankIdeas([idea('IA', scores(5, 5, 5, 5), 'proposee'), idea('Camille', scores(2, 2, 2, 2))]))
    expect(list.map((r) => r.id)).toEqual(['Camille'])
  })

  it('rend moins de 8 idées quand trop peu sont validées, et aucune au départ', () => {
    expect(suggestShortlist(ranked.slice(0, 3))).toHaveLength(3)
    expect(suggestShortlist(rankIdeas([idea('A', scores(5, 5, 5, 5), 'proposee')]))).toEqual([])
  })
})

describe('countBy', () => {
  it('compte par valeur, la plus fréquente d’abord, et nomme les valeurs absentes', () => {
    const themes = [{ theme: 'Digital' }, { theme: 'Sécurité' }, { theme: 'Digital' }, { theme: null }]
    expect(countBy(themes, (item) => item.theme)).toEqual([
      { cle: 'Digital', nombre: 2 },
      { cle: 'Non renseigné', nombre: 1 },
      { cle: 'Sécurité', nombre: 1 },
    ])
  })
})
