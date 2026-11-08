-- OMEGIA : schéma de la base Supabase (état réel, novembre 2026)
-- À exécuter dans Supabase > SQL Editor pour une NOUVELLE base, puis, dans l'ordre :
--   supabase/social_features.sql (statuts + stockage des médias), supabase/features.sql, supabase/features_securite.sql.
-- Le script peut être relancé sans casser les données :
-- les tables sont créées « si elles n'existent pas » et les règles sont recréées.

-- ---------- Profils ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 50),
  last_name text not null default '' check (char_length(last_name) <= 50),
  created_at timestamptz not null default now(),
  username text unique,
  avatar_url text,
  cover_url text,
  bio text not null default '',
  location text,
  work text,
  school text,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_omegia_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 50),
    left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 50)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_omegia_auth_user_created on auth.users;
create trigger on_omegia_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_omegia_user();

-- ---------- Amis ----------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists friend_requests_pending_pair
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id)) where status = 'pending';
create index if not exists friend_requests_recipient_idx on public.friend_requests (recipient_id, status);
create index if not exists friend_requests_sender_idx on public.friend_requests (sender_id);

-- ---------- Publications, j'aime, commentaires, stories ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  media_url text,
  media_type text check (media_type is null or media_type in ('image','video')),
  visibility text not null default 'friends' check (visibility in ('public','friends')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_author_idx on public.posts (author_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like','love','haha','wow','sad','angry')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id);
create index if not exists post_reactions_user_idx on public.post_reactions (user_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_author_idx on public.post_comments (author_id);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  media_url text,
  media_type text not null default 'text' check (media_type in ('text','image','video','audio')),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists stories_author_idx on public.stories (author_id);
create index if not exists stories_active_idx on public.stories (expires_at);

-- ---------- Messagerie ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists conversations_creator_idx on public.conversations (created_by);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  attachment_url text,
  attachment_type text check (attachment_type is null or attachment_type in ('image','video','file','audio')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_idx on public.messages (sender_id);

-- Appartenance à une conversation, sans récursion dans les règles de sécurité.
create or replace function public.omegia_is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = (select auth.uid())
  );
$$;

-- ---------- Sécurité (RLS) ----------
alter table public.profiles             enable row level security;
alter table public.friend_requests      enable row level security;
alter table public.posts                enable row level security;
alter table public.post_reactions       enable row level security;
alter table public.post_comments        enable row level security;
alter table public.stories              enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

-- profils
drop policy if exists "profiles readable by members" on public.profiles;
create policy "profiles readable by members" on public.profiles for select to authenticated using (true);
drop policy if exists "members insert own profile" on public.profiles;
create policy "members insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "members update own profile" on public.profiles;
create policy "members update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- amis : seul le destinataire accepte/refuse, seul l'expéditeur annule
drop policy if exists "members read own friend requests" on public.friend_requests;
create policy "members read own friend requests" on public.friend_requests for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
drop policy if exists "members send friend requests" on public.friend_requests;
create policy "members send friend requests" on public.friend_requests for insert to authenticated
  with check (sender_id = (select auth.uid()) and recipient_id <> (select auth.uid()) and status = 'pending');
drop policy if exists "recipients answer friend requests" on public.friend_requests;
create policy "recipients answer friend requests" on public.friend_requests for update to authenticated
  using (recipient_id = (select auth.uid()) and status = 'pending')
  with check (recipient_id = (select auth.uid()) and status in ('accepted','declined'));
drop policy if exists "senders cancel friend requests" on public.friend_requests;
create policy "senders cancel friend requests" on public.friend_requests for update to authenticated
  using (sender_id = (select auth.uid()) and status = 'pending')
  with check (sender_id = (select auth.uid()) and status = 'cancelled');
drop policy if exists "participants delete requests" on public.friend_requests;
create policy "participants delete requests" on public.friend_requests for delete to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- publications : publiques, ou de ses amis, ou les siennes
drop policy if exists "members read visible posts" on public.posts;
create policy "members read visible posts" on public.posts for select to authenticated using (
  visibility = 'public'
  or author_id = (select auth.uid())
  or exists (select 1 from public.friend_requests fr
             where fr.status = 'accepted'
               and ((fr.sender_id = posts.author_id and fr.recipient_id = (select auth.uid()))
                 or (fr.recipient_id = posts.author_id and fr.sender_id = (select auth.uid())))));
drop policy if exists "members create own posts" on public.posts;
create policy "members create own posts" on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "authors delete own posts" on public.posts;
create policy "authors delete own posts" on public.posts for delete to authenticated using (author_id = (select auth.uid()));

-- j'aime et commentaires : seulement sur les publications visibles (la règle de posts s'applique dans le sous-select)
drop policy if exists "members read reactions of visible posts" on public.post_reactions;
create policy "members read reactions of visible posts" on public.post_reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_reactions.post_id));
drop policy if exists "members react as themselves" on public.post_reactions;
create policy "members react as themselves" on public.post_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_reactions.post_id));
drop policy if exists "members change own reaction" on public.post_reactions;
create policy "members change own reaction" on public.post_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "members remove own reaction" on public.post_reactions;
create policy "members remove own reaction" on public.post_reactions for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members read comments of visible posts" on public.post_comments;
create policy "members read comments of visible posts" on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_comments.post_id));
drop policy if exists "members comment as themselves" on public.post_comments;
create policy "members comment as themselves" on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_comments.post_id));
drop policy if exists "authors edit own comments" on public.post_comments;
create policy "authors edit own comments" on public.post_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "authors delete own comments" on public.post_comments;
create policy "authors delete own comments" on public.post_comments for delete to authenticated using (author_id = (select auth.uid()));

