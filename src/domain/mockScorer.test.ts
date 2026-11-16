import { describe, expect, it } from 'vitest'
import hexaviaCsv from '../../data/idees_hexavia.csv?raw'
import { CRITERIA } from './criteria'
import { importIdeas } from './importIdeas'
import { MockScorer } from './mockScorer'
import { toScoringInput, type ScoringInput } from './scoring'

const scorer = new MockScorer()
const ideas = importIdeas(hexaviaCsv).ideas
const scoreOf = (id: string) => scorer.score(toScoringInput(ideas.find((idea) => idea.id === id)!))

const input = (overrides: Partial<ScoringInput> = {}): ScoringInput => ({
  titre: 'Capteurs de vibration',
  description: 'Installer des capteurs sur les compresseurs.',
  benefices: 'Moins de pannes',
  theme: 'Énergie',
  budgetEuros: 40_000,
  ...overrides,
})

describe('MockScorer', () => {
  it('note les 40 idées avec 4 notes de 1 à 5 et une justification par critère', async () => {
    for (const idea of ideas) {
      const { scores, justifications } = await scorer.score(toScoringInput(idea))
      for (const { key } of CRITERIA) {
        expect(scores[key]).toBeGreaterThanOrEqual(1)
        expect(scores[key]).toBeLessThanOrEqual(5)
        expect(justifications[key].length).toBeGreaterThan(10)
      }
    }
  })

  it('est déterministe : la même idée reçoit toujours la même note', async () => {
    expect(await scoreOf('IDEA-023')).toEqual(await scoreOf('IDEA-023'))
  })

  it('note à l’identique deux idées identiques (IDEA-002 et sa copie IDEA-014)', async () => {
    expect(await scoreOf('IDEA-002')).toEqual(await scoreOf('IDEA-014'))
  })

  it('ne récompense pas la longueur du texte', async () => {
    const short = await scorer.score(input())
    const padded = await scorer.score(
      input({ description: `Installer des capteurs sur les compresseurs. ${'Il faut vraiment le faire bientôt. '.repeat(40)}` }),
    )
    expect(padded.scores).toEqual(short.scores)
  })

  it('note mieux un gain chiffré qu’un gain vague', async () => {
    const vague = await scorer.score(input({ benefices: 'Moins de pannes' }))
    const quantified = await scorer.score(input({ benefices: 'Moins de pannes, 3 jours de production gagnés par an' }))
    expect(quantified.scores.impact).toBeGreaterThan(vague.scores.impact)
  })

  it('fait baisser la faisabilité quand le budget monte', async () => {
    const budgets = [5_000, 25_000, 60_000, 150_000, 400_000]
    const scores = await Promise.all(budgets.map((budgetEuros) => scorer.score(input({ budgetEuros }))))
    expect(scores.map((proposal) => proposal.scores.faisabilite)).toEqual([5, 4, 3, 2, 1])
  })

  it('reste prudent et le dit quand une information manque', async () => {
    const { scores, justifications } = await scorer.score(input({ benefices: null, budgetEuros: null, theme: null }))
    expect(scores).toMatchObject({ impact: 2, faisabilite: 3, alignement: 2 })
    expect(justifications.impact).toContain('Aucun bénéfice')
    expect(justifications.faisabilite).toContain('Budget non renseigné')
    expect(justifications.alignement).toContain('Aucun thème')
  })

  it('ne confond pas budget nul et budget inconnu', async () => {
    expect((await scorer.score(input({ budgetEuros: 0 }))).scores.faisabilite).toBe(5)
    expect((await scorer.score(input({ budgetEuros: null }))).scores.faisabilite).toBe(3)
  })

  it('distingue une technologie nouvelle d’une pratique courante', async () => {
    expect((await scoreOf('IDEA-012')).scores.innovation).toBe(4) // réalité augmentée
    expect((await scoreOf('IDEA-015')).scores.innovation).toBe(2) // café gratuit
  })

  it('classe l’idée solide devant l’idée anecdotique', async () => {
    const sum = async (id: string) => Object.values((await scoreOf(id)).scores).reduce((a, b) => a + b, 0)
    expect(await sum('IDEA-037')).toBeGreaterThan(await sum('IDEA-015'))
  })
})
