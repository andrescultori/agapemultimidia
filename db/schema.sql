-- Admin settings schema (Postgres: Supabase for now). Everything lives in its own schema, `agape_admin`, so it never mixes with
-- other apps in the same database and is not exposed through Supabase's REST API.
-- Run once in the SQL editor, or via `psql "$DATABASE_URL" -f db/schema.sql`.
-- Access is only through the server-side connection string. RLS is enabled with no policies and the API roles get no privileges.

create schema if not exists agape_admin;

create table if not exists agape_admin.otp_codes (
  id          bigserial primary key,
  email       text        not null,
  code_hash   text        not null,
  ip_hash     text,
  attempts    int         not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists otp_codes_email_created on agape_admin.otp_codes (email, created_at desc);
create index if not exists otp_codes_ip_created on agape_admin.otp_codes (ip_hash, created_at desc);

create table if not exists agape_admin.sessions (
  token_hash  text primary key,
  email       text        not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- One row per saved version. 'published' rows are the history (the newest is live); at most one 'draft' per page.
create table if not exists agape_admin.settings_versions (
  id          bigserial primary key,
  page        text        not null,
  status      text        not null check (status in ('draft', 'published')),
  data        jsonb       not null,
  created_by  text        not null,
  created_at  timestamptz not null default now(),
  note        text
);
create unique index if not exists settings_one_draft on agape_admin.settings_versions (page) where status = 'draft';
create index if not exists settings_published on agape_admin.settings_versions (page, id desc) where status = 'published';

alter table agape_admin.otp_codes         enable row level security;
alter table agape_admin.sessions          enable row level security;
alter table agape_admin.settings_versions enable row level security;

-- Supabase API roles must not see this schema (the roles do not exist on a plain Postgres, hence the guard).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema agape_admin from anon, authenticated;
    revoke all on all tables in schema agape_admin from anon, authenticated;
    revoke all on all sequences in schema agape_admin from anon, authenticated;
  end if;
end $$;
