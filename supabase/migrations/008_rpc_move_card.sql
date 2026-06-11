create or replace function public.move_card(
    p_card_id uuid,
    p_target_column_id uuid,
    p_new_position numeric,
    p_expected_version integer
)
returns public.cards
language plpgsql
security definer
set search_path = public
as $$
declare
    v_card public.cards;
    v_target_board_id uuid;
    v_updated_card public.cards;
begin
    select *
    into v_card
    from public.cards
    where id = p_card_id
    and status = 'active';

    if not found then
        raise exception 'card_not_found';
    end if;

    if not public.user_has_board_role(v_card.board_id, array['owner', 'editor']::text[]) then
        raise exception 'permission_denied';
    end if;

    select board_id
    into v_target_board_id
    from public.columns
    where id = p_target_column_id;

    if not found then
        raise exception 'target_column_not_found';
    end if;

    if v_target_board_id <> v_card.board_id then
        raise exception 'column_from_another_board';
    end if;

    if v_card.version <> p_expected_version then
        raise exception 'version_conflict';
    end if;

    update public.cards
    set
        column_id = p_target_column_id,
        position = p_new_position,
        version = version + 1,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_card_id
    and version = p_expected_version
    returning *
    into v_updated_card;

    if not found then
        raise exception 'version_conflict';
    end if;

    return v_updated_card;
end;
$$;