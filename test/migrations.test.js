import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (f) => readFileSync(new URL(`../db/${f}`, import.meta.url), 'utf8');

test('2026-11-28-admins migration upgrades an existing database and is idempotent', async () => {
  const pg = new PGlite();
  await pg.exec(sql('schema.sql'));
  await pg.exec('drop table agape_admin.admins'); // what production looks like before this migration
  await pg.exec('create table public.other_app (id int, secret text); insert into public.other_app values (1, \'x\');');
  await pg.exec(sql('app-role.sql'));             // role and policies for the tables that exist (skips the missing one)

  await pg.exec(sql('migrations/2026-11-28-admins.sql'));
  await pg.exec(sql('migrations/2026-11-28-admins.sql')); // idempotent

  await pg.exec('set role agape_admin_app');
  const ins = await pg.query(`insert into agape_admin.admins (email, name, created_by) values ('a@b.com', 'A', 'x') returning id`);
  assert.ok(ins.rows[0].id > 0, 'sequence usable by the app role');
  await pg.query(`update agape_admin.admins set name = 'B' where id = $1`, [ins.rows[0].id]);
  assert.equal((await pg.query('select count(*)::int as n from agape_admin.admins')).rows[0].n, 1);
  await assert.rejects(pg.query(`insert into agape_admin.admins (email, created_by) values ('A@B.com', 'x')`), /duplicate key|unique/i, 'unique on lower(email)');
  await pg.query('delete from agape_admin.admins');
  await assert.rejects(pg.query('select * from public.other_app'), /permission denied/);
  await pg.exec('reset role');
  await pg.close();
});

test('a fresh install (schema.sql then app-role.sql) gives the app role the admins table too', async () => {
  const pg = new PGlite();
  await pg.exec(sql('schema.sql'));
  await pg.exec(sql('app-role.sql'));
  await pg.exec('set role agape_admin_app');
  await pg.query(`insert into agape_admin.admins (email, created_by) values ('a@b.com', 'x')`);
  assert.equal((await pg.query('select count(*)::int as n from agape_admin.admins')).rows[0].n, 1);
  await pg.exec('reset role');
  await pg.close();
});
