-- OMEGIA — Lot 2 : blocage, réglages de confidentialité, romans synchronisés.
-- À exécuter après setup_all.sql (Supabase > SQL Editor). Réexécutable, ne supprime aucune donnée utilisateur.
-- Après exécution, déclarer l’auteur des romans :
--   insert into public.novel_admins(user_id) values ('<uuid-du-compte-auteur>') on conflict do nothing;

create extension if not exists pgcrypto;

-- ============ Tables ============
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint block_not_self check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

create table if not exists public.profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_online boolean not null default true,
  discoverable boolean not null default true,
  allow_messages text not null default 'everyone' check (allow_messages in ('everyone','friends')),
  default_visibility text not null default 'public' check (default_visibility in ('public','friends')),
  stories_audience text not null default 'everyone' check (stories_audience in ('everyone','friends')),
  profile_locked boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.novel_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

create table if not exists public.novels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  price text not null check (length(trim(price)) between 1 and 40),
  buy_url text not null check (buy_url ~* '^https?://'),
  summary text not null check (length(trim(summary)) between 1 and 2000),
  excerpt text not null default '' check (length(excerpt) <= 5000),
  pdf_url text,
  created_at timestamptz not null default now()
);
create index if not exists novels_created_idx on public.novels(created_at desc);

-- ============ Fonctions d’aide (security definer, sans paramètre secret) ============
create or replace function public.omegia_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b) or (ub.blocker_id = b and ub.blocked_id = a)
  );
$$;

create or replace function public.omegia_are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and ((fr.sender_id = a and fr.recipient_id = b) or (fr.sender_id = b and fr.recipient_id = a))
  );
$$;

create or replace function public.omegia_profile_locked(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select ps.profile_locked from public.profile_settings ps where ps.user_id = uid), false);
$$;

create or replace function public.omegia_audience_ok(author uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select author = (select auth.uid())
    or (
      not public.omegia_blocked_between(author, (select auth.uid()))
      and (
        coalesce((select ps.stories_audience from public.profile_settings ps where ps.user_id = author), 'everyone') = 'everyone'
        or public.omegia_are_friends(author, (select auth.uid()))
      )
    );
$$;

create or replace function public.omegia_can_message(conv uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conv
      and cm.user_id <> (select auth.uid())
      and (
        public.omegia_blocked_between(cm.user_id, (select auth.uid()))
        or (
          coalesce((select ps.allow_messages from public.profile_settings ps where ps.user_id = cm.user_id), 'everyone') = 'friends'
          and not public.omegia_are_friends(cm.user_id, (select auth.uid()))
        )
      )
  );
$$;

create or replace function public.omegia_is_novel_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.novel_admins na where na.user_id = (select auth.uid()));
$$;

