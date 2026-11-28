import postgres from 'postgres';

let override = null;
let client = null;

/** Tests inject an in-memory Postgres here. Must return an array of rows. */
export function setDb(fn) {
  override = fn;
}

// Works with Supabase's transaction pooler (port 6543): no prepared statements, one connection per instance.
export async function query(text, params = []) {
  if (override) return override(text, params);
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  client ??= postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
  });
  return client.unsafe(text, params);
}
