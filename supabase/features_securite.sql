-- OMEGIA : durcissement des tables du menu. À exécuter APRÈS supabase/features.sql. Réexécutable.

-- Mail : le destinataire ne peut modifier que read_at (pas le contenu ni l'expéditeur)
revoke all on public.mail_messages from anon;
revoke update on public.mail_messages from authenticated;
grant update (read_at) on public.mail_messages to authenticated;

-- Aucun accès anonyme aux nouvelles tables
revoke all on public.user_blocks, public.groups, public.group_members, public.group_posts, public.pages,
  public.page_follows, public.page_posts, public.events, public.event_rsvps, public.reels, public.ads,
  public.support_tickets from anon;
-- Colonnes modifiables limitées
revoke update on public.groups, public.pages, public.events from authenticated;
grant update (name, description) on public.groups to authenticated;
grant update (name, description, category) on public.pages to authenticated;
grant update (title, description, location, starts_at) on public.events to authenticated;
revoke update on public.group_members, public.page_follows, public.event_rsvps from authenticated;
grant update (status) on public.event_rsvps to authenticated;
revoke update, delete on public.support_tickets from authenticated;
revoke update on public.reels, public.group_posts, public.page_posts from authenticated;

-- Le test de blocage ne révèle que les blocages qui concernent l'appelant
create or replace function public.omegia_is_blocked(p_blocker uuid, p_blocked uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select (auth.uid() in (p_blocker, p_blocked))
     and exists (select 1 from public.user_blocks where blocker_id = p_blocker and blocked_id = p_blocked)
$$;

-- Un compte bloqué ne peut plus écrire à celui qui l'a bloqué (messages et mails)
create or replace function public.omegia_blocked_in_conversation(target_conversation uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members cm
    join public.user_blocks b on b.blocker_id = cm.user_id and b.blocked_id = auth.uid()
    where cm.conversation_id = target_conversation and cm.user_id <> auth.uid());
$$;
revoke execute on function public.omegia_blocked_in_conversation(uuid) from anon, public;
grant execute on function public.omegia_blocked_in_conversation(uuid) to authenticated;
revoke execute on function public.omegia_is_blocked(uuid, uuid) from anon, public;
grant execute on function public.omegia_is_blocked(uuid, uuid) to authenticated;

drop policy if exists omegia_block_messages on public.messages;
create policy omegia_block_messages on public.messages as restrictive for insert to authenticated
  with check (not public.omegia_blocked_in_conversation(conversation_id));
drop policy if exists omegia_block_mail on public.mail_messages;
create policy omegia_block_mail on public.mail_messages as restrictive for insert to authenticated
  with check (not public.omegia_is_blocked(recipient_id, auth.uid()));
-- Les publications d'un compte bloqué (dans un sens ou dans l'autre) disparaissent du fil
drop policy if exists omegia_block_posts on public.posts;
create policy omegia_block_posts on public.posts as restrictive for select to authenticated
  using (not public.omegia_is_blocked(author_id, auth.uid()) and not public.omegia_is_blocked(auth.uid(), author_id));
