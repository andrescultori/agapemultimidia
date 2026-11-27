-- Admin settings schema (Neon Postgres). Run once in the Neon SQL editor, or via `psql "$DATABASE_URL" -f db/schema.sql`.
-- Access is only through the server-side connection string in Vercel functions. RLS is enabled with no policies,
-- so any non-owner role (for example one used by a future client SDK) can read nothing by default.

create table if not exists otp_codes (
  id          bigserial primary key,
  email       text        not null,
  code_hash   text        not null,
  ip_hash     text,
  attempts    int         not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists otp_codes_email_created on otp_codes (email, created_at desc);
create index if not exists otp_codes_ip_created on otp_codes (ip_hash, created_at desc);

create table if not exists sessions (
  token_hash  text primary key,
  email       text        not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- One row per saved version. 'published' rows are the history (the newest is live); at most one 'draft' per page.
create table if not exists settings_versions (
  id          bigserial primary key,
  page        text        not null,
  status      text        not null check (status in ('draft', 'published')),
  data        jsonb       not null,
  created_by  text        not null,
  created_at  timestamptz not null default now(),
  note        text
);
create unique index if not exists settings_one_draft on settings_versions (page) where status = 'draft';
create index if not exists settings_published on settings_versions (page, id desc) where status = 'published';

alter table otp_codes         enable row level security;
alter table sessions          enable row level security;
alter table settings_versions enable row level security;
