import postgres from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';

let override = null;
let shared = null;
const requestScope = new AsyncLocalStorage();

/** Tests inject an in-memory Postgres here. Must return an array of rows. */
export function setDb(fn) {
  override = fn;
}

function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // Works with Supabase's transaction pooler (port 6543): no prepared statements, one connection per client.
  return postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
  });
}

/**
 * Runs `fn` with a database client that lives only for this call and is closed afterwards.
 * Required on Cloudflare Workers, where a connection cannot be reused by a different request.
 * On Node/Vercel the handlers run without it and share one client per instance.
 */
export async function withRequestDb(fn) {
  const scope = { client: null };
  try {
    return await requestScope.run(scope, fn);
  } finally {
    if (scope.client) await scope.client.end({ timeout: 2 }).catch(() => {});
  }
}

export async function query(text, params = []) {
  if (override) return override(text, params);
  const scope = requestScope.getStore();
  if (scope) return (scope.client ??= connect()).unsafe(text, params);
  return (shared ??= connect()).unsafe(text, params);
}
