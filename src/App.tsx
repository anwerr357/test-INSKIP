import { useEffect, useMemo, useState } from 'react'
import {
  createWorkspace,
  deleteWorkspace,
  hasSession,
  loadWorkspace,
  pairKey,
  replaceShortlist,
  saveDecision,
  saveRemark,
  saveScore,
  setShortlisted,
  signIn,
  signOut,
  type Decision,
  type IdeaScore,
  type StoredIdea,
  type Workspace,
} from './data/store'
import { findDuplicatePairs, groupDuplicates, type DuplicatePair } from './domain/duplicates'
import { importIdeas, type RejectedRow } from './domain/importIdeas'
import { MockScorer } from './domain/mockScorer'
import { rankIdeas, suggestShortlist, totalOn20 } from './domain/ranking'
import { toScoringInput, type Scorer } from './domain/scoring'
import { DuplicatesTab } from './ui/DuplicatesTab'
import { IdeasTab, type IdeaRow } from './ui/IdeasTab'
import { ImportScreen } from './ui/ImportScreen'
import { LoginScreen } from './ui/LoginScreen'
import { ShortlistTab } from './ui/ShortlistTab'

// Le modèle de notation. Aujourd'hui simulé ; un vrai modèle se branche ici, derrière la
// même interface Scorer, sans toucher aux écrans.
const scorer: Scorer = new MockScorer()

type Boot =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'signedOut' }
  | { status: 'ready'; workspace: Workspace | null }

type Tab = 'idees' | 'doublons' | 'shortlist'

async function openWorkspace(): Promise<Boot> {
  try {
    if (!(await hasSession())) return { status: 'signedOut' }
    return { status: 'ready', workspace: await loadWorkspace() }
  } catch (cause) {
    return { status: 'error', message: cause instanceof Error ? cause.message : 'Une erreur inattendue est survenue.' }
  }
}

