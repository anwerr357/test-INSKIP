import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { shortlistToCsv, type ShortlistItem } from './exportShortlist'
import type { Idea } from './importIdeas'

const idea = (overrides: Partial<Idea> = {}): Idea => ({
  id: 'IDEA-037', titre: 'Mutualiser les transports', description: 'Regrouper les livraisons ; moins de camions.',
  benefices: 'Baisse des coûts de 12 %', theme: 'Process', direction: 'Supply chain', site: 'Metz',
  prenom: 'Alexandre', nom: 'Noël', dateDepot: '2026-10-09', budgetSaisi: '5 000 €', budgetEuros: 5000, manques: [],
  ...overrides,
})
const item = (overrides: Partial<Idea> = {}): ShortlistItem => ({
  idea: idea(overrides),
  scores: { impact: 5, faisabilite: 5, alignement: 3, innovation: 3 },
  total: 16,
})
const parse = (csv: string) => Papa.parse<Record<string, string>>(csv.slice(1), { header: true, delimiter: ';' }).data

describe('shortlistToCsv', () => {
  it('commence par un BOM et utilise le point-virgule, pour Excel', () => {
    const csv = shortlistToCsv([item()], { withAuthors: false })
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.split('\r\n')[0]).toContain('Rang;Identifiant;Titre;Thème')
  })

  it('n’exporte pas les noms des auteurs par défaut', () => {
    const csv = shortlistToCsv([item()], { withAuthors: false })
    expect(csv).not.toContain('Auteur')
    expect(csv).not.toContain('Alexandre')
    expect(csv).not.toContain('Noël')
  })

  it('exporte les auteurs quand Camille le demande', () => {
    expect(parse(shortlistToCsv([item()], { withAuthors: true }))[0].Auteur).toBe('Alexandre Noël')
  })

  it('numérote les idées dans l’ordre reçu et reprend notes et budget', () => {
    const [first, second] = parse(shortlistToCsv([item(), item({ id: 'IDEA-013', budgetEuros: null })], { withAuthors: false }))
    expect(first).toMatchObject({ Rang: '1', Identifiant: 'IDEA-037', 'Budget estimé (€)': '5000', 'Note globale (sur 20)': '16' })
    expect(first["Impact pour l'entreprise (sur 5)"]).toBe('5')
    expect(second).toMatchObject({ Rang: '2', Identifiant: 'IDEA-013', 'Budget estimé (€)': '' })
  })

  it('garde intact un texte qui contient un point-virgule ou des guillemets', () => {
    const [row] = parse(shortlistToCsv([item({ titre: 'Capteurs ; phase "pilote"' })], { withAuthors: false }))
    expect(row.Titre).toBe('Capteurs ; phase "pilote"')
    expect(row.Description).toBe('Regrouper les livraisons ; moins de camions.')
  })

  it('neutralise un texte qui serait lu comme une formule par Excel', () => {
    const [row] = parse(shortlistToCsv([item({ titre: '=HYPERLINK("http://exemple.test";"Cliquez")' })], { withAuthors: false }))
    expect(row.Titre.startsWith('=')).toBe(false)
  })

  it('rend un fichier sans ligne pour une shortlist vide', () => {
    expect(shortlistToCsv([], { withAuthors: false }).slice(1)).toBe('')
  })
})
