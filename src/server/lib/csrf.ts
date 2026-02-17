import { randomBytes } from 'crypto';
import { authConfig } from '~/server/auth/config';

export const CSRF_COOKIE_NAME = 'lineage_csrf';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Build Set-Cookie value for CSRF token (readable by JS for double-submit).
 */
export function csrfCookieHeader(value: string, maxAgeSeconds: number = authConfig.sessionMaxAgeSeconds): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${CSRF_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

/**
 * Parse cookie header and return value for a given name.
 */
export function getCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!.trim()) : null;
}

/**
 * Validate CSRF: header X-CSRF-Token must match cookie lineage_csrf.
 */
export function validateCsrf(cookieHeader: string | null, csrfHeader: string | null): boolean {
  const cookieToken = getCookieFromHeader(cookieHeader, CSRF_COOKIE_NAME);
  if (!cookieToken || !csrfHeader || csrfHeader.length < 16) return false;
  return cookieToken === csrfHeader;
}
