create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_comments_card_id_created_at_idx
on public.card_comments(card_id, created_at desc);

do $$
begin
  if to_regclass('public.board_invitations') is not null then
    execute '
      create unique index if not exists board_invitations_pending_unique_idx
      on public.board_invitations(board_id, lower(email))
      where accepted_at is null and revoked_at is null
    ';
  else
    raise notice 'public.board_invitations does not exist. Skipping invitation index creation.';
  end if;
end;
$$;

drop trigger if exists set_card_comments_updated_at on public.card_comments;

create trigger set_card_comments_updated_at
before update on public.card_comments
for each row execute function public.set_updated_at();

create or replace function public.log_board_activity(
  log_board_id uuid,
  log_action text,
  log_entity_type text,
  log_entity_id uuid,
  log_old_data jsonb default null,
  log_new_data jsonb default null
)
returns public.activity_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_log public.activity_logs;
begin
  if auth.uid() is null or not public.is_board_member(log_board_id) then
    raise exception 'You do not have permission to write activity for this board.';
  end if;

  insert into public.activity_logs (board_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (log_board_id, auth.uid(), log_action, log_entity_type, log_entity_id, log_old_data, log_new_data)
  returning * into inserted_log;

  return inserted_log;
end;
$$;

create or replace function public.move_card_safely(
  move_card_id uuid,
  target_column_id uuid,
  target_position integer,
  expected_version integer default null
)
returns public.cards
language plpgsql
security definer
set search_path = public
as $$
declare
  before_card public.cards;
  after_card public.cards;
  target_board_id uuid;
  normalized_position integer;
begin
  select * into before_card
  from public.cards
  where id = move_card_id
  for update;

  if before_card.id is null or before_card.deleted_at is not null then
    raise exception 'Card was not found.';
  end if;

  if expected_version is not null and before_card.version <> expected_version then
    raise exception 'CARD_VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  select board_id into target_board_id
  from public.columns
  where id = target_column_id;

  if target_board_id is null or target_board_id <> before_card.board_id then
    raise exception 'Target column does not belong to this board.';
  end if;

  if not public.has_board_role(before_card.board_id, array['owner', 'editor']) then
    raise exception 'You do not have permission to move cards on this board.';
  end if;

  normalized_position := greatest(0, target_position);

  perform 1
  from public.cards
  where board_id = before_card.board_id
    and deleted_at is null
  for update;

  update public.cards
  set position = position - 1
  where board_id = before_card.board_id
    and column_id = before_card.column_id
    and deleted_at is null
    and id <> before_card.id
    and position > before_card.position;

  select least(normalized_position, greatest(0, count(*)::integer))
  into normalized_position
  from public.cards
  where board_id = before_card.board_id
    and column_id = target_column_id
    and deleted_at is null
    and id <> before_card.id;

  update public.cards
  set position = position + 1
  where board_id = before_card.board_id
    and column_id = target_column_id
    and deleted_at is null
    and id <> before_card.id
    and position >= normalized_position;

  update public.cards
  set column_id = target_column_id,
      position = normalized_position
  where id = before_card.id
  returning * into after_card;

  perform public.log_board_activity(
    after_card.board_id,
    'card_moved',
    'card',
    after_card.id,
    to_jsonb(before_card),
    to_jsonb(after_card)
  );

  return after_card;
end;
$$;

create or replace function public.restore_card(
  restore_card_id uuid,
  expected_version integer default null
)
returns public.cards
language plpgsql
security definer
set search_path = public
as $$
declare
  before_card public.cards;
  after_card public.cards;
  restored_position integer;
begin
  select * into before_card
  from public.cards
  where id = restore_card_id
  for update;

  if before_card.id is null then
    raise exception 'Card was not found.';
  end if;

  if expected_version is not null and before_card.version <> expected_version then
    raise exception 'CARD_VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  if not public.has_board_role(before_card.board_id, array['owner', 'editor']) then
    raise exception 'You do not have permission to restore cards on this board.';
  end if;

  select coalesce(max(position) + 1, 0)
  into restored_position
  from public.cards
  where board_id = before_card.board_id
    and column_id = before_card.column_id
    and deleted_at is null;

  update public.cards
  set deleted_at = null,
      status = case when status = 'deleted' then 'active' else status end,
      position = restored_position
  where id = before_card.id
  returning * into after_card;

  perform public.log_board_activity(
    after_card.board_id,
    'card_restored',
    'card',
    after_card.id,
    to_jsonb(before_card),
    to_jsonb(after_card)
  );

  return after_card;
end;
$$;

alter table public.card_comments enable row level security;

drop policy if exists "board members can select card comments" on public.card_comments;

create policy "board members can select card comments"
on public.card_comments for select
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_comments.card_id
      and public.is_board_member(c.board_id)
  )
);

drop policy if exists "owners and editors can insert card comments" on public.card_comments;

create policy "owners and editors can insert card comments"
on public.card_comments for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cards c
    where c.id = card_comments.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
);

drop policy if exists "comment authors and board owners can update comments" on public.card_comments;

create policy "comment authors and board owners can update comments"
on public.card_comments for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.cards c
    where c.id = card_comments.card_id
      and public.has_board_role(c.board_id, array['owner'])
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.cards c
    where c.id = card_comments.card_id
      and public.has_board_role(c.board_id, array['owner'])
  )
);

drop policy if exists "comment authors and board owners can delete comments" on public.card_comments;

create policy "comment authors and board owners can delete comments"
on public.card_comments for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.cards c
    where c.id = card_comments.card_id
      and public.has_board_role(c.board_id, array['owner'])
  )
);

grant execute on function public.move_card_safely(uuid, uuid, integer, integer) to authenticated;

grant execute on function public.restore_card(uuid, integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.card_comments;
exception
  when duplicate_object then
    raise notice 'public.card_comments is already in the supabase_realtime publication.';
  when undefined_object then
    raise notice 'supabase_realtime publication does not exist; enable Realtime in the Supabase dashboard if needed.';
end;
$$;