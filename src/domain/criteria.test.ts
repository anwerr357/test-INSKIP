import { describe, expect, it } from 'vitest'
import { CRITERIA, DEFAULT_WEIGHTS } from './criteria'

describe('grille de notation', () => {
  it('contient les 4 critères du client', () => {
    expect(CRITERIA.map((c) => c.key)).toEqual(['impact', 'faisabilite', 'alignement', 'innovation'])
  })

  it('pondère les critères à égalité par défaut', () => {
    expect(new Set(Object.values(DEFAULT_WEIGHTS)).size).toBe(1)
    expect(Object.keys(DEFAULT_WEIGHTS)).toHaveLength(CRITERIA.length)
  })
})