export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('idees')
  const [rejets, setRejets] = useState<RejectedRow[]>([])

  const load = () => openWorkspace().then(setBoot)

  useEffect(() => {
    void openWorkspace().then(setBoot)
  }, [])

  const workspace = boot.status === 'ready' ? boot.workspace : null
  const view = useWorkspaceView(workspace)

  // Chaque écriture est d'abord enregistrée en base, puis reportée à l'écran : ce que
  // Camille voit est toujours ce qui est sauvegardé.
  const update = (change: (workspace: Workspace) => Workspace) =>
    setBoot((current) =>
      current.status === 'ready' && current.workspace ? { ...current, workspace: change(current.workspace) } : current,
    )

  async function handleSignIn(email: string, password: string) {
    await signIn(email, password)
    await load()
  }

  async function handleSignOut() {
    await signOut()
    setRejets([])
    setBoot({ status: 'signedOut' })
  }

  async function handleImport(nom: string, csv: string) {
    const { ideas, rejets } = importIdeas(csv)
    const proposals = await Promise.all(ideas.map((idea) => scorer.score(toScoringInput(idea))))
    await createWorkspace(nom, ideas, proposals)
    setRejets(rejets)
    setTab('idees')
    await load()
  }

  async function handleSaveScore(idea: StoredIdea, score: IdeaScore) {
    await saveScore(idea.dbId, score)
    update((current) => ({ ...current, scores: { ...current.scores, [idea.id]: score } }))
  }

  async function handleSaveRemark(idea: StoredIdea, remarque: string) {
    await saveRemark(idea.dbId, remarque)
    update((current) => ({
      ...current,
      ideas: current.ideas.map((other) => (other.id === idea.id ? { ...other, remarque: remarque.trim() } : other)),
    }))
  }

  async function handleDecide(pair: DuplicatePair, decision: Decision) {
    if (!workspace) return
    await saveDecision(workspace.challenge.id, pair.a, pair.b, decision)
    update((current) => ({ ...current, decisions: { ...current.decisions, [pairKey(pair.a, pair.b)]: decision } }))
  }

  async function handleToggleShortlist(idea: StoredIdea, shortlisted: boolean) {
    await setShortlisted(idea.dbId, shortlisted)
    update((current) => ({
      ...current,
      ideas: current.ideas.map((other) => (other.id === idea.id ? { ...other, shortlist: shortlisted } : other)),
    }))
  }

  async function handleSuggestShortlist() {
    if (!workspace || !view) return
    const chosen = new Set(view.suggestion)
    await replaceShortlist(workspace.challenge.id, workspace.ideas.filter((idea) => chosen.has(idea.id)).map((idea) => idea.dbId))
    update((current) => ({ ...current, ideas: current.ideas.map((idea) => ({ ...idea, shortlist: chosen.has(idea.id) })) }))
  }

  async function handleDelete() {
    if (!workspace) return
    const confirmed = window.confirm(
      `Supprimer « ${workspace.challenge.nom} » ? Les ${workspace.ideas.length} idées et toutes vos notes seront effacées définitivement.`,
    )
    if (!confirmed) return
    try {
      await deleteWorkspace(workspace.challenge.id)
      setRejets([])
      await load()
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'La suppression a échoué.')
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <h1>Tamis</h1>
            <p>{workspace ? workspace.challenge.nom : 'Dépouillement des idées d’un challenge d’innovation'}</p>
          </div>
          {workspace && view && (
            <p className="progress" role="status">
              <strong>{view.validated}</strong> {view.validated > 1 ? 'notes validées' : 'note validée'} sur {view.toReview}
            </p>
          )}
          {boot.status === 'ready' && (
            <button type="button" className="button header-button" onClick={handleSignOut}>
              Se déconnecter
            </button>
          )}
        </div>
      </header>

      <main>
        {boot.status === 'loading' && <p role="status" className="muted">Ouverture de votre espace de travail…</p>}

        {boot.status === 'error' && (
          <div className="card empty">
            <p role="alert"><strong>{boot.message}</strong></p>
            <button type="button" className="button primary" onClick={() => { setBoot({ status: 'loading' }); void load() }}>
              Réessayer
            </button>
          </div>
        )}

        {boot.status === 'signedOut' && <LoginScreen onSignIn={handleSignIn} />}

        {boot.status === 'ready' && !workspace && <ImportScreen onImport={handleImport} />}

        {workspace && view && (
          <>
            {rejets.length > 0 && (
              <div className="notice warning">
                <p>
                  <strong>
                    {rejets.length} {rejets.length > 1 ? 'lignes du fichier n’ont pas pu être importées' : 'ligne du fichier n’a pas pu être importée'} :
                  </strong>
                </p>
                <ul>
                  {rejets.map((rejet) => (
                    <li key={rejet.ligne}>Ligne {rejet.ligne} : {rejet.raison}</li>
                  ))}
                </ul>
                <button type="button" className="link" onClick={() => setRejets([])}>J’ai compris</button>
              </div>
            )}

            <nav className="tabs" aria-label="Sections">
              <button type="button" className={tab === 'idees' ? 'active' : ''} aria-current={tab === 'idees'} onClick={() => setTab('idees')}>
                Idées <span className="pill">{workspace.ideas.length}</span>
              </button>
              <button type="button" className={tab === 'doublons' ? 'active' : ''} aria-current={tab === 'doublons'} onClick={() => setTab('doublons')}>
                Doublons {view.pendingPairs > 0 && <span className="pill attention">{view.pendingPairs} à examiner</span>}
              </button>
              <button type="button" className={tab === 'shortlist' ? 'active' : ''} aria-current={tab === 'shortlist'} onClick={() => setTab('shortlist')}>
                Shortlist <span className="pill">{view.shortlist.length}</span>
              </button>
              <button type="button" className="link danger" onClick={handleDelete}>
                Supprimer ce challenge
              </button>
            </nav>

            {tab === 'idees' && <IdeasTab rows={view.rows} weights={workspace.challenge.poids} onSave={handleSaveScore} onSaveRemark={handleSaveRemark} />}
            {tab === 'shortlist' && (
              <ShortlistTab
                challengeName={workspace.challenge.nom}
                shortlist={view.shortlist}
                candidates={view.candidates}
                suggestionSize={view.suggestion.length}
                onToggle={handleToggleShortlist}
                onSuggest={handleSuggestShortlist}
              />
            )}
            {tab === 'doublons' && (
              <DuplicatesTab pairs={view.pairs} ideasById={view.ideasById} decisions={workspace.decisions} onDecide={handleDecide} />
            )}
          </>
        )}
      </main>
    </>
  )
}

