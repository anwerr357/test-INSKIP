import { useState, type FormEvent } from 'react'

type Props = {
  /** Rejette avec une erreur dont le message est affichable. */
  onSignIn: (email: string, password: string) => Promise<void>
}

export function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSignIn(email.trim(), password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La connexion a échoué.')
      setBusy(false)
    }
  }

  return (
    <form className="card login" onSubmit={handleSubmit}>
      <h2>Connexion</h2>
      <p className="lead">Les idées contiennent des noms de salariés : l'accès est réservé aux personnes qui ont un compte.</p>

      <label className="field">
        <span>E-mail</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required disabled={busy} />
      </label>
      <label className="field">
        <span>Mot de passe</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={busy} />
      </label>

      {error && <p role="alert" className="alert">{error}</p>}

      <div className="actions">
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
      <p className="muted small">Pas de compte ou mot de passe oublié ? Demandez à la personne qui vous a transmis ce lien.</p>
    </form>
  )
}
