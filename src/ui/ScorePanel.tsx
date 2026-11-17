import { useState } from 'react'
import { CRITERIA, MAX_SCORE, MIN_SCORE, type CriterionKey, type Weights } from '../domain/criteria'
import { totalOn20 } from '../domain/ranking'
import type { IdeaScore, StoredIdea } from '../data/store'
import { authorOf, formatDate, formatEuros, formatTotal, MISSING_LABELS, NOT_PROVIDED } from './format'

type Props = {
  idea: StoredIdea
  score: IdeaScore
  weights: Weights
  /** Renseigné quand l'idée est un doublon confirmé d'une autre, mieux notée. */
  duplicateOf: string | null
  regroupe: string[]
  doublonPossibleAvec: string[]
  hasNext: boolean
  onSave: (score: IdeaScore, goNext: boolean) => Promise<void>
  onSaveRemark: (remarque: string) => Promise<void>
  onClose: () => void
}

const SCALE = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, index) => MIN_SCORE + index)

// Le parent monte ce composant avec key={idea.id} : le brouillon repart de la note
// enregistrée à chaque changement d'idée, sans effet à synchroniser.
export function ScorePanel({ idea, score, weights, duplicateOf, regroupe, doublonPossibleAvec, hasNext, onSave, onSaveRemark, onClose }: Props) {
  const [draft, setDraft] = useState(score.scores)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remark, setRemark] = useState(idea.remarque)
  const [remarkState, setRemarkState] = useState<'idle' | 'saving' | 'error'>('idle')

  const changed = CRITERIA.some(({ key }) => draft[key] !== score.scores[key])
  const validated = score.statut === 'validee'

  async function save(goNext: boolean) {
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...score, scores: draft, statut: 'validee' }, goNext)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.")
    } finally {
      setSaving(false)
    }
  }

  async function saveRemark() {
    setRemarkState('saving')
    try {
      await onSaveRemark(remark)
      setRemarkState('idle')
    } catch {
      setRemarkState('error')
    }
  }

  return (
    <aside className="panel card" aria-label={`Idée ${idea.id}`}>
      <header className="panel-header">
        <div>
          <p className="ref">{idea.id}</p>
          <h2>{idea.titre}</h2>
        </div>
        <button type="button" className="button ghost" onClick={onClose} aria-label="Fermer la fiche">
          Fermer
        </button>
      </header>

      <dl className="meta">
        <div><dt>Auteur</dt><dd>{authorOf(idea)}</dd></div>
        <div><dt>Direction</dt><dd>{idea.direction ?? NOT_PROVIDED}</dd></div>
        <div><dt>Site</dt><dd>{idea.site ?? NOT_PROVIDED}</dd></div>
        <div><dt>Thème</dt><dd>{idea.theme ?? NOT_PROVIDED}</dd></div>
        <div><dt>Déposée le</dt><dd>{idea.dateDepot ? formatDate(idea.dateDepot) : NOT_PROVIDED}</dd></div>
        <div>
          <dt>Budget</dt>
          <dd>
            {idea.budgetEuros === null ? NOT_PROVIDED : formatEuros(idea.budgetEuros)}
            {idea.budgetSaisi && <span className="muted small"> (saisi : « {idea.budgetSaisi} »)</span>}
          </dd>
        </div>
      </dl>

      {idea.manques.length > 0 && (
        <p className="notice warning">
          À compléter : {idea.manques.map((field) => MISSING_LABELS[field]).join(', ')}. La note proposée est prudente
          sur ces points.
        </p>
      )}
      {duplicateOf && (
        <p className="notice">
          Doublon confirmé de {duplicateOf}, mieux notée : cette idée n'est pas classée et sa note n'a pas besoin
          d'être validée.
        </p>
      )}
      {regroupe.length > 0 && (
        <p className="notice">Cette idée représente aussi {regroupe.join(', ')}, que vous avez confirmée comme doublon.</p>
      )}
      {doublonPossibleAvec.length > 0 && (
        <p className="notice warning">
          Doublon possible avec {doublonPossibleAvec.join(', ')}. À trancher dans l'onglet Doublons.
        </p>
      )}

      <h3>L'idée</h3>
      <p>{idea.description ?? <span className="muted">Aucune description.</span>}</p>
      <h3>Bénéfices attendus</h3>
      <p>{idea.benefices ?? <span className="muted">Non renseignés.</span>}</p>

      <h3>Mes remarques</h3>
      <div className="field remark">
        <textarea aria-label="Mes remarques" value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} maxLength={2000} />
      </div>
      <div className="actions remark-actions">
        <button type="button" className="button" disabled={remarkState === 'saving' || remark.trim() === idea.remarque} onClick={saveRemark}>
          {remarkState === 'saving' ? 'Enregistrement…' : 'Enregistrer mes remarques'}
        </button>
        {remarkState === 'idle' && idea.remarque && remark.trim() === idea.remarque && <span className="muted small">Enregistrées.</span>}
        {remarkState === 'error' && <span role="alert" className="alert-inline">L'enregistrement a échoué. Réessayez.</span>}
      </div>

      <h3>Notation</h3>
      <p className="muted small">
        {validated
          ? 'Vous avez validé cette note. Vous pouvez encore la corriger.'
          : "Note proposée par l'IA. Corrigez-la si besoin, puis validez-la."}
      </p>

      {CRITERIA.map(({ key, label }) => (
        <fieldset key={key} className="criterion">
          <legend>{label}</legend>
          <div className="scale">
            {SCALE.map((value) => (
              <button
                key={value}
                type="button"
                className={draft[key] === value ? 'selected' : ''}
                aria-pressed={draft[key] === value}
                aria-label={`${label} : ${value} sur ${MAX_SCORE}`}
                onClick={() => setDraft({ ...draft, [key as CriterionKey]: value })}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="justification">
            <span className="muted">Avis de l'IA{draft[key] !== score.scores[key] ? ` (elle proposait ${score.scores[key]})` : ''} : </span>
            {score.justifications[key]}
          </p>
        </fieldset>
      ))}

      <footer className="panel-footer">
        <p className="total">
          Note globale <strong>{formatTotal(totalOn20(draft, weights))}</strong> / 20
        </p>
        {error && <p role="alert" className="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="button primary" disabled={saving || (validated && !changed)} onClick={() => save(false)}>
            {saving ? 'Enregistrement…' : validated ? (changed ? 'Enregistrer la correction' : 'Note validée') : 'Valider cette note'}
          </button>
          {hasNext && (
            <button type="button" className="button" disabled={saving} onClick={() => save(true)}>
              Valider et passer à la suivante
            </button>
          )}
        </div>
      </footer>
    </aside>
  )
}