/** Tout ce qui se déduit des données enregistrées : doublons proposés, classement, compteurs. */
function useWorkspaceView(workspace: Workspace | null) {
  return useMemo(() => {
    if (!workspace) return null
    const { ideas, scores, decisions, challenge } = workspace

    const pairs = findDuplicatePairs(ideas)
    const confirmed = pairs.filter((pair) => decisions[pairKey(pair.a, pair.b)] === 'confirmee')
    const groups = groupDuplicates(confirmed)

    const scored = ideas.filter((idea) => scores[idea.id])
    const ranked = rankIdeas(
      scored.map((idea) => ({ id: idea.id, scores: scores[idea.id].scores, statut: scores[idea.id].statut })),
      challenge.poids,
      groups,
    )
    const rangOf = new Map(ranked.map((idea) => [idea.id, idea.rang]))
    // Pour un doublon écarté du classement : l'idée de son groupe qui, elle, est classée.
    const keptOf = new Map(groups.flatMap((group) => group.map((id) => [id, group.find((member) => rangOf.has(member))!] as const)))

    const pendingWith = new Map<string, string[]>()
    for (const pair of pairs) {
      if (decisions[pairKey(pair.a, pair.b)]) continue
      pendingWith.set(pair.a, [...(pendingWith.get(pair.a) ?? []), pair.b])
      pendingWith.set(pair.b, [...(pendingWith.get(pair.b) ?? []), pair.a])
    }

    const rows: IdeaRow[] = scored
      .map((idea) => {
        const rang = rangOf.get(idea.id) ?? null
        return {
          idea,
          score: scores[idea.id],
          total: totalOn20(scores[idea.id].scores, challenge.poids),
          rang,
          duplicateOf: rang === null ? (keptOf.get(idea.id) ?? null) : null,
          regroupe: rang === null ? [] : (groups.find((group) => group.includes(idea.id)) ?? []).filter((id) => id !== idea.id),
          doublonPossibleAvec: pendingWith.get(idea.id) ?? [],
        }
      })
      .sort((a, b) => (a.rang ?? Infinity) - (b.rang ?? Infinity) || a.idea.id.localeCompare(b.idea.id))

    // La shortlist ne contient que des idées classées dont Camille a validé la note.
    const eligible = rows.filter((row) => row.rang !== null && row.score.statut === 'validee')

    return {
      rows,
      shortlist: eligible.filter((row) => row.idea.shortlist),
      candidates: eligible.filter((row) => !row.idea.shortlist),
      suggestion: suggestShortlist(ranked).map((idea) => idea.id),
      pairs,
      ideasById: new Map(ideas.map((idea) => [idea.id, idea])),
      pendingPairs: pairs.filter((pair) => !decisions[pairKey(pair.a, pair.b)]).length,
      // Les doublons confirmés ne sont pas classés : ils ne comptent pas dans ce qui reste à relire.
      toReview: rows.filter((row) => row.duplicateOf === null).length,
      validated: rows.filter((row) => row.duplicateOf === null && row.score.statut === 'validee').length,
    }
  }, [workspace])
}
