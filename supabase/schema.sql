-- Realtime Kanban Supabase setup
-- Paste this whole file into the Supabase SQL Editor and run it.
-- This file is intentionally non-destructive: it does not drop existing tables.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  owner_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint columns_board_id_title_key unique (board_id, title)
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid not null references public.columns(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  ai_priority integer,
  ai_priority_reason text,
  assigned_to uuid references public.users(id) on delete set null,
  created_by uuid not null references public.users(id) on delete restrict,
  status text not null default 'active',
  labels jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_labels_is_array check (jsonb_typeof(labels) = 'array'),
  constraint cards_version_positive check (version >= 1)
);

create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint board_members_board_id_user_id_key unique (board_id, user_id),
  constraint board_members_role_check check (role in ('owner', 'editor', 'viewer'))
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.card_checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_invitations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references public.users(id) on delete cascade,
  accepted_by uuid references public.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  constraint board_invitations_role_check check (role in ('editor', 'viewer'))
);

alter table public.cards add column if not exists deleted_at timestamptz;

create index if not exists boards_owner_id_idx on public.boards(owner_id);
create index if not exists columns_board_id_idx on public.columns(board_id);
create index if not exists cards_board_id_idx on public.cards(board_id);
create index if not exists cards_column_id_idx on public.cards(column_id);
create index if not exists cards_active_order_idx on public.cards(board_id, column_id, position) where deleted_at is null;
create index if not exists board_members_board_id_idx on public.board_members(board_id);
create index if not exists board_members_user_id_idx on public.board_members(user_id);
create index if not exists activity_logs_board_id_idx on public.activity_logs(board_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists card_checklist_items_card_id_position_idx on public.card_checklist_items(card_id, position);
create index if not exists card_comments_card_id_created_at_idx on public.card_comments(card_id, created_at desc);
create index if not exists board_invitations_board_id_idx on public.board_invitations(board_id);
create index if not exists board_invitations_email_idx on public.board_invitations(lower(email));
create unique index if not exists board_invitations_pending_unique_idx
on public.board_invitations(board_id, lower(email))
where accepted_at is null and revoked_at is null;

do $$
begin
  alter table public.cards add constraint cards_position_not_negative check (position >= 0);
exception
  when duplicate_object then
    null;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if tg_table_name = 'cards' and new.version is not distinct from old.version then
    new.version = old.version + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_boards_updated_at on public.boards;
create trigger set_boards_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

drop trigger if exists set_columns_updated_at on public.columns;
create trigger set_columns_updated_at
before update on public.columns
for each row execute function public.set_updated_at();

drop trigger if exists set_cards_updated_at on public.cards;
create trigger set_cards_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

drop trigger if exists set_card_checklist_items_updated_at on public.card_checklist_items;
create trigger set_card_checklist_items_updated_at
before update on public.card_checklist_items
for each row execute function public.set_updated_at();

drop trigger if exists set_card_comments_updated_at on public.card_comments;
create trigger set_card_comments_updated_at
before update on public.card_comments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_board_member(check_board_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = check_board_id
      and bm.user_id = check_user_id
  );
$$;

create or replace function public.has_board_role(check_board_id uuid, allowed_roles text[], check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = check_board_id
      and bm.user_id = check_user_id
      and bm.role = any(allowed_roles)
  );
$$;

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

  select least(
    normalized_position,
    greatest(0, count(*)::integer)
  )
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

create or replace function public.restore_card(restore_card_id uuid)
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

create or replace function public.restore_card(restore_card_id uuid, expected_version integer default null)
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

create or replace function public.accept_board_invitation(invite_token text)
returns public.board_members
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.board_invitations;
  membership public.board_members;
begin
  select * into invitation
  from public.board_invitations
  where token = invite_token
    and revoked_at is null
    and accepted_at is null
    and expires_at > now()
  for update;

  if invitation.id is null then
    raise exception 'Invitation is invalid, expired, accepted, or revoked.';
  end if;

  if lower(invitation.email) <> lower(coalesce((select u.email from public.users u where u.id = auth.uid()), '')) then
    raise exception 'Invitation email does not match the signed-in user.';
  end if;

  insert into public.board_members (board_id, user_id, role, invited_by)
  values (invitation.board_id, auth.uid(), invitation.role, invitation.invited_by)
  on conflict (board_id, user_id) do update
  set role = excluded.role,
      invited_by = excluded.invited_by
  returning * into membership;

  update public.board_invitations
  set accepted_by = auth.uid(),
      accepted_at = now()
  where id = invitation.id;

  perform public.log_board_activity(
    invitation.board_id,
    'invite_accepted',
    'board_member',
    membership.id,
    null,
    to_jsonb(membership)
  );

  return membership;
end;
$$;

alter table public.users enable row level security;
alter table public.boards enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.card_checklist_items enable row level security;
alter table public.card_comments enable row level security;
alter table public.board_members enable row level security;
alter table public.activity_logs enable row level security;
alter table public.board_invitations enable row level security;

drop policy if exists "users can select own profile" on public.users;
create policy "users can select own profile"
on public.users for select
to authenticated
using (id = auth.uid());

drop policy if exists "board members can select shared profiles" on public.users;
create policy "board members can select shared profiles"
on public.users for select
to authenticated
using (
  exists (
    select 1
    from public.board_members target_member
    join public.board_members current_member
      on current_member.board_id = target_member.board_id
    where target_member.user_id = users.id
      and current_member.user_id = auth.uid()
  )
);

drop policy if exists "users can update own profile" on public.users;
create policy "users can update own profile"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users can insert own profile fallback" on public.users;
create policy "users can insert own profile fallback"
on public.users for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "authenticated users can create own boards" on public.boards;
create policy "authenticated users can create own boards"
on public.boards for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "board members can select boards" on public.boards;
create policy "board members can select boards"
on public.boards for select
to authenticated
using (public.is_board_member(id));

drop policy if exists "owners can select boards before membership exists" on public.boards;
create policy "owners can select boards before membership exists"
on public.boards for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "owners and editors can update boards" on public.boards;
create policy "owners and editors can update boards"
on public.boards for update
to authenticated
using (public.has_board_role(id, array['owner', 'editor']))
with check (public.has_board_role(id, array['owner', 'editor']));

drop policy if exists "owners can delete boards" on public.boards;
create policy "owners can delete boards"
on public.boards for delete
to authenticated
using (public.has_board_role(id, array['owner']));

drop policy if exists "members can select board members of their boards" on public.board_members;
create policy "members can select board members of their boards"
on public.board_members for select
to authenticated
using (public.is_board_member(board_id));

drop policy if exists "owners can insert members" on public.board_members;
create policy "owners can insert members"
on public.board_members for insert
to authenticated
with check (public.has_board_role(board_id, array['owner']));

drop policy if exists "users can insert themselves as owner during board creation" on public.board_members;
create policy "users can insert themselves as owner during board creation"
on public.board_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "owners can update member roles" on public.board_members;
create policy "owners can update member roles"
on public.board_members for update
to authenticated
using (public.has_board_role(board_id, array['owner']))
with check (public.has_board_role(board_id, array['owner']));

drop policy if exists "owners can delete members" on public.board_members;
create policy "owners can delete members"
on public.board_members for delete
to authenticated
using (public.has_board_role(board_id, array['owner']));

drop policy if exists "board members can select columns" on public.columns;
create policy "board members can select columns"
on public.columns for select
to authenticated
using (public.is_board_member(board_id));

drop policy if exists "owners and editors can insert columns" on public.columns;
create policy "owners and editors can insert columns"
on public.columns for insert
to authenticated
with check (public.has_board_role(board_id, array['owner', 'editor']));

drop policy if exists "owners and editors can update columns" on public.columns;
create policy "owners and editors can update columns"
on public.columns for update
to authenticated
using (public.has_board_role(board_id, array['owner', 'editor']))
with check (public.has_board_role(board_id, array['owner', 'editor']));

drop policy if exists "owners and editors can delete columns" on public.columns;
create policy "owners and editors can delete columns"
on public.columns for delete
to authenticated
using (public.has_board_role(board_id, array['owner', 'editor']));

drop policy if exists "board members can select cards" on public.cards;
create policy "board members can select cards"
on public.cards for select
to authenticated
using (public.is_board_member(board_id));

drop policy if exists "owners and editors can insert cards" on public.cards;
create policy "owners and editors can insert cards"
on public.cards for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_board_role(board_id, array['owner', 'editor'])
  and exists (
    select 1
    from public.columns c
    where c.id = column_id
      and c.board_id = cards.board_id
  )
);