-- stories : visibles 24 h par les membres
drop policy if exists "members read active stories" on public.stories;
create policy "members read active stories" on public.stories for select to authenticated using (expires_at > now());
drop policy if exists "members create own stories" on public.stories;
create policy "members create own stories" on public.stories for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "authors delete own stories" on public.stories;
create policy "authors delete own stories" on public.stories for delete to authenticated using (author_id = (select auth.uid()));

-- messagerie : seul le créateur ajoute des membres ; on lit uniquement ses conversations
drop policy if exists "members create conversations" on public.conversations;
create policy "members create conversations" on public.conversations for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "members read own conversations" on public.conversations;
create policy "members read own conversations" on public.conversations for select to authenticated
  using (public.omegia_is_conversation_member(id) or created_by = (select auth.uid()));

drop policy if exists "conversation creator adds members" on public.conversation_members;
create policy "conversation creator adds members" on public.conversation_members for insert to authenticated
  with check (exists (select 1 from public.conversations c where c.id = conversation_members.conversation_id and c.created_by = (select auth.uid())));
drop policy if exists "members read participants" on public.conversation_members;
create policy "members read participants" on public.conversation_members for select to authenticated
  using (user_id = (select auth.uid()) or public.omegia_is_conversation_member(conversation_id));

drop policy if exists "members read conversation messages" on public.messages;
create policy "members read conversation messages" on public.messages for select to authenticated using (public.omegia_is_conversation_member(conversation_id));
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.omegia_is_conversation_member(conversation_id));
drop policy if exists "senders edit own messages" on public.messages;
create policy "senders edit own messages" on public.messages for update to authenticated
  using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
drop policy if exists "senders delete own messages" on public.messages;
create policy "senders delete own messages" on public.messages for delete to authenticated using (sender_id = (select auth.uid()));

-- ---------- Droits explicites ----------
-- Aucun accès pour les visiteurs non connectés ; colonnes modifiables limitées pour les membres.
revoke all on public.profiles, public.friend_requests, public.posts, public.post_reactions, public.post_comments,
  public.stories, public.conversations, public.conversation_members, public.messages from anon;
revoke update on public.profiles, public.friend_requests, public.posts, public.post_reactions, public.post_comments,
  public.stories, public.conversations, public.conversation_members, public.messages from authenticated;
grant select, insert, delete on public.profiles, public.friend_requests, public.posts, public.post_reactions,
  public.post_comments, public.stories, public.conversations, public.conversation_members, public.messages to authenticated;
grant update (first_name, last_name, username, avatar_url, cover_url, bio, location, work, school, updated_at) on public.profiles to authenticated;
grant update (status, updated_at) on public.friend_requests to authenticated;
grant update (body, media_url, media_type, visibility, updated_at) on public.posts to authenticated;
grant update (reaction) on public.post_reactions to authenticated;
grant update (body) on public.post_comments to authenticated;
grant update (body, edited_at) on public.messages to authenticated;
revoke execute on function public.omegia_is_conversation_member(uuid) from anon, public;
grant execute on function public.omegia_is_conversation_member(uuid) to authenticated;

-- ---------- Temps réel ----------
do $$ begin alter publication supabase_realtime add table public.posts;          exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.stories;        exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.messages;       exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.friend_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_comments;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_reactions; exception when duplicate_object then null; end $$;
