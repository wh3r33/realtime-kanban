create index idx_boards_owner_id on public.boards(owner_id);

create index idx_board_members_board_id on public.board_members(board_id);
create index idx_board_members_user_id on public.board_members(user_id);
create index idx_board_members_role on public.board_members(role);

create index idx_columns_board_id on public.columns(board_id);
create index idx_columns_position on public.columns(board_id, position);

create index idx_cards_board_id on public.cards(board_id);
create index idx_cards_column_id on public.cards(column_id);
create index idx_cards_position on public.cards(column_id, position);
create index idx_cards_status on public.cards(status);
create index idx_cards_assigned_to on public.cards(assigned_to);

create index idx_activity_logs_board_id on public.activity_logs(board_id);
create index idx_activity_logs_user_id on public.activity_logs(user_id);
create index idx_activity_logs_created_at on public.activity_logs(created_at desc);

create index idx_board_invites_board_id on public.board_invites(board_id);
create index idx_board_invites_email on public.board_invites(email);
create index idx_board_invites_token on public.board_invites(token);