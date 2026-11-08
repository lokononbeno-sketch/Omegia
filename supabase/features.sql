-- OMEGIA — tables des fonctionnalités du menu (Groupes, Pages, Événements, Reels, Mail, Pubs, Aide, Blocage)
-- À exécuter UNE SEULE FOIS : Supabase → SQL Editor → coller tout ce fichier → Run.
-- Le script peut être relancé sans danger (il ne supprime aucune donnée).

-- ===== Blocage =====
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists user_blocks_owner on public.user_blocks;
create policy user_blocks_owner on public.user_blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function public.omegia_is_blocked(p_blocker uuid, p_blocked uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_blocks where blocker_id = p_blocker and blocked_id = p_blocked)
$$;
grant execute on function public.omegia_is_blocked(uuid, uuid) to authenticated;

-- Un compte bloqué ne peut plus envoyer d'invitation d'ami à la personne qui l'a bloqué.
do $$ begin
  if to_regclass('public.friend_requests') is not null then
    execute 'drop policy if exists omegia_block_requests on public.friend_requests';
    execute 'create policy omegia_block_requests on public.friend_requests as restrictive for insert to authenticated with check (not public.omegia_is_blocked(recipient_id, auth.uid()))';
  end if;
end $$;

-- ===== Groupes =====
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table if not exists public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_posts enable row level security;
drop policy if exists groups_read on public.groups;
drop policy if exists groups_insert on public.groups;
drop policy if exists groups_update on public.groups;
drop policy if exists groups_delete on public.groups;
create policy groups_read on public.groups for select to authenticated using (true);
create policy groups_insert on public.groups for insert to authenticated with check (created_by = auth.uid());
create policy groups_update on public.groups for update to authenticated using (created_by = auth.uid());
create policy groups_delete on public.groups for delete to authenticated using (created_by = auth.uid());
drop policy if exists group_members_read on public.group_members;
drop policy if exists group_members_insert on public.group_members;
drop policy if exists group_members_delete on public.group_members;
create policy group_members_read on public.group_members for select to authenticated using (true);
create policy group_members_insert on public.group_members for insert to authenticated with check (user_id = auth.uid());
create policy group_members_delete on public.group_members for delete to authenticated using (user_id = auth.uid());
drop policy if exists group_posts_read on public.group_posts;
drop policy if exists group_posts_insert on public.group_posts;
drop policy if exists group_posts_delete on public.group_posts;
create policy group_posts_read on public.group_posts for select to authenticated using (true);
create policy group_posts_insert on public.group_posts for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.group_members m where m.group_id = group_posts.group_id and m.user_id = auth.uid()));
create policy group_posts_delete on public.group_posts for delete to authenticated using (author_id = auth.uid());

-- ===== Pages =====
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  category text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.page_follows (
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'follower',
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);
create table if not exists public.page_posts (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.pages enable row level security;
alter table public.page_follows enable row level security;
alter table public.page_posts enable row level security;
drop policy if exists pages_read on public.pages;
drop policy if exists pages_insert on public.pages;
drop policy if exists pages_update on public.pages;
drop policy if exists pages_delete on public.pages;
create policy pages_read on public.pages for select to authenticated using (true);
create policy pages_insert on public.pages for insert to authenticated with check (created_by = auth.uid());
create policy pages_update on public.pages for update to authenticated using (created_by = auth.uid());
create policy pages_delete on public.pages for delete to authenticated using (created_by = auth.uid());
drop policy if exists page_follows_read on public.page_follows;
drop policy if exists page_follows_insert on public.page_follows;
drop policy if exists page_follows_delete on public.page_follows;
create policy page_follows_read on public.page_follows for select to authenticated using (true);
create policy page_follows_insert on public.page_follows for insert to authenticated with check (user_id = auth.uid());
create policy page_follows_delete on public.page_follows for delete to authenticated using (user_id = auth.uid());
drop policy if exists page_posts_read on public.page_posts;
drop policy if exists page_posts_insert on public.page_posts;
drop policy if exists page_posts_delete on public.page_posts;
create policy page_posts_read on public.page_posts for select to authenticated using (true);
create policy page_posts_insert on public.page_posts for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.pages p where p.id = page_posts.page_id and p.created_by = auth.uid()));
create policy page_posts_delete on public.page_posts for delete to authenticated using (author_id = auth.uid());

-- ===== Événements =====
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text,
  location text,
  starts_at timestamptz not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('going', 'maybe')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
drop policy if exists events_read on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
create policy events_read on public.events for select to authenticated using (true);
create policy events_insert on public.events for insert to authenticated with check (created_by = auth.uid());
create policy events_update on public.events for update to authenticated using (created_by = auth.uid());
create policy events_delete on public.events for delete to authenticated using (created_by = auth.uid());
drop policy if exists event_rsvps_read on public.event_rsvps;
drop policy if exists event_rsvps_write on public.event_rsvps;
create policy event_rsvps_read on public.event_rsvps for select to authenticated using (true);
create policy event_rsvps_write on public.event_rsvps for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== Reels =====
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_url text not null,
  caption text,
  created_at timestamptz not null default now()
);
alter table public.reels enable row level security;
drop policy if exists reels_read on public.reels;
drop policy if exists reels_insert on public.reels;
drop policy if exists reels_delete on public.reels;
create policy reels_read on public.reels for select to authenticated using (true);
create policy reels_insert on public.reels for insert to authenticated with check (author_id = auth.uid());
create policy reels_delete on public.reels for delete to authenticated using (author_id = auth.uid());

-- ===== Mail =====
create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  body text not null check (char_length(body) <= 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.mail_messages enable row level security;
drop policy if exists mail_read on public.mail_messages;
drop policy if exists mail_insert on public.mail_messages;
drop policy if exists mail_update on public.mail_messages;
drop policy if exists mail_delete on public.mail_messages;
create policy mail_read on public.mail_messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy mail_insert on public.mail_messages for insert to authenticated with check (sender_id = auth.uid());
create policy mail_update on public.mail_messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy mail_delete on public.mail_messages for delete to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

-- ===== Espace Pubs =====
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text,
  link_url text,
  image_url text,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now()
);
alter table public.ads enable row level security;
drop policy if exists ads_read on public.ads;
drop policy if exists ads_write on public.ads;
create policy ads_read on public.ads for select to authenticated using (status = 'active' or owner_id = auth.uid());
create policy ads_write on public.ads for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ===== Aide et assistance =====
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text,
  body text not null check (char_length(body) <= 2000),
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists tickets_read on public.support_tickets;
drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_read on public.support_tickets for select to authenticated using (user_id = auth.uid());
create policy tickets_insert on public.support_tickets for insert to authenticated with check (user_id = auth.uid());

notify pgrst, 'reload schema';