drop policy if exists "owners and editors can update cards" on public.cards;
create policy "owners and editors can update cards"
on public.cards for update
to authenticated
using (public.has_board_role(board_id, array['owner', 'editor']))
with check (
  public.has_board_role(board_id, array['owner', 'editor'])
  and exists (
    select 1
    from public.columns c
    where c.id = column_id
      and c.board_id = cards.board_id
  )
);

drop policy if exists "owners and editors can delete cards" on public.cards;
create policy "owners and editors can delete cards"
on public.cards for delete
to authenticated
using (public.has_board_role(board_id, array['owner', 'editor']));

drop policy if exists "board members can select checklist items" on public.card_checklist_items;
create policy "board members can select checklist items"
on public.card_checklist_items for select
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.is_board_member(c.board_id)
  )
);

drop policy if exists "owners and editors can insert checklist items" on public.card_checklist_items;
create policy "owners and editors can insert checklist items"
on public.card_checklist_items for insert
to authenticated
with check (
  (created_by = auth.uid() or created_by is null)
  and exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
);

drop policy if exists "owners and editors can update checklist items" on public.card_checklist_items;
create policy "owners and editors can update checklist items"
on public.card_checklist_items for update
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
);

drop policy if exists "owners and editors can delete checklist items" on public.card_checklist_items;
create policy "owners and editors can delete checklist items"
on public.card_checklist_items for delete
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
);

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

