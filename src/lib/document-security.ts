const ALLOWED_DOCUMENT_HOSTS = new Set(['drive.google.com', 'docs.google.com'])

export function isAllowedDocumentUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_DOCUMENT_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}
