import { describe, expect, it } from 'vitest'
import hexaviaCsv from '../../data/idees_hexavia.csv?raw'
import { findDuplicatePairs, groupDuplicates, tokenize } from './duplicates'
import { importIdeas, type Idea } from './importIdeas'

const idea = (id: string, titre: string, description: string | null = null): Idea => ({
  id, titre, description,
  dateDepot: null, prenom: null, nom: null, direction: null, site: null, theme: null,
  benefices: null, budgetSaisi: null, budgetEuros: null, manques: [],
})

describe("doublons de l'export Hexavia", () => {
  const pairs = findDuplicatePairs(importIdeas(hexaviaCsv).ideas)
  const scoreOf = (a: string, b: string) => pairs.find((pair) => pair.a === a && pair.b === b)?.score

  it('donne 1 à la copie exacte (IDEA-002 déposée deux fois)', () => {
    expect(scoreOf('IDEA-002', 'IDEA-014')).toBe(1)
  })

  it.each([
    ['IDEA-001', 'IDEA-007', 'capteurs sur les compresseurs'],
    ['IDEA-003', 'IDEA-019', 'assistant RH, formulé "chatbot" et "robot"'],
    ['IDEA-017', 'IDEA-018', 'rapports dictés, formulé "compte rendu"'],
  ])('propose %s et %s (%s)', (a, b) => {
    expect(scoreOf(a, b)).toBeGreaterThan(0)
  })

  it('ne noie pas Camille : 5 propositions sur 780 paires possibles', () => {
    expect(pairs.map((pair) => `${pair.a}/${pair.b}`).sort()).toEqual([
      'IDEA-001/IDEA-007',
      'IDEA-002/IDEA-014',
      'IDEA-003/IDEA-019',
      'IDEA-008/IDEA-027', // covoiturage domicile-travail et inter-sites : voisines, pas doublons
      'IDEA-017/IDEA-018',
    ])
  })

  it('ne classe jamais la paire voisine devant un vrai doublon', () => {
    const neighbour = scoreOf('IDEA-008', 'IDEA-027')!
    const real = pairs.filter((pair) => pair.a !== 'IDEA-008').map((pair) => pair.score)
    expect(neighbour).toBeLessThanOrEqual(Math.min(...real))
  })

  it('montre les mots communs pour justifier la proposition', () => {
    const pair = pairs.find((p) => p.a === 'IDEA-001' && p.b === 'IDEA-007')!
    expect(pair.motsCommuns).toEqual(expect.arrayContaining(['capteur', 'compresseur']))
  })
})

describe('findDuplicatePairs', () => {
  it('ignore la casse, les accents et les pluriels', () => {
    const pairs = findDuplicatePairs([
      idea('A', 'Récupération de chaleur des fours'),
      idea('B', 'RECUPERATION DE LA CHALEUR DU FOUR'),
      idea('C', 'Parrainage des nouveaux arrivants'),
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toMatchObject({ a: 'A', b: 'B', score: 1 })
  })

  it('ne propose rien quand les idées n’ont rien en commun, ni sur un lot vide', () => {
    expect(findDuplicatePairs([idea('A', 'Ombrières solaires'), idea('B', 'Kanban digital')])).toEqual([])
    expect(findDuplicatePairs([])).toEqual([])
  })

  it('supporte une idée sans description', () => {
    expect(() => findDuplicatePairs([idea('A', 'Café gratuit'), idea('B', 'Café gratuit', null)])).not.toThrow()
  })
})

describe('tokenize', () => {
  it('retire les mots vides et rapproche les synonymes', () => {
    expect(tokenize('Un chatbot pour les comptes rendus')).toEqual(['assistant', 'rapport'])
  })
})

describe('groupDuplicates', () => {
  it('réunit les paires qui se touchent en un seul groupe', () => {
    const groups = groupDuplicates([
      { a: 'IDEA-003', b: 'IDEA-019' },
      { a: 'IDEA-019', b: 'IDEA-030' },
      { a: 'IDEA-001', b: 'IDEA-007' },
    ])
    expect(groups).toEqual([
      ['IDEA-001', 'IDEA-007'],
      ['IDEA-003', 'IDEA-019', 'IDEA-030'],
    ])
  })

  it('rend une liste vide sans paire confirmée', () => {
    expect(groupDuplicates([])).toEqual([])
  })
})