drop policy if exists "board members can select activity logs" on public.activity_logs;
create policy "board members can select activity logs"
on public.activity_logs for select
to authenticated
using (public.is_board_member(board_id));

drop policy if exists "board members can insert own activity logs" on public.activity_logs;
create policy "board members can insert own activity logs"
on public.activity_logs for insert
to authenticated
with check (user_id = auth.uid() and public.is_board_member(board_id));

drop policy if exists "owners can select board invitations" on public.board_invitations;
create policy "owners can select board invitations"
on public.board_invitations for select
to authenticated
using (public.has_board_role(board_id, array['owner']));

drop policy if exists "invitees can select own pending invitations" on public.board_invitations;
create policy "invitees can select own pending invitations"
on public.board_invitations for select
to authenticated
using (
  revoked_at is null
  and accepted_at is null
  and lower(email) = lower(coalesce((select u.email from public.users u where u.id = auth.uid()), ''))
);

drop policy if exists "owners can create board invitations" on public.board_invitations;
create policy "owners can create board invitations"
on public.board_invitations for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.has_board_role(board_id, array['owner'])
);

drop policy if exists "owners can revoke board invitations" on public.board_invitations;
create policy "owners can revoke board invitations"
on public.board_invitations for update
to authenticated
using (public.has_board_role(board_id, array['owner']))
with check (public.has_board_role(board_id, array['owner']));

grant execute on function public.move_card_safely(uuid, uuid, integer) to authenticated;
grant execute on function public.move_card_safely(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.restore_card(uuid) to authenticated;
grant execute on function public.restore_card(uuid, integer) to authenticated;
grant execute on function public.accept_board_invitation(text) to authenticated;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['boards', 'columns', 'cards', 'card_checklist_items', 'card_comments', 'board_members', 'activity_logs', 'board_invitations']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I.%I', 'public', realtime_table);
    exception
      when duplicate_object then
        raise notice 'public.% is already in the supabase_realtime publication.', realtime_table;
      when undefined_object then
        raise notice 'supabase_realtime publication does not exist; enable Realtime in the Supabase dashboard if needed.';
    end;
  end loop;
end;
$$;

-- Dangerous reset section, intentionally commented out.
-- Only use on a disposable database when you want to erase all app data.
-- drop table if exists public.activity_logs cascade;
-- drop table if exists public.cards cascade;
-- drop table if exists public.columns cascade;
-- drop table if exists public.board_members cascade;
-- drop table if exists public.boards cascade;
-- drop table if exists public.users cascade;
