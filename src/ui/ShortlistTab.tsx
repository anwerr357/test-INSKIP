import { useState } from 'react'
import { CRITERIA } from '../domain/criteria'
import { shortlistToCsv } from '../domain/exportShortlist'
import { countBy, SHORTLIST_SIZE } from '../domain/ranking'
import type { StoredIdea } from '../data/store'
import { authorOf, formatBudget, formatTotal, NOT_PROVIDED } from './format'
import type { IdeaRow } from './IdeasTab'

type Props = {
  challengeName: string
  /** Idées retenues, dans l'ordre du classement. */
  shortlist: IdeaRow[]
  /** Idées validées et classées, non retenues. */
  candidates: IdeaRow[]
  /** Nombre d'idées que l'outil peut proposer (8 au plus, moins si peu de notes sont validées). */
  suggestionSize: number
  onToggle: (idea: StoredIdea, shortlisted: boolean) => Promise<void>
  onSuggest: () => Promise<void>
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ShortlistTab({ challengeName, shortlist, candidates, suggestionSize, onToggle, onSuggest }: Props) {
  const [withAuthors, setWithAuthors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Date du document, fixée à l'ouverture de l'onglet.
  const [today] = useState(() => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.")
    } finally {
      setBusy(false)
    }
  }

  function suggest() {
    const replace =
      shortlist.length === 0 ||
      window.confirm(`Remplacer votre sélection actuelle (${shortlist.length} idées) par les ${suggestionSize} idées validées les mieux notées ?`)
    if (replace) void run(onSuggest)
  }

  if (shortlist.length === 0 && candidates.length === 0) {
    return (
      <div className="card empty">
        <p><strong>La shortlist se construit à partir des notes que vous avez validées.</strong></p>
        <p className="muted">
          Aucune note n'est encore validée. Ouvrez une idée dans l'onglet Idées, relisez la note proposée, puis validez-la.
        </p>
      </div>
    )
  }

  const items = shortlist.map(({ idea, score, total }) => ({ idea, scores: score.scores, total }))

  return (
    <div className="shortlist">
      <section className="no-print">
        <p className="lead">
          {shortlist.length === 0
            ? `Aucune idée retenue pour l'instant. Tamis peut proposer les ${suggestionSize} idées validées les mieux notées, que vous ajustez ensuite.`
            : `${shortlist.length} ${shortlist.length > 1 ? 'idées retenues' : 'idée retenue'} pour le jury (objectif : environ ${SHORTLIST_SIZE}).`}
        </p>
        {error && <p role="alert" className="alert">{error}</p>}

        <div className="actions">
          <button type="button" className={`button ${shortlist.length === 0 ? 'primary' : ''}`} disabled={busy || suggestionSize === 0} onClick={suggest}>
            {shortlist.length === 0 ? `Proposer les ${suggestionSize} meilleures idées validées` : 'Repartir de la proposition de Tamis'}
          </button>
          {shortlist.length > 0 && (
            <>
              <button type="button" className="button primary" onClick={() => window.print()}>
                Imprimer ou enregistrer en PDF
              </button>
              <button
                type="button"
                className="button"
                onClick={() => download(`shortlist-${challengeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, shortlistToCsv(items, { withAuthors }))}
              >
                Télécharger pour Excel (CSV)
              </button>
              <label className="checkbox">
                <input type="checkbox" checked={withAuthors} onChange={(event) => setWithAuthors(event.target.checked)} />
                <span>Inclure le nom des auteurs</span>
              </label>
            </>
          )}
        </div>

        {shortlist.length > 0 && (
          <div className="distribution card">
            <Distribution title="Par thème" counts={countBy(shortlist, (row) => row.idea.theme)} />
            <Distribution title="Par direction" counts={countBy(shortlist, (row) => row.idea.direction)} />
            <Distribution title="Par site" counts={countBy(shortlist, (row) => row.idea.site)} />
          </div>
        )}
      </section>

      {shortlist.length > 0 && (
        <article className="card client-doc">
          <header>
            <p className="muted small">Document pour le client · {today}</p>
            <h2>{challengeName} : shortlist proposée au jury</h2>
            <p className="muted">
              {shortlist.length} idées, classées par note globale. Chaque idée est notée de 1 à 5 sur les quatre critères de la grille.
            </p>
          </header>

          <ol className="client-list">
            {shortlist.map(({ idea, score, total }) => (
              <li key={idea.id}>
                <div className="client-item-header">
                  <h3>{idea.titre}</h3>
                  <p className="total"><strong>{formatTotal(total)}</strong> / 20</p>
                </div>
                <p className="muted small">
                  {idea.id} · {idea.theme ?? NOT_PROVIDED} · {idea.direction ?? NOT_PROVIDED} · {idea.site ?? NOT_PROVIDED} · Budget : {formatBudget(idea)}
                  {withAuthors && ` · ${authorOf(idea)}`}
                </p>
                <p>{idea.description}</p>
                {idea.benefices && <p><strong>Bénéfices attendus : </strong>{idea.benefices}</p>}
                <p className="client-scores">
                  {CRITERIA.map(({ key, label }) => (
                    <span key={key}>{label} : <strong>{score.scores[key]}</strong>/5</span>
                  ))}
                </p>
                <button type="button" className="link no-print" disabled={busy} onClick={() => run(() => onToggle(idea, false))}>
                  Retirer de la shortlist
                </button>
              </li>
            ))}
          </ol>
        </article>
      )}

      {candidates.length > 0 && (
        <section className="no-print">
          <h2 className="section-title">Autres idées validées</h2>
          <div className="card table-wrap">
            <table>
              <tbody>
                {candidates.map(({ idea, total, rang }) => (
                  <tr key={idea.id} className="static">
                    <td className="num">{rang}</td>
                    <td><span className="ref">{idea.id}</span> <strong>{idea.titre}</strong></td>
                    <td className="optional">{idea.theme ?? NOT_PROVIDED}</td>
                    <td className="num"><strong>{formatTotal(total)}</strong> / 20</td>
                    <td className="num">
                      <button type="button" className="button" disabled={busy} onClick={() => run(() => onToggle(idea, true))}>
                        Ajouter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Distribution({ title, counts }: { title: string; counts: { cle: string; nombre: number }[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <p>
        {counts.map(({ cle, nombre }) => (
          <span key={cle} className="badge neutral">{cle} : {nombre}</span>
        ))}
      </p>
    </div>
  )
}
