import { useMemo, useState } from 'react'
import type { Weights } from '../domain/criteria'
import type { IdeaScore, StoredIdea } from '../data/store'
import { formatBudget, formatTotal, NOT_PROVIDED } from './format'
import { ScorePanel } from './ScorePanel'

export type IdeaRow = {
  idea: StoredIdea
  score: IdeaScore
  total: number
  /** null pour un doublon confirmé, qui n'est pas classé séparément. */
  rang: number | null
  duplicateOf: string | null
  /** Les doublons confirmés que cette idée représente dans le classement. */
  regroupe: string[]
  /** Les idées avec lesquelles un doublon est proposé et pas encore tranché. */
  doublonPossibleAvec: string[]
}

// Un doublon confirmé n'est pas classé : sa note n'a pas besoin d'être relue.
const toValidate = (row: IdeaRow) => row.score.statut === 'proposee' && row.duplicateOf === null

type Props = {
  rows: IdeaRow[]
  weights: Weights
  onSave: (idea: StoredIdea, score: IdeaScore) => Promise<void>
  onSaveRemark: (idea: StoredIdea, remarque: string) => Promise<void>
}

const NO_FILTERS = { direction: '', theme: '', site: '', statut: '', incomplete: false, search: '' }

const optionsOf = (rows: IdeaRow[], valueOf: (idea: StoredIdea) => string | null) =>
  [...new Set(rows.map(({ idea }) => valueOf(idea) ?? NOT_PROVIDED))].sort((a, b) => a.localeCompare(b, 'fr'))

export function IdeasTab({ rows, weights, onSave, onSaveRemark }: Props) {
  const [filters, setFilters] = useState(NO_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return rows.filter((row) => {
      const { idea, score } = row
      if (filters.direction && (idea.direction ?? NOT_PROVIDED) !== filters.direction) return false
      if (filters.theme && (idea.theme ?? NOT_PROVIDED) !== filters.theme) return false
      if (filters.site && (idea.site ?? NOT_PROVIDED) !== filters.site) return false
      if (filters.statut === 'proposee' && !toValidate(row)) return false
      if (filters.statut === 'validee' && score.statut !== 'validee') return false
      if (filters.incomplete && idea.manques.length === 0) return false
      if (search && !`${idea.id} ${idea.titre} ${idea.description ?? ''}`.toLowerCase().includes(search)) return false
      return true
    })
  }, [rows, filters])

  const selected = rows.find(({ idea }) => idea.id === selectedId) ?? null
  const filtering = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  // L'idée suivante à relire : la prochaine non validée dans la liste affichée, en
  // repartant du début si besoin.
  function nextToValidate(fromId: string): string | null {
    const start = visible.findIndex(({ idea }) => idea.id === fromId)
    const ordered = [...visible.slice(start + 1), ...visible.slice(0, Math.max(start, 0))]
    return ordered.find((row) => row.idea.id !== fromId && toValidate(row))?.idea.id ?? null
  }

  const select = (label: string, key: 'direction' | 'theme' | 'site', valueOf: (idea: StoredIdea) => string | null) => (
    <label className="field">
      <span>{label}</span>
      <select value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}>
        <option value="">Toutes</option>
        {optionsOf(rows, valueOf).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className={`ideas ${selected ? 'with-panel' : ''}`}>
      <section>
        <form className="filters card" onSubmit={(event) => event.preventDefault()}>
          <label className="field grow">
            <span>Rechercher</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Un mot du titre ou de la description"
            />
          </label>
          {select('Direction', 'direction', (idea) => idea.direction)}
          {select('Thème', 'theme', (idea) => idea.theme)}
          {select('Site', 'site', (idea) => idea.site)}
          <label className="field">
            <span>Notation</span>
            <select value={filters.statut} onChange={(event) => setFilters({ ...filters, statut: event.target.value })}>
              <option value="">Toutes</option>
              <option value="proposee">À valider</option>
              <option value="validee">Validées</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={filters.incomplete}
              onChange={(event) => setFilters({ ...filters, incomplete: event.target.checked })}
            />
            <span>À compléter seulement</span>
          </label>
        </form>

        <p className="muted small count" role="status">
          {visible.length} {visible.length > 1 ? 'idées affichées' : 'idée affichée'} sur {rows.length}, classées par note
          globale.
          {filtering && (
            <button type="button" className="link" onClick={() => setFilters(NO_FILTERS)}>
              Effacer les filtres
            </button>
          )}
        </p>

        {visible.length === 0 ? (
          <div className="card empty">
            <p><strong>Aucune idée ne correspond à ces filtres.</strong></p>
            <p className="muted">Élargissez votre recherche ou revenez à la liste complète.</p>
            <button type="button" className="button" onClick={() => setFilters(NO_FILTERS)}>
              Afficher toutes les idées
            </button>
          </div>
        ) : (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="num">Rang</th>
                  <th scope="col">Idée</th>
                  <th scope="col" className="optional">Direction</th>
                  <th scope="col" className="optional">Thème</th>
                  <th scope="col" className="num optional">Budget</th>
                  <th scope="col" className="num">Note / 20</th>
                  <th scope="col">Notation</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ idea, score, total, rang, duplicateOf, regroupe, doublonPossibleAvec }) => (
                  <tr key={idea.id} className={idea.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(idea.id)}>
                    <td className="num">{rang ?? '-'}</td>
                    <td>
                      <button type="button" className="row-title" onClick={() => setSelectedId(idea.id)}>
                        <span className="ref">{idea.id}</span> {idea.titre}
                      </button>
                      {idea.manques.length > 0 && <span className="badge warning">À compléter</span>}
                      {duplicateOf && <span className="badge">Doublon de {duplicateOf}</span>}
                      {regroupe.length > 0 && <span className="badge">Regroupe {regroupe.join(', ')}</span>}
                      {doublonPossibleAvec.length > 0 && <span className="badge warning">Doublon possible</span>}
                      {idea.remarque && <span className="badge neutral">Remarque</span>}
                    </td>
                    <td className="optional">{idea.direction ?? <span className="muted">{NOT_PROVIDED}</span>}</td>
                    <td className="optional">{idea.theme ?? <span className="muted">{NOT_PROVIDED}</span>}</td>
                    <td className="num optional">{idea.budgetEuros === null ? <span className="muted">{NOT_PROVIDED}</span> : formatBudget(idea)}</td>
                    <td className="num"><strong>{formatTotal(total)}</strong></td>
                    <td>
                      <span className={`badge ${score.statut === 'validee' ? 'success' : 'neutral'}`}>
                        {score.statut === 'validee' ? 'Validée' : duplicateOf ? 'Non classée' : 'À valider'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <ScorePanel
          key={selected.idea.id}
          idea={selected.idea}
          score={selected.score}
          weights={weights}
          duplicateOf={selected.duplicateOf}
          regroupe={selected.regroupe}
          doublonPossibleAvec={selected.doublonPossibleAvec}
          hasNext={nextToValidate(selected.idea.id) !== null}
          onClose={() => setSelectedId(null)}
          onSaveRemark={(remarque) => onSaveRemark(selected.idea, remarque)}
          onSave={async (score, goNext) => {
            const next = goNext ? nextToValidate(selected.idea.id) : null
            await onSave(selected.idea, score)
            if (next) setSelectedId(next)
          }}
        />
      )}
    </div>
  )
}
