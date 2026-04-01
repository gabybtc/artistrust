-- ============================================================
-- ArtisTrust — Supabase Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Artworks table
create table if not exists artworks (
  id           text primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  image_url    text not null,
  file_name    text default '',
  title        text default '',
  year         text default '',
  place        text default '',
  location     text default '',   -- physical storage location (studio, vault, home, etc.)
  width        text default '',
  height       text default '',
  unit         text default 'cm',
  material     text default '',
  media_type   text not null default 'painting',
  status       text default 'ready',
  uploaded_at  timestamptz default now(),
  ai_analysis  jsonb,
  voice_memo   text,
  created_at   timestamptz default now()
);

-- 2. Row Level Security — users can only access their own rows
alter table artworks enable row level security;

create policy "Users own their artworks"
  on artworks for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Index for faster per-user queries
create index if not exists artworks_user_id_idx on artworks(user_id);

-- 4. User settings table (legal designee, preferences, etc.)
create table if not exists user_settings (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  legal    jsonb default '{}'::jsonb,   -- LegalSettings object
  profile  jsonb default '{}'::jsonb,   -- ProfileSettings object
  tabs     jsonb default null,          -- Tab[] (custom catalogue categories)
  updated_at timestamptz default now()
);

-- Add tabs column if this table already existed before this migration
alter table user_settings add column if not exists tabs jsonb default null;

alter table user_settings enable row level security;

create policy "Users own their settings"
  on user_settings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Catalogue access grants (token-based shared read-only access)
create table if not exists catalogue_access (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users(id) on delete cascade not null,
  token        text unique not null default encode(gen_random_bytes(32), 'hex'),
  grantee_name text default '',
  grantee_email text default '',
  created_at   timestamptz default now(),
  last_accessed timestamptz
);

alter table catalogue_access enable row level security;

create policy "Owner manages their access grants"
  on catalogue_access for all
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index if not exists catalogue_access_owner_idx on catalogue_access(owner_id);
create index if not exists catalogue_access_token_idx on catalogue_access(token);

-- ============================================================
-- Migration: per-artwork public sharing
-- Run this if the artworks table already exists:
-- ============================================================
alter table artworks add column if not exists is_public boolean not null default false;
alter table artworks add column if not exists copyright_status text not null default 'automatic';
alter table artworks add column if not exists copyright_holder text not null default '';
alter table artworks add column if not exists copyright_year text not null default '';
alter table artworks add column if not exists copyright_reg_number text not null default '';

create index if not exists artworks_is_public_idx on artworks(is_public) where is_public = true;

-- ============================================================
-- Migration: smart cataloguing (EXIF data + series)
-- Run this if the artworks table already exists:
-- ============================================================
alter table artworks add column if not exists series    text default '';
alter table artworks add column if not exists exif_data jsonb;
alter table artworks add column if not exists tags      jsonb default '[]';

-- ============================================================
-- Storage bucket setup (do this in the Storage UI or here)
-- ============================================================

-- Run via Dashboard → Storage → New Bucket:
--   Name: artworks
--   Public: true (images are served by public URL)

-- Then add this storage policy so each user can only
-- read/write their own folder (userId/artworkId.ext):
insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict do nothing;

create policy "Users manage their own images"
  on storage.objects for all
  using (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Billing: subscriptions, beta_emails, legacy_upload_orders
-- ============================================================

-- Plan enum
do $$ begin
  create type plan_type as enum ('preserve', 'studio', 'archive', 'beta');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type billing_interval_type as enum ('monthly', 'annual');
exception when duplicate_object then null;
end $$;

-- Beta email allowlist — add tester emails here
create table if not exists beta_emails (
  email text primary key
);

-- Only accessible via service-role or security-definer functions (e.g. handle_new_user trigger)
alter table beta_emails enable row level security;

-- One subscription record per user
create table if not exists subscriptions (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  plan                  plan_type not null default 'preserve',
  billing_interval      billing_interval_type,
  stripe_customer_id    text,
  stripe_subscription_id text,
  current_period_end    timestamptz,
  is_beta               boolean not null default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table subscriptions enable row level security;

-- Users can read their own subscription; writes only via service-role (webhook)
create policy "Users read own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Legacy upload order tracking
create table if not exists legacy_upload_orders (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  stripe_payment_intent_id text,
  work_count_tier       text not null, -- '1-50', '51-200', '201-500', '501+'
  amount_cents          integer not null,
  status                text not null default 'pending', -- 'pending' | 'paid' | 'free'
  created_at            timestamptz default now()
);

alter table legacy_upload_orders enable row level security;

create policy "Users read own legacy orders"
  on legacy_upload_orders for select
  using (auth.uid() = user_id);

-- ── Auto-provision subscription on signup ─────────────────────────────────────
-- On every new auth.users row: insert a subscriptions record.
-- If the email is in beta_emails → plan = 'beta' + is_beta = true, else 'preserve'.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  assigned_plan plan_type;
  is_beta_user  boolean;
begin
  select exists(select 1 from beta_emails where email = new.email)
    into is_beta_user;

  assigned_plan := case when is_beta_user then 'beta'::plan_type else 'preserve'::plan_type end;

  insert into subscriptions (user_id, plan, is_beta)
  values (new.id, assigned_plan, is_beta_user)
  on conflict (user_id) do nothing;

  return new;
exception when others then
  -- Never block user creation if billing tables are missing or have errors
  return new;
end;
$$;

-- Drop old trigger if it exists, then re-create cleanly
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Beta user seed — replace with real tester emails ─────────────────────────
-- insert into beta_emails (email) values
--   ('tester1@example.com'),
--   ('tester2@example.com');
-- After inserting, back-fill existing beta users' subscriptions:
-- update subscriptions s
--   set plan = 'beta', is_beta = true
--   from auth.users u
--   join beta_emails b on b.email = u.email
--   where s.user_id = u.id;
