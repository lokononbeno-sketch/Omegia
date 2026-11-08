-- FICHIER OBSOLÈTE : il recréait des règles de sécurité trop permissives (auto-acceptation d'invitation,
-- ajout libre aux conversations). Utiliser supabase/schema.sql, puis features.sql et features_securite.sql.
do $$ begin raise exception 'setup_all.sql est obsolète : utiliser supabase/schema.sql'; end $$;

-- OMEGIA — Schéma initial des fonctionnalités sociales (ANCIEN)
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Les données privées sont protégées par Row Level Security.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
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

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_request_not_self check (sender_id <> recipient_id)
);
create unique index if not exists friend_requests_pending_pair
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text check (media_type is null or media_type in ('image','video')),
  visibility text not null default 'friends' check (visibility in ('public','friends')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_has_content check (length(trim(body)) > 0 or media_url is not null)
);

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like','love','haha','wow','sad','angry')),
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text,
  media_type text not null default 'text' check (media_type in ('text','image','video')),
  body text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint story_has_content check (length(trim(body)) > 0 or media_url is not null)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment_url text,
  attachment_type text check (attachment_type is null or attachment_type in ('image','video','file','audio')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint message_has_content check (length(trim(body)) > 0 or attachment_url is not null)
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists stories_active_idx on public.stories(expires_at);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id, status);

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_omegia_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_omegia_auth_user_created on auth.users;
create trigger on_omegia_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_omegia_user();

-- Helper privé pour vérifier l'appartenance à une conversation.
create or replace function public.omegia_is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.stories enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles readable by signed-in members" on public.profiles;
create policy "profiles readable by signed-in members" on public.profiles for select to authenticated using (true);
drop policy if exists "members update own profile" on public.profiles;
create policy "members update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "members read own friend requests" on public.friend_requests;
create policy "members read own friend requests" on public.friend_requests for select to authenticated using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
drop policy if exists "members send friend requests" on public.friend_requests;
create policy "members send friend requests" on public.friend_requests for insert to authenticated with check (sender_id = (select auth.uid()) and recipient_id <> (select auth.uid()));
drop policy if exists "recipients update friend requests" on public.friend_requests;
create policy "recipients update friend requests" on public.friend_requests for update to authenticated using (recipient_id = (select auth.uid()) or sender_id = (select auth.uid())) with check (recipient_id = (select auth.uid()) or sender_id = (select auth.uid()));

drop policy if exists "members read visible posts" on public.posts;
create policy "members read visible posts" on public.posts for select to authenticated using (
  visibility = 'public' or author_id = (select auth.uid()) or exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and ((fr.sender_id = author_id and fr.recipient_id = (select auth.uid()))
        or (fr.recipient_id = author_id and fr.sender_id = (select auth.uid())))
  )
);
drop policy if exists "members create own posts" on public.posts;
create policy "members create own posts" on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "authors delete own posts" on public.posts;
create policy "authors delete own posts" on public.posts for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists "members read reactions" on public.post_reactions;
create policy "members read reactions" on public.post_reactions for select to authenticated using (true);
drop policy if exists "members react as themselves" on public.post_reactions;
create policy "members react as themselves" on public.post_reactions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "members change own reaction" on public.post_reactions;
create policy "members change own reaction" on public.post_reactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "members remove own reaction" on public.post_reactions;
create policy "members remove own reaction" on public.post_reactions for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members read comments" on public.post_comments;
create policy "members read comments" on public.post_comments for select to authenticated using (true);
drop policy if exists "members comment as themselves" on public.post_comments;
create policy "members comment as themselves" on public.post_comments for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "authors edit own comments" on public.post_comments;
create policy "authors edit own comments" on public.post_comments for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "authors delete own comments" on public.post_comments;
create policy "authors delete own comments" on public.post_comments for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists "members read active stories" on public.stories;
create policy "members read active stories" on public.stories for select to authenticated using (expires_at > now());
drop policy if exists "members create own stories" on public.stories;
create policy "members create own stories" on public.stories for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "authors delete own stories" on public.stories;
create policy "authors delete own stories" on public.stories for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists "members read own conversations" on public.conversations;
create policy "members read own conversations" on public.conversations for select to authenticated using (public.omegia_is_conversation_member(id));
drop policy if exists "members create conversations" on public.conversations;
create policy "members create conversations" on public.conversations for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "members read conversation participants" on public.conversation_members;
create policy "members read conversation participants" on public.conversation_members for select to authenticated using (public.omegia_is_conversation_member(conversation_id));
drop policy if exists "conversation creator adds members" on public.conversation_members;
create policy "conversation creator adds members" on public.conversation_members for insert to authenticated with check (
  user_id = (select auth.uid()) or exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.created_by = (select auth.uid())
  )
);
drop policy if exists "members read conversation messages" on public.messages;
create policy "members read conversation messages" on public.messages for select to authenticated using (public.omegia_is_conversation_member(conversation_id));
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and public.omegia_is_conversation_member(conversation_id)
);
drop policy if exists "senders edit own messages" on public.messages;
create policy "senders edit own messages" on public.messages for update to authenticated using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
drop policy if exists "senders delete own messages" on public.messages;
create policy "senders delete own messages" on public.messages for delete to authenticated using (sender_id = (select auth.uid()));

