import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (f) => readFileSync(new URL(`../db/${f}`, import.meta.url), 'utf8');

test('the restricted role can use the admin tables and nothing else', async () => {
  const pg = new PGlite();
  await pg.exec(sql('schema.sql'));
  await pg.exec('create table public.other_app (id int, secret text); insert into public.other_app values (1, \'x\');');
  await pg.exec(sql('app-role.sql'));
  await pg.exec(sql('app-role.sql')); // idempotent

  await pg.exec('set role agape_admin_app');
  await pg.query(`insert into agape_admin.settings_versions (page, status, data, created_by) values ('pro','published','{}'::jsonb,'t')`);
  const ok = await pg.query('select count(*)::int as n from agape_admin.settings_versions');
  assert.equal(ok.rows[0].n, 1);
  await pg.query(`insert into agape_admin.otp_codes (email, code_hash, expires_at) values ('a','b', now())`);
  await pg.query(`insert into agape_admin.sessions (token_hash, email, expires_at) values ('h','a', now())`);
  await assert.rejects(pg.query('select * from public.other_app'), /permission denied/);
  await pg.exec('reset role');
  await pg.close();
});
