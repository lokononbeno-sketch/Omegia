-- OMEGIA : j'aime et commentaires sur les photos de profil et de couverture
-- (déjà appliqué sur le projet Supabase le 2026-11-09)
create table if not exists public.photo_reactions (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  owner_id uuid,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reaction text not null default 'like',
  created_at timestamptz not null default now(),
  unique (photo_url, user_id)
);
create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  owner_id uuid,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists photo_reactions_url_idx on public.photo_reactions (photo_url);
create index if not exists photo_comments_url_idx on public.photo_comments (photo_url, created_at);
alter table public.photo_reactions enable row level security;
alter table public.photo_comments enable row level security;
create policy "photo_reactions_read" on public.photo_reactions for select to authenticated using (true);
create policy "photo_reactions_insert_own" on public.photo_reactions for insert to authenticated with check (user_id = auth.uid());
create policy "photo_reactions_delete_own" on public.photo_reactions for delete to authenticated using (user_id = auth.uid());
create policy "photo_comments_read" on public.photo_comments for select to authenticated using (true);
create policy "photo_comments_insert_own" on public.photo_comments for insert to authenticated with check (author_id = auth.uid());
create policy "photo_comments_delete_own_or_owner" on public.photo_comments for delete to authenticated using (author_id = auth.uid() or owner_id = auth.uid());
