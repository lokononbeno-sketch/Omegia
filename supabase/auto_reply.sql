-- OMEGIA : réponse automatique par IA (l'IA se présente toujours comme assistante)
-- À exécuter une fois dans Supabase > SQL Editor.

alter table public.messages add column if not exists is_auto boolean not null default false;

-- Seul le serveur (service_role) peut marquer un message comme automatique.
create or replace function public.messages_guard_is_auto() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.is_auto := false;
  end if;
  return new;
end $$;
drop trigger if exists messages_guard_is_auto on public.messages;
create trigger messages_guard_is_auto before insert on public.messages
  for each row execute function public.messages_guard_is_auto();

create table if not exists public.auto_reply_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  delay_seconds int not null default 60 check (delay_seconds between 10 and 120),
  persona text not null default '' check (char_length(persona) <= 600),
  use_history boolean not null default false,
  max_per_hour int not null default 20 check (max_per_hour between 1 and 60),
  updated_at timestamptz not null default now()
);
alter table public.auto_reply_settings enable row level security;
drop policy if exists "owner manages auto reply" on public.auto_reply_settings;
create policy "owner manages auto reply" on public.auto_reply_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Permet à un contact de savoir (oui/non) que l'assistant IA répond, sans voir les réglages.
create or replace function public.auto_reply_active(peer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.auto_reply_settings where user_id = peer), false)
    and exists (
      select 1 from public.conversation_members a
      join public.conversation_members b on a.conversation_id = b.conversation_id
      where a.user_id = auth.uid() and b.user_id = peer
    );
$$;
revoke all on function public.auto_reply_active(uuid) from public, anon;
grant execute on function public.auto_reply_active(uuid) to authenticated;
