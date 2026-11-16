import { describe, expect, it } from 'vitest'
import hexaviaCsv from '../../data/idees_hexavia.csv?raw'
import { ImportError, importIdeas } from './importIdeas'

const HEADER = 'id;date_depot;prenom;nom;direction;site;theme;titre;description;benefices_attendus;budget_estime'
const row = (id: string, titre = 'Une idée') => `${id};2026-09-15;A;B;RH;Lyon;Process;${titre};Texte;Gain;10 000 €`

describe("import de l'export Hexavia", () => {
  const { ideas, rejets } = importIdeas(hexaviaCsv)
  const byId = (id: string) => ideas.find((idea) => idea.id === id)!

  it('lit les 40 idées sans en rejeter', () => {
    expect(ideas).toHaveLength(40)
    expect(rejets).toEqual([])
    expect(ideas[0].id).toBe('IDEA-001') // le BOM en tête de fichier ne casse pas la colonne id
    expect(ideas[39].id).toBe('IDEA-040')
  })

  it('conserve les accents', () => {
    expect(byId('IDEA-005').prenom).toBe('Émilie')
    expect(byId('IDEA-001').theme).toBe('Énergie')
  })

  it('ramène toutes les dates au format ISO', () => {
    expect(byId('IDEA-033').dateDepot).toBe('2026-10-03')
    expect(ideas.every((idea) => /^\d{4}-\d{2}-\d{2}$/.test(idea.dateDepot ?? ''))).toBe(true)
  })

  it('normalise les budgets saisis librement', () => {
    expect(byId('IDEA-001').budgetEuros).toBe(40_000)
    expect(byId('IDEA-002').budgetEuros).toBe(15_000) // "15k€"
    expect(byId('IDEA-003').budgetEuros).toBe(30_000) // "30 000 euros"
    expect(byId('IDEA-017').budgetEuros).toBe(35_000) // "35k"
    expect(byId('IDEA-023').budgetEuros).toBe(80_000) // montant suivi d'un commentaire
    expect(byId('IDEA-011').budgetEuros).toBe(0)
    expect(byId('IDEA-010').budgetEuros).toBeNull() // "?"
    expect(byId('IDEA-010').budgetSaisi).toBeNull()
    expect(byId('IDEA-023').budgetSaisi).toContain('déplacement')
  })

  it('signale les champs manquants sans rejeter l’idée', () => {
    expect(byId('IDEA-015').manques).toEqual(['theme', 'budget'])
    expect(byId('IDEA-019').manques).toEqual(['benefices', 'budget'])
    expect(byId('IDEA-029').manques).toEqual(['theme', 'budget'])
    expect(byId('IDEA-040').manques).toEqual(['site'])
    expect(byId('IDEA-001').manques).toEqual([])
  })

  it('repère les 8 idées à compléter', () => {
    const incomplete = ideas.filter((idea) => idea.manques.length > 0).map((idea) => idea.id)
    expect(incomplete).toEqual([
      'IDEA-007', 'IDEA-010', 'IDEA-015', 'IDEA-018', 'IDEA-019',
      'IDEA-029', 'IDEA-039', 'IDEA-040',
    ])
  })
})

describe('import : fichiers imparfaits', () => {
  it('accepte BOM, fins de ligne Windows et lignes vides', () => {
    const csv = `\uFEFF${HEADER}\r\n${row('IDEA-001')}\r\n\r\n;;;;;;;;;;\r\n`
    expect(importIdeas(csv).ideas).toHaveLength(1)
  })

  it('accepte un champ entre guillemets qui contient un point-virgule', () => {
    const csv = `${HEADER}\n${row('IDEA-001', '"Capteurs ; phase 1"')}`
    expect(importIdeas(csv).ideas[0].titre).toBe('Capteurs ; phase 1')
  })

  it('rejette une ligne sans titre ou en double, avec son numéro de ligne', () => {
    const csv = [HEADER, row('IDEA-001'), row('IDEA-002', ''), row('IDEA-001')].join('\n')
    const { ideas, rejets } = importIdeas(csv)
    expect(ideas.map((idea) => idea.id)).toEqual(['IDEA-001'])
    expect(rejets).toEqual([
      { ligne: 3, raison: "L'idée IDEA-002 n'a pas de titre." },
      { ligne: 4, raison: "L'identifiant IDEA-001 apparaît déjà plus haut dans le fichier." },
    ])
  })

  it('explique quelles colonnes manquent', () => {
    expect(() => importIdeas('id;titre\nIDEA-001;Une idée')).toThrow(ImportError)
    expect(() => importIdeas('id;titre\nIDEA-001;Une idée')).toThrow(/il manque les colonnes date_depot, prenom/)
  })

  it('refuse un fichier vide ou sans idée', () => {
    expect(() => importIdeas('')).toThrow('Le fichier est vide.')
    expect(() => importIdeas(HEADER)).toThrow("Aucune idée n'a pu être lue dans ce fichier.")
  })
})
