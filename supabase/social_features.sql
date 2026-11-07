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
