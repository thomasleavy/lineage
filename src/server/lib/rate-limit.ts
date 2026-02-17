// In-memory rate limit for dev. For production, use Upstash Redis or similar.
const store = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_EXPORT_PER_MINUTE = 5;

function getKey(prefix: string, id: string) {
  return `${prefix}:${id}`;
}

function getOrCreate(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.resetAt > now) return entry;
  const newEntry = { count: 0, resetAt: now + windowMs };
  store.set(key, newEntry);
  return newEntry;
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const key = getKey('login', ip);
  const entry = getOrCreate(key, WINDOW_MS);
  entry.count++;
  const allowed = entry.count <= MAX_LOGIN_ATTEMPTS;
  return { allowed, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - entry.count) };
}

export function checkExportRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const key = getKey('export', userId);
  const entry = getOrCreate(key, WINDOW_MS);
  entry.count++;
  const allowed = entry.count <= MAX_EXPORT_PER_MINUTE;
  return { allowed, remaining: Math.max(0, MAX_EXPORT_PER_MINUTE - entry.count) };
}
