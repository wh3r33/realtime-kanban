alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.activity_logs enable row level security;
alter table public.board_invites enable row level security;

create policy "users can read own profile"
on public.profiles
for select
using (id = auth.uid());

create policy "users can update own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "users can insert own profile"
on public.profiles
for insert
with check (id = auth.uid());

create policy "members can read boards"
on public.boards
for select
using (public.kanban_is_board_member(id));

create policy "authenticated users can create boards"
on public.boards
for insert
with check (owner_id = auth.uid());

create policy "owners can update boards"
on public.boards
for update
using (public.user_has_board_role(id, array['owner']::text[]))
with check (public.user_has_board_role(id, array['owner']::text[]));

create policy "owners can delete boards"
on public.boards
for delete
using (public.user_has_board_role(id, array['owner']::text[]));

create policy "members can read board members"
on public.board_members
for select
using (public.kanban_is_board_member(board_id));

create policy "owners can manage board members"
on public.board_members
for all
using (public.user_has_board_role(board_id, array['owner']::text[]))
with check (public.user_has_board_role(board_id, array['owner']::text[]));

create policy "members can read columns"
on public.columns
for select
using (public.kanban_is_board_member(board_id));

create policy "owners and editors can insert columns"
on public.columns
for insert
with check (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "owners and editors can update columns"
on public.columns
for update
using (public.user_has_board_role(board_id, array['owner', 'editor']::text[]))
with check (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "owners and editors can delete columns"
on public.columns
for delete
using (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "members can read cards"
on public.cards
for select
using (public.kanban_is_board_member(board_id));

create policy "owners and editors can insert cards"
on public.cards
for insert
with check (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "owners and editors can update cards"
on public.cards
for update
using (public.user_has_board_role(board_id, array['owner', 'editor']::text[]))
with check (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "owners and editors can delete cards"
on public.cards
for delete
using (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "members can read activity logs"
on public.activity_logs
for select
using (public.kanban_is_board_member(board_id));

create policy "members can insert activity logs"
on public.activity_logs
for insert
with check (public.kanban_is_board_member(board_id));

create policy "owners can read invites"
on public.board_invites
for select
using (public.user_has_board_role(board_id, array['owner']::text[]));

create policy "owners can create invites"
on public.board_invites
for insert
with check (
    public.user_has_board_role(board_id, array['owner']::text[])
    and invited_by = auth.uid()
);

create policy "owners can delete invites"
on public.board_invites
for delete
using (public.user_has_board_role(board_id, array['owner']::text[]));
