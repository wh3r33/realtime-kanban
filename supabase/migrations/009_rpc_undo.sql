create or replace function public.undo_last_action(p_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_log public.activity_logs;
    v_old jsonb;
    v_new jsonb;
begin
    if not public.user_has_board_role(p_board_id, array['owner', 'editor']::text[]) then
        raise exception 'permission_denied';
    end if;

    select *
    into v_log
    from public.activity_logs
    where board_id = p_board_id
    and user_id = auth.uid()
    and action in ('card_created', 'card_updated', 'card_moved', 'card_deleted')
    order by created_at desc
    limit 1;

    if not found then
        raise exception 'nothing_to_undo';
    end if;

    v_old := v_log.old_data;
    v_new := v_log.new_data;

    if v_log.action = 'card_created' then
        update public.cards
        set
            status = 'deleted',
            version = version + 1,
            updated_by = auth.uid(),
            updated_at = now()
        where id = v_log.entity_id;

    elsif v_log.action = 'card_deleted' then
        update public.cards
        set
            status = 'active',
            version = version + 1,
            updated_by = auth.uid(),
            updated_at = now()
        where id = v_log.entity_id;

    elsif v_log.action in ('card_updated', 'card_moved') then
        update public.cards
        set
            column_id = (v_old->>'column_id')::uuid,
            title = v_old->>'title',
            description = v_old->>'description',
            position = (v_old->>'position')::numeric,
            assigned_to = nullif(v_old->>'assigned_to', '')::uuid,
            labels = coalesce(v_old->'labels', '[]'::jsonb),
            status = v_old->>'status',
            version = version + 1,
            updated_by = auth.uid(),
            updated_at = now()
        where id = v_log.entity_id;
    end if;

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
        p_board_id,
        auth.uid(),
        'undo_performed',
        v_log.entity_type,
        v_log.entity_id,
        v_new,
        v_old
    );

    return jsonb_build_object(
        'status', 'ok',
        'undone_action', v_log.action,
        'entity_id', v_log.entity_id
    );
end;
$$;