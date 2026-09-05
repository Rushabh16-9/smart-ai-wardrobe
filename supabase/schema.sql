-- Smart AI Wardrobe - Supabase Schema
-- Run this in your Supabase SQL Editor

-- ============================================================
-- Enable UUID extension
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- wardrobe_items table
-- ============================================================
create table if not exists public.wardrobe_items (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  image_url     text not null,
  thumbnail_url text,
  type          text,          -- e.g. "T-Shirt", "Dress", "Sneakers"
  color         text,          -- e.g. "Navy Blue"
  pattern       text,          -- e.g. "Solid", "Striped", "Floral"
  season        text[],        -- e.g. ARRAY['Summer', 'Spring']
  formality     text,          -- e.g. "Casual", "Smart Casual", "Formal"
  tags          text[],        -- user-defined tags
  source_url    text,          -- original e-commerce product URL
  brand         text,          -- optional brand name
  notes         text,          -- free-form notes
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS
alter table public.wardrobe_items enable row level security;

create policy "Users can view their own wardrobe items"
  on public.wardrobe_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own wardrobe items"
  on public.wardrobe_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own wardrobe items"
  on public.wardrobe_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own wardrobe items"
  on public.wardrobe_items for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger wardrobe_items_updated_at
  before update on public.wardrobe_items
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- wear_history table
-- ============================================================
create table if not exists public.wear_history (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  outfit_items  uuid[],        -- array of wardrobe_item IDs used in the outfit
  occasion      text,          -- e.g. "Job Interview", "Beach Day"
  worn_at       timestamptz not null default now(),
  notes         text,
  ai_suggestion jsonb,         -- the full AI recommendation JSON stored here
  created_at    timestamptz not null default now()
);

-- RLS
alter table public.wear_history enable row level security;

create policy "Users can view their own wear history"
  on public.wear_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own wear history"
  on public.wear_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own wear history"
  on public.wear_history for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Supabase Storage bucket for wardrobe images
-- ============================================================
-- Run this separately or via Supabase dashboard:
-- insert into storage.buckets (id, name, public) values ('wardrobe-images', 'wardrobe-images', true);

-- Storage policies (create via dashboard or uncomment):
-- create policy "Users can upload wardrobe images"
--   on storage.objects for insert
--   with check (bucket_id = 'wardrobe-images' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Public wardrobe images are viewable"
--   on storage.objects for select
--   using (bucket_id = 'wardrobe-images');
