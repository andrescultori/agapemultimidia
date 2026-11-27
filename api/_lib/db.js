import { neon } from '@neondatabase/serverless';

let override = null;

/** Tests inject an in-memory Postgres here. Must return an array of rows. */
export function setDb(fn) {
  override = fn;
}

export async function query(text, params = []) {
  if (override) return override(text, params);
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  return sql.query(text, params);
}
