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
