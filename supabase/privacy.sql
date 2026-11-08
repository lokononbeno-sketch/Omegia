-- OMEGIA — réglages de confidentialité appliqués par la base (réexécutable).
-- Déjà appliqué sur le projet Supabase. À exécuter après schema.sql et features_securite.sql.
create table if not exists public.profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  discoverable boolean not null default true,
  allow_messages text not null default 'everyone' check (allow_messages in ('everyone','friends')),
  stories_audience text not null default 'everyone' check (stories_audience in ('everyone','friends')),
  profile_locked boolean not null default false,
  allow_requests boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.profile_settings enable row level security;
revoke all on table public.profile_settings from anon, public;
grant select, insert, update on table public.profile_settings to authenticated;
drop policy if exists "members read own settings" on public.profile_settings;
create policy "members read own settings" on public.profile_settings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "members create own settings" on public.profile_settings;
create policy "members create own settings" on public.profile_settings for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "members update own settings" on public.profile_settings;
create policy "members update own settings" on public.profile_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.omegia_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friend_requests fr where fr.status = 'accepted'
    and ((fr.sender_id = a and fr.recipient_id = b) or (fr.sender_id = b and fr.recipient_id = a)));
$$;
create or replace function public.omegia_profile_ok(author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select author = (select auth.uid())
    or not coalesce((select ps.profile_locked from public.profile_settings ps where ps.user_id = author), false)
    or public.omegia_are_friends(author, (select auth.uid()));
$$;
create or replace function public.omegia_stories_ok(author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select author = (select auth.uid())
    or coalesce((select ps.stories_audience from public.profile_settings ps where ps.user_id = author), 'everyone') = 'everyone'
    or public.omegia_are_friends(author, (select auth.uid()));
$$;
create or replace function public.omegia_accepts_requests(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select ps.allow_requests from public.profile_settings ps where ps.user_id = uid), true);
$$;
create or replace function public.omegia_can_message(conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conv and cm.user_id <> (select auth.uid())
      and coalesce((select ps.allow_messages from public.profile_settings ps where ps.user_id = cm.user_id), 'everyone') = 'friends'
      and not public.omegia_are_friends(cm.user_id, (select auth.uid())));
$$;
create or replace function public.omegia_search_members(q text)
returns table (id uuid, first_name text, last_name text, username text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  with s as (select '%' || replace(replace(replace(trim(coalesce(q,'')),'\','\\'),'%','\%'),'_','\_') || '%' as pat, length(trim(coalesce(q,''))) as len)
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url
  from public.profiles p cross join s
  where s.len >= 2 and p.id <> (select auth.uid())
    and not exists (select 1 from public.user_blocks ub where (ub.blocker_id = p.id and ub.blocked_id = (select auth.uid())) or (ub.blocker_id = (select auth.uid()) and ub.blocked_id = p.id))
    and (coalesce((select ps.discoverable from public.profile_settings ps where ps.user_id = p.id), true) or public.omegia_are_friends(p.id, (select auth.uid())))
    and (p.first_name ilike s.pat or p.last_name ilike s.pat or coalesce(p.username,'') ilike s.pat)
  order by p.created_at desc limit 15;
$$;
revoke all on function public.omegia_are_friends(uuid,uuid), public.omegia_profile_ok(uuid), public.omegia_stories_ok(uuid), public.omegia_accepts_requests(uuid), public.omegia_can_message(uuid), public.omegia_search_members(text) from public, anon;
grant execute on function public.omegia_are_friends(uuid,uuid), public.omegia_profile_ok(uuid), public.omegia_stories_ok(uuid), public.omegia_accepts_requests(uuid), public.omegia_can_message(uuid), public.omegia_search_members(text) to authenticated;

drop policy if exists omegia_privacy_posts on public.posts;
create policy omegia_privacy_posts on public.posts as restrictive for select to authenticated using (public.omegia_profile_ok(author_id));
drop policy if exists omegia_privacy_stories on public.stories;
create policy omegia_privacy_stories on public.stories as restrictive for select to authenticated using (public.omegia_stories_ok(author_id));
drop policy if exists omegia_privacy_statuses on public.statuses;
create policy omegia_privacy_statuses on public.statuses as restrictive for select to authenticated using (public.omegia_stories_ok(author_id));
drop policy if exists omegia_privacy_messages on public.messages;
create policy omegia_privacy_messages on public.messages as restrictive for insert to authenticated with check (public.omegia_can_message(conversation_id));
drop policy if exists omegia_privacy_requests on public.friend_requests;
create policy omegia_privacy_requests on public.friend_requests as restrictive for insert to authenticated with check (public.omegia_accepts_requests(recipient_id));