-- Activer Realtime sur les tables utiles (ignorer si déjà présentes).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

-- Important : créer ensuite un bucket Storage nommé "omegia-media"
-- et lui appliquer des règles d'accès adaptées avant d'autoriser les téléversements.


-- OMEGIA : médias audio, statuts et stockage
-- Exécuter dans Supabase > SQL Editor après schema.sql. Réexécutable.
alter table public.stories drop constraint if exists stories_media_type_check;
alter table public.stories add constraint stories_media_type_check check(media_type in ('text','image','video','audio'));
create table if not exists public.statuses(
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null default '',
 media_url text,
 media_type text not null default 'text' check(media_type in ('text','image','video','audio')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '24 hours'),
 constraint status_has_content check(length(trim(body))>0 or media_url is not null)
);
create index if not exists statuses_active_idx on public.statuses(expires_at desc);
alter table public.statuses enable row level security;
drop policy if exists "members read active statuses" on public.statuses;
create policy "members read active statuses" on public.statuses for select to authenticated using(expires_at>now());
drop policy if exists "members create own statuses" on public.statuses;
create policy "members create own statuses" on public.statuses for insert to authenticated with check(author_id=(select auth.uid()));
drop policy if exists "authors delete own statuses" on public.statuses;
create policy "authors delete own statuses" on public.statuses for delete to authenticated using(author_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('omegia-media','omegia-media',true,157286400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/webm','audio/ogg','application/pdf'])
on conflict(id) do update set public=true,file_size_limit=157286400;
drop policy if exists "OMEGIA members upload own media" on storage.objects;
create policy "OMEGIA members upload own media" on storage.objects for insert to authenticated with check(bucket_id='omegia-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "OMEGIA members update own media" on storage.objects;
create policy "OMEGIA members update own media" on storage.objects for update to authenticated using(bucket_id='omegia-media' and owner_id=auth.uid()::text) with check(bucket_id='omegia-media' and owner_id=auth.uid()::text);
drop policy if exists "OMEGIA members delete own media" on storage.objects;
create policy "OMEGIA members delete own media" on storage.objects for delete to authenticated using(bucket_id='omegia-media' and owner_id=auth.uid()::text);
drop policy if exists "OMEGIA public media read" on storage.objects;
create policy "OMEGIA public media read" on storage.objects for select to public using(bucket_id='omegia-media');
do $$ begin alter publication supabase_realtime add table public.statuses; exception when duplicate_object then null; when undefined_object then null; end $$;


-- OMEGIA — activation et durcissement des fonctions pour les tests à deux comptes
-- À exécuter dans Supabase > SQL Editor, sur le projet OMEGIA.
-- Script réexécutable : il ne supprime aucune donnée utilisateur.

create extension if not exists pgcrypto;

-- Statuts 24 h (la table peut déjà exister).
create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text not null default 'text' check (media_type in ('text','image','video','audio')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint status_has_content check (length(trim(body)) > 0 or media_url is not null)
);
create index if not exists statuses_active_idx on public.statuses(expires_at desc);
alter table public.statuses enable row level security;
drop policy if exists "members read active statuses" on public.statuses;
create policy "members read active statuses" on public.statuses for select to authenticated using (expires_at > now());
drop policy if exists "members create own statuses" on public.statuses;
create policy "members create own statuses" on public.statuses for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "authors delete own statuses" on public.statuses;
create policy "authors delete own statuses" on public.statuses for delete to authenticated using (author_id = (select auth.uid()));

-- Le bucket public permet d'afficher les médias partagés; l'envoi reste limité au dossier du compte.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('omegia-media','omegia-media',true,157286400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/webm','audio/ogg','application/pdf'])
on conflict (id) do update set public=true,file_size_limit=157286400,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "OMEGIA members upload own media" on storage.objects;
create policy "OMEGIA members upload own media" on storage.objects for insert to authenticated
with check (bucket_id='omegia-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "OMEGIA members update own media" on storage.objects;
create policy "OMEGIA members update own media" on storage.objects for update to authenticated
using (bucket_id='omegia-media' and owner_id=(select auth.uid())::text)
with check (bucket_id='omegia-media' and owner_id=(select auth.uid())::text);
drop policy if exists "OMEGIA members delete own media" on storage.objects;
create policy "OMEGIA members delete own media" on storage.objects for delete to authenticated
using (bucket_id='omegia-media' and owner_id=(select auth.uid())::text);
drop policy if exists "OMEGIA public media read" on storage.objects;
create policy "OMEGIA public media read" on storage.objects for select to public using (bucket_id='omegia-media');

-- Une invitation ne peut être acceptée/refusée que par son destinataire.
-- Son expéditeur peut uniquement l'annuler tant qu'elle est en attente.
drop policy if exists "recipients update friend requests" on public.friend_requests;
drop policy if exists "recipients respond to friend requests" on public.friend_requests;
create policy "recipients respond to friend requests" on public.friend_requests
for update to authenticated
using (recipient_id=(select auth.uid()) and status='pending')
with check (recipient_id=(select auth.uid()) and status in ('accepted','declined'));
drop policy if exists "senders cancel friend requests" on public.friend_requests;
create policy "senders cancel friend requests" on public.friend_requests
for update to authenticated
using (sender_id=(select auth.uid()) and status='pending')
with check (sender_id=(select auth.uid()) and status='cancelled');

-- Retirer une relation acceptée ou une invitation appartenant à son compte.
drop policy if exists "members remove own friend requests" on public.friend_requests;
create policy "members remove own friend requests" on public.friend_requests
for delete to authenticated
using ((sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and status in ('accepted','pending','declined','cancelled'));

-- Seul le créateur d'une conversation peut ajouter ses participants.
drop policy if exists "conversation creator adds members" on public.conversation_members;
create policy "conversation creator adds members" on public.conversation_members
for insert to authenticated
with check (exists (
  select 1 from public.conversations c
  where c.id=conversation_id and c.created_by=(select auth.uid())
));

-- Ne pas exposer réactions/commentaires de publications que le membre ne peut pas lire.
drop policy if exists "members read reactions" on public.post_reactions;
create policy "members read reactions" on public.post_reactions for select to authenticated
using (exists (select 1 from public.posts p where p.id=post_id));
drop policy if exists "members read comments" on public.post_comments;
create policy "members read comments" on public.post_comments for select to authenticated
using (exists (select 1 from public.posts p where p.id=post_id));
drop policy if exists "members react as themselves" on public.post_reactions;
create policy "members react as themselves" on public.post_reactions for insert to authenticated
with check (user_id=(select auth.uid()) and exists (select 1 from public.posts p where p.id=post_id));
drop policy if exists "members comment as themselves" on public.post_comments;
create policy "members comment as themselves" on public.post_comments for insert to authenticated
with check (author_id=(select auth.uid()) and exists (select 1 from public.posts p where p.id=post_id));

-- Realtime nécessaire pour les messages, publications, invitations, réactions et commentaires.
do $$
declare t text;
begin
  foreach t in array array['messages','posts','friend_requests','post_comments','post_reactions','statuses','stories']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I',t);
    exception when duplicate_object then null;
    when undefined_object then null;
    when undefined_table then null;
    end;
  end loop;
end $$;
