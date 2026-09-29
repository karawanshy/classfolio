/** Trim and prepend https:// when no scheme was given. Returns '' for empty input. */
export function normalizeUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value.replace(/^\/+/, '')}`
}

/** Mirrors the DB check (http/https, ≤ 300 chars) plus a sanity check that it parses with a real host. */
export function isValidUrl(url: string): boolean {
  if (!url || url.length > 300 || !/^https?:\/\//i.test(url)) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('.') && !/\s/.test(url)
  } catch {
    return false
  }
}

/** The URL without its scheme or trailing slash, as shown in a card's host row. */
export function displayHost(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}
