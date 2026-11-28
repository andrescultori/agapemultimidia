-- Least-privilege database login for the admin API: it can touch ONLY the four agape_admin tables.
-- Created without a password (it cannot log in yet). Set the password yourself in the SQL editor, never in chat or in the repo:
--   alter role agape_admin_app with password '<long random password>';
-- Pooler username for DATABASE_URL: agape_admin_app.<project-ref>

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agape_admin_app') then
    create role agape_admin_app login noinherit;
  end if;
end $$;

grant usage on schema agape_admin to agape_admin_app;
grant select, insert, update, delete on all tables in schema agape_admin to agape_admin_app;
grant usage, select on all sequences in schema agape_admin to agape_admin_app;

-- RLS is enabled on these tables with no policies for anyone else; this role gets explicit full access to these four only.
do $$
declare t text;
begin
  foreach t in array array['otp_codes', 'sessions', 'settings_versions', 'admins'] loop
    -- Skip a table that does not exist yet (an older database before db/migrations/2026-11-28-admins.sql).
    if to_regclass(format('agape_admin.%I', t)) is not null
       and not exists (select 1 from pg_policies where schemaname = 'agape_admin' and tablename = t and policyname = 'app_full_access') then
      execute format('create policy app_full_access on agape_admin.%I for all to agape_admin_app using (true) with check (true)', t);
    end if;
  end loop;
end $$;
