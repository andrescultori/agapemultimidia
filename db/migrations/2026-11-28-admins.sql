-- Adds the admins table behind /admin/ > Administradores. Idempotent: safe to run more than once.
-- Run it in the Supabase SQL editor of the project that already has the agape_admin schema (requires db/app-role.sql to
-- have been applied before, because it grants the table to the restricted role agape_admin_app).
-- Until this runs, the admin keeps working with the ADMIN_EMAILS list only and the Administradores screen says it is off.

create table if not exists agape_admin.admins (
  id          bigserial primary key,
  email       text        not null,
  name        text,
  created_by  text        not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists admins_email_lower on agape_admin.admins (lower(email));

alter table agape_admin.admins enable row level security;

grant select, insert, update, delete on agape_admin.admins to agape_admin_app;
grant usage, select on sequence agape_admin.admins_id_seq to agape_admin_app;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'agape_admin' and tablename = 'admins' and policyname = 'app_full_access') then
    create policy app_full_access on agape_admin.admins for all to agape_admin_app using (true) with check (true);
  end if;
  -- Supabase API roles must not see the table (the roles do not exist on a plain Postgres, hence the guard).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on agape_admin.admins from anon, authenticated;
    revoke all on sequence agape_admin.admins_id_seq from anon, authenticated;
  end if;
end $$;
