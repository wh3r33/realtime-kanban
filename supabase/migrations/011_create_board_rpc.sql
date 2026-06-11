create or replace function public.create_board(
    p_title text,
    p_description text default null
)
returns public.boards
language plpgsql
security definer
set search_path = public
as $$
declare
    v_board public.boards;
begin
    insert into public.boards (
        title,
        description,
        owner_id
    )
    values (
        p_title,
        p_description,
        auth.uid()
    )
    returning *
    into v_board;

    insert into public.board_members (
        board_id,
        user_id,
        role
    )
    values (
        v_board.id,
        auth.uid(),
        'owner'
    );

    insert into public.columns (board_id, title, position)
    values
        (v_board.id, 'To Do', 1000),
        (v_board.id, 'In Progress', 2000),
        (v_board.id, 'Done', 3000);

    insert into public.activity_logs (
        board_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data
    )
    values (
        v_board.id,
        auth.uid(),
        'board_created',
        'board',
        v_board.id,
        null,
        to_jsonb(v_board)
    );

    return v_board;
end;
$$;
