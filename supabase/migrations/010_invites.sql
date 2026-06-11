create or replace function public.create_board_invite(
    p_board_id uuid,
    p_email text,
    p_role text
)
returns public.board_invites
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite public.board_invites;
begin
    if not public.user_has_board_role(p_board_id, array['owner']::text[]) then
        raise exception 'permission_denied';
    end if;

    if p_role not in ('editor', 'viewer') then
        raise exception 'invalid_role';
    end if;

    insert into public.board_invites (
        board_id,
        email,
        role,
        invited_by
    )
    values (
        p_board_id,
        lower(trim(p_email)),
        p_role,
        auth.uid()
    )
    returning *
    into v_invite;

    return v_invite;
end;
$$;

create or replace function public.accept_board_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite public.board_invites;
    v_user_email text;
begin
    select email
    into v_user_email
    from public.profiles
    where id = auth.uid();

    if v_user_email is null then
        raise exception 'profile_not_found';
    end if;

    select *
    into v_invite
    from public.board_invites
    where token = p_token
      and accepted_at is null
      and expires_at > now();

    if not found then
        raise exception 'invite_not_found_or_expired';
    end if;

    if lower(v_invite.email) <> lower(v_user_email) then
        raise exception 'email_mismatch';
    end if;

    insert into public.board_members (
        board_id,
        user_id,
        role,
        invited_by
    )
    values (
        v_invite.board_id,
        auth.uid(),
        v_invite.role,
        v_invite.invited_by
    )
    on conflict (board_id, user_id)
    do update set role = excluded.role;

    update public.board_invites
    set accepted_at = now()
    where id = v_invite.id;

    return jsonb_build_object(
        'status', 'ok',
        'board_id', v_invite.board_id,
        'role', v_invite.role
    );
end;
$$;
