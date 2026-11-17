import { DEFAULT_WEIGHTS, type Weights } from '../domain/criteria'
import type { Idea, MissingField } from '../domain/importIdeas'
import type { ScoreStatus } from '../domain/ranking'
import type { ScoreProposal } from '../domain/scoring'
import { supabase } from '../lib/supabase'

// Seul fichier qui parle à Supabase. Le reste de l'application manipule les types du
// domaine (Idea, ScoreProposal) et ignore les noms de colonnes.

export type StoredIdea = Idea & {
  dbId: string
  shortlist: boolean
  /** Remarques personnelles de Camille. Jamais exportées, jamais envoyées au modèle. */
  remarque: string
}
export type IdeaScore = ScoreProposal & { statut: ScoreStatus }
export type Decision = 'confirmee' | 'ecartee'

export type Workspace = {
  challenge: { id: string; nom: string; poids: Weights }
  ideas: StoredIdea[]
  /** Notes par identifiant d'idée (IDEA-001). */
  scores: Record<string, IdeaScore>
  /** Décisions sur les doublons, par clé de paire (voir pairKey). */
  decisions: Record<string, Decision>
}

export const pairKey = (a: string, b: string) => `${a}|${b}`

/** Erreur dont le message peut être montré tel quel à l'utilisatrice. */
export class StoreError extends Error {}

function db() {
  if (!supabase) {
    throw new StoreError(
      "L'outil n'est pas configuré : l'adresse et la clé publique Supabase sont absentes. Voir le fichier .env.example.",
    )
  }
  return supabase
}

// Le détail technique part dans la console, l'utilisatrice reçoit une phrase qu'elle comprend.
function check<T>(result: { data: T; error: unknown }, message: string): T {
  if (result.error) {
    console.error(message, result.error)
    throw new StoreError(`${message} Vérifiez votre connexion internet, puis réessayez.`)
  }
  return result.data
}

/** Vrai si ce navigateur a déjà une session ouverte. */
export async function hasSession(): Promise<boolean> {
  const { data } = await db().auth.getSession()
  return data.session !== null
}

/**
 * Connexion par e-mail et mot de passe. Les comptes sont créés par l'administrateur dans
 * Supabase : l'outil ne propose ni inscription ni mot de passe oublié.
 */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await db().auth.signInWithPassword({ email, password })
  if (!error) return
  console.error(error)
  // 400 : identifiants refusés. Tout le reste est un problème de réseau ou de service.
  throw new StoreError(
    error.status === 400
      ? 'E-mail ou mot de passe incorrect.'
      : 'La connexion a échoué. Vérifiez votre connexion internet, puis réessayez.',
  )
}

export async function signOut(): Promise<void> {
  // scope local : ferme la session de ce navigateur, pas celles des autres appareils.
  await db().auth.signOut({ scope: 'local' })
}

type IdeaRow = {
  id: string
  ref: string
  date_depot: string | null
  prenom: string | null
  nom: string | null
  direction: string | null
  site: string | null
  theme: string | null
  titre: string
  description: string | null
  benefices: string | null
  budget_saisi: string | null
  budget_euros: number | null
  manques: MissingField[]
  shortlist: boolean
  remarque: string | null
  scores: ScoreRow | ScoreRow[] | null
}

type ScoreRow = {
  impact: number
  faisabilite: number
  alignement: number
  innovation: number
  justifications: ScoreProposal['justifications']
  statut: ScoreStatus
}

function toIdeaRow(idea: Idea, challengeId: string) {
  return {
    challenge_id: challengeId,
    ref: idea.id,
    date_depot: idea.dateDepot,
    prenom: idea.prenom,
    nom: idea.nom,
    direction: idea.direction,
    site: idea.site,
    theme: idea.theme,
    titre: idea.titre,
    description: idea.description,
    benefices: idea.benefices,
    budget_saisi: idea.budgetSaisi,
    budget_euros: idea.budgetEuros,
    manques: idea.manques,
  }
}

function fromIdeaRow(row: IdeaRow): StoredIdea {
  return {
    dbId: row.id,
    id: row.ref,
    dateDepot: row.date_depot,
    prenom: row.prenom,
    nom: row.nom,
    direction: row.direction,
    site: row.site,
    theme: row.theme,
    titre: row.titre,
    description: row.description,
    benefices: row.benefices,
    budgetSaisi: row.budget_saisi,
    budgetEuros: row.budget_euros,
    manques: row.manques,
    shortlist: row.shortlist,
    remarque: row.remarque ?? '',
  }
}

