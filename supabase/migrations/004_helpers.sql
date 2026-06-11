drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists set_boards_updated_at on public.boards;
drop trigger if exists set_columns_updated_at on public.columns;
drop trigger if exists set_cards_updated_at on public.cards;

drop function if exists public.kanban_is_board_member(uuid) cascade;
drop function if exists public.user_has_board_role(uuid, text[]) cascade;
drop function if exists public.kanban_is_board_owner(uuid) cascade;
drop function if exists public.set_updated_at() cascade;

create function public.kanban_is_board_member(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.board_members bm
        where bm.board_id = p_board_id
          and bm.user_id = auth.uid()
    );
$$;

create function public.user_has_board_role(
    p_board_id uuid,
    p_roles text[]
)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.board_members bm
        where bm.board_id = p_board_id
          and bm.user_id = auth.uid()
          and bm.role = any(p_roles)
    );
$$;

create function public.kanban_is_board_owner(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.user_has_board_role(p_board_id, array['owner']::text[]);
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_boards_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create trigger set_columns_updated_at
before update on public.columns
for each row execute function public.set_updated_at();

create trigger set_cards_updated_at
before update on public.cards
for each row execute function public.set_updated_at();