-- Recherche et suggestions : respectent le blocage et la découvrabilité.
create or replace function public.omegia_search_members(q text)
returns table (id uuid, first_name text, last_name text, username text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  with s as (
    select '%' || replace(replace(replace(trim(coalesce(q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat,
           length(trim(coalesce(q, ''))) as len
  )
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url
  from public.profiles p
  cross join s
  left join public.profile_settings ps on ps.user_id = p.id
  where s.len >= 2
    and p.id <> (select auth.uid())
    and not public.omegia_blocked_between(p.id, (select auth.uid()))
    and (coalesce(ps.discoverable, true) or public.omegia_are_friends(p.id, (select auth.uid())))
    and (p.first_name ilike s.pat or p.last_name ilike s.pat or coalesce(p.username, '') ilike s.pat)
  order by p.created_at desc
  limit 15;
$$;

create or replace function public.omegia_suggest_members()
returns table (id uuid, first_name text, last_name text, username text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url
  from public.profiles p
  left join public.profile_settings ps on ps.user_id = p.id
  where p.id <> (select auth.uid())
    and not public.omegia_blocked_between(p.id, (select auth.uid()))
    and coalesce(ps.discoverable, true)
  order by p.created_at desc
  limit 40;
$$;

-- ============ RLS : nouvelles tables ============
alter table public.user_blocks enable row level security;
alter table public.profile_settings enable row level security;
alter table public.novel_admins enable row level security;
alter table public.novels enable row level security;

drop policy if exists "members read own blocks" on public.user_blocks;
create policy "members read own blocks" on public.user_blocks for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists "members block" on public.user_blocks;
create policy "members block" on public.user_blocks for insert to authenticated with check (blocker_id = (select auth.uid()) and blocked_id <> (select auth.uid()));
drop policy if exists "members unblock" on public.user_blocks;
create policy "members unblock" on public.user_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists "members read own settings" on public.profile_settings;
create policy "members read own settings" on public.profile_settings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "members create own settings" on public.profile_settings;
create policy "members create own settings" on public.profile_settings for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "members update own settings" on public.profile_settings;
create policy "members update own settings" on public.profile_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "admins read themselves" on public.novel_admins;
create policy "admins read themselves" on public.novel_admins for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members read novels" on public.novels;
create policy "members read novels" on public.novels for select to authenticated using (true);
drop policy if exists "admins insert novels" on public.novels;
create policy "admins insert novels" on public.novels for insert to authenticated
with check (author_id = (select auth.uid()) and exists (select 1 from public.novel_admins na where na.user_id = (select auth.uid())));
drop policy if exists "admins update novels" on public.novels;
create policy "admins update novels" on public.novels for update to authenticated
using (author_id = (select auth.uid()) and exists (select 1 from public.novel_admins na where na.user_id = (select auth.uid())))
with check (author_id = (select auth.uid()));
drop policy if exists "admins delete novels" on public.novels;
create policy "admins delete novels" on public.novels for delete to authenticated
using (author_id = (select auth.uid()) and exists (select 1 from public.novel_admins na where na.user_id = (select auth.uid())));

-- ============ RLS : application du blocage et de la confidentialité aux tables existantes ============
drop policy if exists "members read visible posts" on public.posts;
create policy "members read visible posts" on public.posts for select to authenticated using (
  author_id = (select auth.uid())
  or (
    not public.omegia_blocked_between(author_id, (select auth.uid()))
    and (
      (visibility = 'public' and not public.omegia_profile_locked(author_id))
      or public.omegia_are_friends(author_id, (select auth.uid()))
    )
  )
);

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and public.omegia_is_conversation_member(conversation_id)
  and public.omegia_can_message(conversation_id)
);

drop policy if exists "members send friend requests" on public.friend_requests;
create policy "members send friend requests" on public.friend_requests for insert to authenticated with check (
  sender_id = (select auth.uid())
  and recipient_id <> (select auth.uid())
  and not public.omegia_blocked_between(sender_id, recipient_id)
);

drop policy if exists "members read active stories" on public.stories;
create policy "members read active stories" on public.stories for select to authenticated using (
  expires_at > now() and public.omegia_audience_ok(author_id)
);
drop policy if exists "members read active statuses" on public.statuses;
create policy "members read active statuses" on public.statuses for select to authenticated using (
  expires_at > now() and public.omegia_audience_ok(author_id)
);

-- ============ Droits d’exécution : membres connectés uniquement ============
revoke all on function public.omegia_blocked_between(uuid, uuid) from public, anon;
revoke all on function public.omegia_are_friends(uuid, uuid) from public, anon;
revoke all on function public.omegia_profile_locked(uuid) from public, anon;
revoke all on function public.omegia_audience_ok(uuid) from public, anon;
revoke all on function public.omegia_can_message(uuid) from public, anon;
revoke all on function public.omegia_is_novel_admin() from public, anon;
revoke all on function public.omegia_search_members(text) from public, anon;
revoke all on function public.omegia_suggest_members() from public, anon;
grant execute on function public.omegia_blocked_between(uuid, uuid) to authenticated;
grant execute on function public.omegia_are_friends(uuid, uuid) to authenticated;
grant execute on function public.omegia_profile_locked(uuid) to authenticated;
grant execute on function public.omegia_audience_ok(uuid) to authenticated;
grant execute on function public.omegia_can_message(uuid) to authenticated;
grant execute on function public.omegia_is_novel_admin() to authenticated;
grant execute on function public.omegia_search_members(text) to authenticated;
grant execute on function public.omegia_suggest_members() to authenticated;
