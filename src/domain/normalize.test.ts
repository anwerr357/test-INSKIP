import { describe, expect, it } from 'vitest'
import { cleanText, parseBudget, parseDate } from './normalize'

describe('parseBudget', () => {
  // Toutes les formes de saisie présentes dans l'export Hexavia.
  it.each([
    ['40 000 €', 40_000],
    ['15k€', 15_000],
    ['35k', 35_000],
    ['30 000 euros', 30_000],
    ['80 000 € (déplacement des machines et formation)', 80_000],
    ['0', 0],
    ['0 €', 0],
  ])('lit "%s"', (raw, expected) => {
    expect(parseBudget(raw)).toBe(expected)
  })

  it.each([
    ['40\u00a0000 €', 40_000], // espace insécable, fréquent dans les exports Excel
    ['40.000 €', 40_000],
    ['1,5 M€', 1_500_000],
    ['2.5k', 2_500],
  ])('lit aussi "%s"', (raw, expected) => {
    expect(parseBudget(raw)).toBe(expected)
  })

  it.each(['', '   ', '?', 'à définir', undefined, null])('rend null pour %j (budget inconnu)', (raw) => {
    expect(parseBudget(raw)).toBeNull()
  })

  it('ne confond pas budget inconnu et budget nul', () => {
    expect(parseBudget('0')).toBe(0)
    expect(parseBudget('?')).toBeNull()
  })

  it('ne prend pas la première lettre d’un mot pour un suffixe', () => {
    expect(parseBudget('6 machines')).toBe(6)
  })
})

describe('parseDate', () => {
  it('garde une date ISO', () => {
    expect(parseDate('2026-09-15')).toBe('2026-09-15')
  })

  it('lit JJ/MM/AAAA, jour en premier', () => {
    expect(parseDate('03/10/2026')).toBe('2026-10-03')
  })

  it.each(['', '31/02/2026', '2026-13-01', 'hier'])('rend null pour "%s"', (raw) => {
    expect(parseDate(raw)).toBeNull()
  })
})

describe('cleanText', () => {
  it('retire les espaces et traite "?" comme une absence', () => {
    expect(cleanText('  Lyon ')).toBe('Lyon')
    expect(cleanText('?')).toBeNull()
    expect(cleanText('')).toBeNull()
  })
})
