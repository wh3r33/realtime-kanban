create or replace function public.log_card_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_action text;
    v_user_id uuid;
begin
    v_user_id := coalesce(new.updated_by, new.created_by, auth.uid());

    if tg_op = 'INSERT' then
        v_action := 'card_created';

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
            new.board_id,
            coalesce(new.created_by, auth.uid()),
            v_action,
            'card',
            new.id,
            null,
            to_jsonb(new)
        );

        return new;
    end if;

    if tg_op = 'UPDATE' then
        if old.column_id is distinct from new.column_id
           or old.position is distinct from new.position then
            v_action := 'card_moved';
        elsif old.status is distinct from new.status and new.status = 'deleted' then
            v_action := 'card_deleted';
        else
            v_action := 'card_updated';
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
            new.board_id,
            coalesce(new.updated_by, auth.uid()),
            v_action,
            'card',
            new.id,
            to_jsonb(old),
            to_jsonb(new)
        );

        return new;
    end if;

    if tg_op = 'DELETE' then
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
            old.board_id,
            auth.uid(),
            'card_hard_deleted',
            'card',
            old.id,
            to_jsonb(old),
            null
        );

        return old;
    end if;

    return null;
end;
$$;

drop trigger if exists cards_activity_log_trigger on public.cards;

create trigger cards_activity_log_trigger
after insert or update or delete on public.cards
for each row execute function public.log_card_changes();