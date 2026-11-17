import { useState } from 'react'
import type { DuplicatePair } from '../domain/duplicates'
import { pairKey, type Decision, type StoredIdea } from '../data/store'
import { authorOf, NOT_PROVIDED } from './format'

type Props = {
  pairs: DuplicatePair[]
  ideasById: Map<string, StoredIdea>
  decisions: Record<string, Decision>
  onDecide: (pair: DuplicatePair, decision: Decision) => Promise<void>
}

const DECISION_LABELS: Record<Decision, string> = {
  confirmee: 'Doublon confirmé',
  ecartee: 'Idées distinctes',
}

export function DuplicatesTab({ pairs, ideasById, decisions, onDecide }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (pairs.length === 0) {
    return (
      <div className="card empty">
        <p><strong>Aucun doublon probable dans ce challenge.</strong></p>
        <p className="muted">Tamis compare le titre et la description de chaque idée avec toutes les autres.</p>
      </div>
    )
  }

  async function decide(pair: DuplicatePair, decision: Decision) {
    const key = pairKey(pair.a, pair.b)
    setBusyKey(key)
    setError(null)
    try {
      await onDecide(pair, decision)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.")
    } finally {
      setBusyKey(null)
    }
  }

  const pending = pairs.filter((pair) => !decisions[pairKey(pair.a, pair.b)]).length

  return (
    <section>
      <p className="lead">
        {pending > 0
          ? `${pending} ${pending > 1 ? 'paires restent' : 'paire reste'} à examiner sur ${pairs.length}.`
          : `Vous avez examiné les ${pairs.length} paires proposées.`}{' '}
        Quand vous confirmez un doublon, seule l'idée la mieux notée des deux reste dans le classement.
      </p>
      {error && <p role="alert" className="alert">{error}</p>}

      {pairs.map((pair) => {
        const key = pairKey(pair.a, pair.b)
        const decision = decisions[key]
        return (
          <article key={key} className="card pair">
            <header className="pair-header">
              <p>
                <strong>Ressemblance : {Math.round(pair.score * 100)} %</strong>
                <span className="muted small"> · mots communs : {pair.motsCommuns.slice(0, 8).join(', ')}</span>
              </p>
              <span className={`badge ${decision === 'confirmee' ? 'success' : 'neutral'}`}>
                {decision ? DECISION_LABELS[decision] : 'À examiner'}
              </span>
            </header>

            <div className="pair-ideas">
              {[pair.a, pair.b].map((id) => {
                const idea = ideasById.get(id)!
                return (
                  <div key={id}>
                    <p className="ref">{idea.id}</p>
                    <h3>{idea.titre}</h3>
                    <p className="muted small">
                      {authorOf(idea)} · {idea.direction ?? NOT_PROVIDED} · {idea.site ?? NOT_PROVIDED}
                    </p>
                    <p>{idea.description ?? <span className="muted">Aucune description.</span>}</p>
                  </div>
                )
              })}
            </div>

            <div className="actions">
              <button
                type="button"
                className={`button ${decision === 'confirmee' ? 'primary' : ''}`}
                disabled={busyKey === key || decision === 'confirmee'}
                onClick={() => decide(pair, 'confirmee')}
              >
                C'est un doublon
              </button>
              <button
                type="button"
                className={`button ${decision === 'ecartee' ? 'primary' : ''}`}
                disabled={busyKey === key || decision === 'ecartee'}
                onClick={() => decide(pair, 'ecartee')}
              >
                Ce sont deux idées distinctes
              </button>
            </div>
          </article>
        )
      })}
    </section>
  )
}
