/**
 * Client-side: read CSRF token from cookie (lineage_csrf) for X-CSRF-Token header.
 * Cookie is set by server on login (not httpOnly) for double-submit pattern.
 */
const CSRF_COOKIE_NAME = 'lineage_csrf';

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + CSRF_COOKIE_NAME + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!.trim()) : null;
}

/**
 * Headers object with X-CSRF-Token for state-changing API calls (export, upload).
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-CSRF-Token'] = token;
  return headers;
}
