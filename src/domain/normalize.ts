// Normalisation des champs saisis librement dans le formulaire.
// Règle commune : ce qu'on ne sait pas lire devient null (et l'idée est marquée
// "à compléter"), on ne devine jamais une valeur.

const NO_VALUE = /^[\s?\-–—]*$/

export function cleanText(raw: string | undefined | null): string | null {
  const text = (raw ?? '').trim()
  return NO_VALUE.test(text) ? null : text
}

/**
 * Date de dépôt vers le format ISO (AAAA-MM-JJ).
 * Deux formats sont acceptés : ISO, et JJ/MM/AAAA. Pour ce second format on lit le jour
 * en premier : l'export vient d'un formulaire français (03/10/2026 = 3 octobre).
 */
export function parseDate(raw: string | undefined | null): string | null {
  const text = cleanText(raw)
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : french
      ? [Number(french[3]), Number(french[2]), Number(french[1])]
      : [NaN, NaN, NaN]

  // Date.UTC accepte le 31 février et le décale en mars : on vérifie l'aller-retour.
  const date = new Date(Date.UTC(year, month - 1, day))
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return isReal ? date.toISOString().slice(0, 10) : null
}

/**
 * Budget saisi librement vers un montant en euros.
 * Lit le premier nombre du champ, avec ses séparateurs de milliers (espace, espace
 * insécable, point), une virgule décimale et un suffixe k ou M :
 * "40 000 €", "15k€", "35k", "30 000 euros", "80 000 € (déplacement des machines)", "0".
 * Un champ vide ou "?" donne null : budget inconnu, ce qui n'est pas un budget de 0 €.
 */
export function parseBudget(raw: string | undefined | null): number | null {
  const text = cleanText(raw)
  if (!text) return null

  const match = /^(\d[\d\s\u00a0\u202f.]*(?:,\d+)?)\s*(k|m)?(?![a-zà-ÿ])/i.exec(text)
  if (!match) return null

  let digits = match[1].replace(/[\s\u00a0\u202f]/g, '')
  // "40.000" : points de milliers. "1.5" : point décimal.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(digits)) digits = digits.replaceAll('.', '')
  const value = Number(digits.replace(',', '.'))
  if (!Number.isFinite(value)) return null

  const suffix = match[2]?.toLowerCase()
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1
  return Math.round(value * multiplier)
}
