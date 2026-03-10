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
  updated_at timestamptz default now()
);

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