function toScoreRow(ideaDbId: string, score: IdeaScore) {
  return { idea_id: ideaDbId, ...score.scores, justifications: score.justifications, statut: score.statut }
}

function fromScoreRow({ justifications, statut, ...scores }: ScoreRow): IdeaScore {
  return { scores, justifications, statut }
}

/** Le dernier challenge importé dans ce navigateur, ou null s'il n'y en a pas encore. */
export async function loadWorkspace(): Promise<Workspace | null> {
  const message = 'Le chargement de vos idées a échoué.'
  const challenges = check(
    await db().from('challenges').select('id, nom, poids').order('created_at', { ascending: false }).limit(1),
    message,
  )
  const challenge = challenges?.[0]
  if (!challenge) return null

  const rows = check(
    await db().from('ideas').select('*, scores(*)').eq('challenge_id', challenge.id).order('ref'),
    message,
  ) as IdeaRow[]
  const pairs = check(
    await db().from('duplicate_pairs').select('ref_a, ref_b, decision').eq('challenge_id', challenge.id),
    message,
  ) as { ref_a: string; ref_b: string; decision: Decision }[]

  const scores: Workspace['scores'] = {}
  for (const row of rows) {
    const score = Array.isArray(row.scores) ? row.scores[0] : row.scores
    if (score) scores[row.ref] = fromScoreRow(score)
  }

  return {
    challenge: { id: challenge.id, nom: challenge.nom, poids: { ...DEFAULT_WEIGHTS, ...challenge.poids } },
    ideas: rows.map(fromIdeaRow),
    scores,
    decisions: Object.fromEntries(pairs.map((pair) => [pairKey(pair.ref_a, pair.ref_b), pair.decision])),
  }
}

/** Enregistre un challenge importé : les idées, puis la note proposée pour chacune. */
export async function createWorkspace(nom: string, ideas: Idea[], proposals: ScoreProposal[]): Promise<void> {
  const message = "L'enregistrement des idées a échoué."
  const challenge = check(
    await db().from('challenges').insert({ nom, poids: DEFAULT_WEIGHTS }).select('id').single(),
    message,
  ) as { id: string }

  try {
    const rows = check(
      await db().from('ideas').insert(ideas.map((idea) => toIdeaRow(idea, challenge.id))).select('id, ref'),
      message,
    ) as { id: string; ref: string }[]
    const dbIdOf = new Map(rows.map((row) => [row.ref, row.id]))
    check(
      await db()
        .from('scores')
        .insert(ideas.map((idea, index) => toScoreRow(dbIdOf.get(idea.id)!, { ...proposals[index], statut: 'proposee' }))),
      message,
    )
  } catch (error) {
    // Pas de challenge à moitié importé : on retire ce qui a été écrit (suppression en cascade).
    await db().from('challenges').delete().eq('id', challenge.id)
    throw error
  }
}

export async function saveScore(ideaDbId: string, score: IdeaScore): Promise<void> {
  check(
    await db().from('scores').upsert({ ...toScoreRow(ideaDbId, score), updated_at: new Date().toISOString() }),
    "L'enregistrement de la note a échoué.",
  )
}

export async function saveDecision(challengeId: string, a: string, b: string, decision: Decision): Promise<void> {
  check(
    await db().from('duplicate_pairs').upsert({ challenge_id: challengeId, ref_a: a, ref_b: b, decision }),
    "L'enregistrement de votre décision a échoué.",
  )
}

export async function saveRemark(ideaDbId: string, remarque: string): Promise<void> {
  check(
    await db().from('ideas').update({ remarque: remarque.trim() || null }).eq('id', ideaDbId),
    "L'enregistrement de vos remarques a échoué.",
  )
}

export async function setShortlisted(ideaDbId: string, shortlisted: boolean): Promise<void> {
  check(
    await db().from('ideas').update({ shortlist: shortlisted }).eq('id', ideaDbId),
    "L'enregistrement de la shortlist a échoué.",
  )
}

/** Remplace toute la shortlist du challenge par les idées données. */
export async function replaceShortlist(challengeId: string, ideaDbIds: string[]): Promise<void> {
  const message = "L'enregistrement de la shortlist a échoué."
  check(await db().from('ideas').update({ shortlist: false }).eq('challenge_id', challengeId).eq('shortlist', true), message)
  if (ideaDbIds.length > 0) {
    check(await db().from('ideas').update({ shortlist: true }).in('id', ideaDbIds), message)
  }
}

export async function deleteWorkspace(challengeId: string): Promise<void> {
  check(await db().from('challenges').delete().eq('id', challengeId), 'La suppression a échoué.')
}
