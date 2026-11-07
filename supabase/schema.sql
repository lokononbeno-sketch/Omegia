-- OMEGIA — Schéma des fonctionnalités sociales (état ACTUEL de la base Supabase).
--
-- Ce fichier décrit la base telle qu'elle est déjà installée. Il sert de trace et pour recréer une base VIDE.
-- Ne pas le réexécuter sur la base existante. Les modifications futures passent par de nouvelles migrations.
-- Toutes les tables sont protégées par Row Level Security : rien n'est accessible aux visiteurs non connectés.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 50),
  last_name text not null default '' check (char_length(last_name) <= 50),
  username text unique,
  avatar_url text,
  cover_url text,
  bio text not null default '',
  location text,
  work text,
  school text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_request_not_self check (sender_id <> recipient_id)
);
create unique index friend_requests_pending_pair
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  media_url text,
  media_type text check (media_type is null or media_type in ('image','video')),
  visibility text not null default 'friends' check (visibility in ('public','friends')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_has_content check (length(trim(body)) > 0 or media_url is not null)
);

create table public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like','love','haha','wow','sad','angry')),
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  media_url text,
  media_type text not null default 'text' check (media_type in ('text','image','video')),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint story_has_content check (length(trim(body)) > 0 or media_url is not null)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  attachment_url text,
  attachment_type text check (attachment_type is null or attachment_type in ('image','video','file','audio')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint message_has_content check (length(trim(body)) > 0 or attachment_url is not null)
);

create index posts_created_at_idx on public.posts(created_at desc);
create index posts_author_idx on public.posts(author_id);
create index stories_active_idx on public.stories(expires_at);
create index stories_author_idx on public.stories(author_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index messages_sender_idx on public.messages(sender_id);
create index friend_requests_recipient_idx on public.friend_requests(recipient_id, status);
create index friend_requests_sender_idx on public.friend_requests(sender_id);
create index post_reactions_post_idx on public.post_reactions(post_id);
create index post_reactions_user_idx on public.post_reactions(user_id);
create index post_comments_post_idx on public.post_comments(post_id, created_at);
create index post_comments_author_idx on public.post_comments(author_id);
create index conversation_members_user_idx on public.conversation_members(user_id);
create index conversations_creator_idx on public.conversations(created_by);

-- Profil créé automatiquement à l'inscription (prénom et nom pris dans les métadonnées de l'inscription).
create or replace function public.handle_new_omegia_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
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
revoke execute on function public.handle_new_omegia_user() from public, anon, authenticated;

create trigger on_omegia_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_omegia_user();

-- Aide privée : le membre connecté appartient-il à cette conversation ?
create or replace function public.omegia_is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.omegia_is_conversation_member(uuid) from public, anon;
grant execute on function public.omegia_is_conversation_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.stories enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Profils
create policy "profiles readable by signed-in members" on public.profiles for select to authenticated using (true);
create policy "members update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Demandes d'ami : seul le destinataire accepte ou refuse, seul l'expéditeur annule
create policy "members read own friend requests" on public.friend_requests for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "members send friend requests" on public.friend_requests for insert to authenticated
  with check (sender_id = (select auth.uid()) and recipient_id <> (select auth.uid()) and status = 'pending');
create policy "recipients answer friend requests" on public.friend_requests for update to authenticated
  using (recipient_id = (select auth.uid()) and status = 'pending')
  with check (recipient_id = (select auth.uid()) and status in ('accepted','declined'));
create policy "senders cancel friend requests" on public.friend_requests for update to authenticated
  using (sender_id = (select auth.uid()) and status = 'pending')
  with check (sender_id = (select auth.uid()) and status = 'cancelled');

-- Publications : publiques, ou de moi, ou d'un ami accepté
create policy "members read visible posts" on public.posts for select to authenticated using (
  visibility = 'public' or author_id = (select auth.uid()) or exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and ((fr.sender_id = author_id and fr.recipient_id = (select auth.uid()))
        or (fr.recipient_id = author_id and fr.sender_id = (select auth.uid())))
  )
);
create policy "members create own posts" on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy "authors update own posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "authors delete own posts" on public.posts for delete to authenticated using (author_id = (select auth.uid()));

-- Réactions et commentaires : visibles seulement si la publication l'est
create policy "members read reactions" on public.post_reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "members react as themselves" on public.post_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "members change own reaction" on public.post_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "members remove own reaction" on public.post_reactions for delete to authenticated using (user_id = (select auth.uid()));

create policy "members read comments" on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "members comment as themselves" on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "authors edit own comments" on public.post_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "authors delete own comments" on public.post_comments for delete to authenticated using (author_id = (select auth.uid()));

-- Stories
create policy "members read active stories" on public.stories for select to authenticated using (expires_at > now());
create policy "members create own stories" on public.stories for insert to authenticated with check (author_id = (select auth.uid()));
create policy "authors delete own stories" on public.stories for delete to authenticated using (author_id = (select auth.uid()));

-- Messagerie : seul le créateur d'une conversation y ajoute des membres (lui-même compris)
create policy "members read own conversations" on public.conversations for select to authenticated
  using (public.omegia_is_conversation_member(id) or created_by = (select auth.uid()));
create policy "members create conversations" on public.conversations for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "members read conversation participants" on public.conversation_members for select to authenticated
  using (public.omegia_is_conversation_member(conversation_id));
create policy "conversation creator adds members" on public.conversation_members for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = (select auth.uid())
    )
  );
create policy "members read conversation messages" on public.messages for select to authenticated
  using (public.omegia_is_conversation_member(conversation_id));
create policy "members send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and public.omegia_is_conversation_member(conversation_id)
);
create policy "senders edit own messages" on public.messages for update to authenticated
  using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
create policy "senders delete own messages" on public.messages for delete to authenticated using (sender_id = (select auth.uid()));

-- Droits explicites : rien pour les visiteurs ; les membres n'ont que ce que les règles autorisent, sur des colonnes sûres
revoke all on public.profiles, public.friend_requests, public.posts, public.post_reactions, public.post_comments,
  public.stories, public.conversations, public.conversation_members, public.messages from anon;
revoke all on public.profiles, public.friend_requests, public.posts, public.post_reactions, public.post_comments,
  public.stories, public.conversations, public.conversation_members, public.messages from authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, username, avatar_url, cover_url, bio, location, work, school, updated_at) on public.profiles to authenticated;
grant select, insert on public.friend_requests to authenticated;
grant update (status, updated_at) on public.friend_requests to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant update (body, media_url, media_type, visibility, updated_at) on public.posts to authenticated;
grant select, insert, delete on public.post_reactions to authenticated;
grant update (reaction) on public.post_reactions to authenticated;
grant select, insert, delete on public.post_comments to authenticated;
grant update (body) on public.post_comments to authenticated;
grant select, insert, delete on public.stories to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert on public.conversation_members to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (body, edited_at) on public.messages to authenticated;

-- Temps réel sur les messages et les publications
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- À faire ensuite : créer un bucket Storage « omegia-media » avec des règles d'accès adaptées avant d'autoriser les téléversements.
