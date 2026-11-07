-- Applied to the Supabase project on 2026-11-07 (migration "create_social_feed").
-- Profiles: public display name of each member (birthdate stays private in auth metadata)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 50),
  last_name text not null default '' check (char_length(last_name) <= 50),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id);
create index likes_user_idx on public.likes (user_id);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_author_idx on public.comments (author_id);

-- Create the profile automatically when a member signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'first_name', ''), 50),
    left(coalesce(new.raw_user_meta_data->>'last_name', ''), 50)
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for members who signed up before this migration
insert into public.profiles (id, first_name, last_name)
select id,
       left(coalesce(raw_user_meta_data->>'first_name', ''), 50),
       left(coalesce(raw_user_meta_data->>'last_name', ''), 50)
from auth.users
on conflict (id) do nothing;

-- Row Level Security: only signed-in members, and everyone edits only their own data
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

create policy "members read profiles" on public.profiles for select to authenticated using (true);
create policy "members update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members read posts" on public.posts for select to authenticated using (true);
create policy "members publish own posts" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "members delete own posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "members read likes" on public.likes for select to authenticated using (true);
create policy "members like as themselves" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "members remove own likes" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "members read comments" on public.comments for select to authenticated using (true);
create policy "members comment as themselves" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "members delete own comments" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- Explicit privileges: nothing for visitors, minimal for members
revoke all on public.profiles, public.posts, public.likes, public.comments from anon;
revoke all on public.profiles, public.posts, public.likes, public.comments from authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant select, insert, delete on public.likes to authenticated;
grant select, insert, delete on public.comments to authenticated;
