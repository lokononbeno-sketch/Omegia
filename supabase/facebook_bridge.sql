-- OMEGIA — passerelle Facebook : imports privés d’archives personnelles
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Aucun jeton Facebook ni contenu d'un autre compte n'est collecté ici.

create table if not exists public.facebook_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'facebook_archive' check (source in ('facebook_archive')),
  file_name text,
  status text not null default 'completed' check (status in ('processing','completed','failed')),
  total_posts integer not null default 0 check (total_posts >= 0),
  total_friends integer not null default 0 check (total_friends >= 0),
  total_pages integer not null default 0 check (total_pages >= 0),
  total_groups integer not null default 0 check (total_groups >= 0),
  total_media integer not null default 0 check (total_media >= 0),
  created_at timestamptz not null default now()
);
create index if not exists facebook_imports_user_created_idx
  on public.facebook_imports(user_id, created_at desc);

create table if not exists public.facebook_import_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.facebook_imports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('post','friend','page','group')),
  title text,
  body text,
  source_url text,
  source_path text,
  occurred_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists facebook_import_items_owner_idx
  on public.facebook_import_items(user_id, import_id, kind, created_at desc);

alter table public.facebook_imports enable row level security;
alter table public.facebook_import_items enable row level security;

drop policy if exists "members read own Facebook imports" on public.facebook_imports;
create policy "members read own Facebook imports" on public.facebook_imports
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "members create own Facebook imports" on public.facebook_imports;
create policy "members create own Facebook imports" on public.facebook_imports
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "members delete own Facebook imports" on public.facebook_imports;
create policy "members delete own Facebook imports" on public.facebook_imports
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members read own Facebook import items" on public.facebook_import_items;
create policy "members read own Facebook import items" on public.facebook_import_items
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "members add items to own Facebook import" on public.facebook_import_items;
create policy "members add items to own Facebook import" on public.facebook_import_items
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.facebook_imports i
    where i.id = import_id and i.user_id = (select auth.uid())
  )
);
drop policy if exists "members delete own Facebook import items" on public.facebook_import_items;
create policy "members delete own Facebook import items" on public.facebook_import_items
for delete to authenticated using (user_id = (select auth.uid()));

comment on table public.facebook_imports is
  'Private metadata for a member-provided Facebook data archive. Not a live Facebook API connection.';
comment on table public.facebook_import_items is
  'Private imported references and post text from the owner-provided Facebook archive.';
