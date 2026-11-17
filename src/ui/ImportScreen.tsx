import { useState, type ChangeEvent } from 'react'
import hexaviaCsv from '../../data/idees_hexavia.csv?raw'
import { decodeCsv } from '../domain/importIdeas'

type Props = {
  /** Rejette avec une erreur dont le message est affichable. */
  onImport: (nom: string, csv: string) => Promise<void>
}

export function ImportScreen({ onImport }: Props) {
  const [nom, setNom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(csv: string, defaultName: string) {
    setBusy(true)
    setError(null)
    try {
      await onImport(nom.trim() || defaultName, csv)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'import a échoué.")
      setBusy(false)
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permet de choisir à nouveau le même fichier après une erreur
    if (!file) return
    await run(decodeCsv(await file.arrayBuffer()), file.name.replace(/\.csv$/i, ''))
  }

  return (
    <section className="card import">
      <h2>Commencez par importer les idées</h2>
      <p className="lead">
        Importez l'export du formulaire du challenge. Tamis lit les idées, propose une première note pour chacune et
        repère les doublons probables. Vous gardez la main sur chaque note.
      </p>

      <ol className="steps">
        <li><strong>Importez</strong> le fichier CSV du formulaire.</li>
        <li><strong>Relisez</strong> les notes proposées, corrigez-les et validez-les.</li>
        <li><strong>Sortez</strong> la shortlist à envoyer au client.</li>
      </ol>

      <label className="field">
        <span>Nom du challenge (facultatif)</span>
        <input
          type="text"
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          placeholder="Par exemple : Challenge innovation Hexavia"
          disabled={busy}
        />
      </label>

      <div className="actions">
        <label className={`button primary ${busy ? 'disabled' : ''}`}>
          Choisir un fichier CSV
          <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy} hidden />
        </label>
        <button type="button" className="button" disabled={busy} onClick={() => run(hexaviaCsv, 'Challenge innovation Hexavia')}>
          Essayer avec l'exemple Hexavia (40 idées)
        </button>
      </div>

      {busy && <p role="status" className="muted">Lecture et notation des idées en cours…</p>}
      {error && <p role="alert" className="alert">{error}</p>}

      <p className="muted small">
        Vos idées sont enregistrées dans un espace que seul ce navigateur peut ouvrir. Les noms des auteurs ne sont
        jamais transmis à l'IA de notation.
      </p>
    </section>
  )
}
