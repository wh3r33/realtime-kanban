alter table public.board_invites
add column if not exists declined_at timestamptz,
add column if not exists revoked_at timestamptz;

drop index if exists board_invites_pending_unique_idx;
create unique index if not exists board_invites_pending_unique_idx
on public.board_invites(board_id, lower(email))
where accepted_at is null
  and declined_at is null
  and revoked_at is null;

drop policy if exists "owners can read invites" on public.board_invites;
drop policy if exists "owners can create invites" on public.board_invites;
drop policy if exists "owners can delete invites" on public.board_invites;
drop policy if exists "owners and editors can read invites" on public.board_invites;
drop policy if exists "owners and editors can create invites" on public.board_invites;
drop policy if exists "owners and editors can update invites" on public.board_invites;
drop policy if exists "invited users can read own invites" on public.board_invites;
drop policy if exists "invited users can update own invites" on public.board_invites;

create policy "owners and editors can read invites"
on public.board_invites
for select
to authenticated
using (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "invited users can read own invites"
on public.board_invites
for select
to authenticated
using (lower(email) = lower(auth.email()));

create policy "owners and editors can create invites"
on public.board_invites
for insert
to authenticated
with check (
    public.user_has_board_role(board_id, array['owner', 'editor']::text[])
    and invited_by = auth.uid()
);

create policy "owners and editors can update invites"
on public.board_invites
for update
to authenticated
using (public.user_has_board_role(board_id, array['owner', 'editor']::text[]))
with check (public.user_has_board_role(board_id, array['owner', 'editor']::text[]));

create policy "invited users can update own invites"
on public.board_invites
for update
to authenticated
using (lower(email) = lower(auth.email()))
with check (lower(email) = lower(auth.email()));

create or replace view public.board_invitations
with (security_invoker = true)
as
select * from public.board_invites;

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
    v_email text := lower(trim(p_email));
    v_invite public.board_invites;
begin
    if not public.user_has_board_role(p_board_id, array['owner', 'editor']::text[]) then
        raise exception 'permission_denied';
    end if;

    if p_role not in ('editor', 'viewer') then
        raise exception 'invalid_role';
    end if;

    if exists (
        select 1
        from public.board_members bm
        join public.profiles p on p.id = bm.user_id
        where bm.board_id = p_board_id
          and lower(p.email) = v_email
    ) then
        raise exception 'already_member';
    end if;

    update public.board_invites
    set revoked_at = now()
    where board_id = p_board_id
      and lower(email) = v_email
      and accepted_at is null
      and declined_at is null
      and revoked_at is null
      and expires_at <= now();

    if exists (
        select 1
        from public.board_invites bi
        where bi.board_id = p_board_id
          and lower(bi.email) = v_email
          and bi.accepted_at is null
          and bi.declined_at is null
          and bi.revoked_at is null
          and bi.expires_at > now()
    ) then
        raise exception 'invite_already_exists';
    end if;

    insert into public.board_invites (
        board_id,
        email,
        role,
        invited_by
    )
    values (
        p_board_id,
        v_email,
        p_role,
        auth.uid()
    )
    returning *
    into v_invite;

    return v_invite;
end;
$$;

create or replace function public.accept_board_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite public.board_invites;
    v_user_email text;
begin
    select coalesce(auth.email(), p.email)
    into v_user_email
    from public.profiles p
    where p.id = auth.uid();

    if v_user_email is null then
        raise exception 'profile_not_found';
    end if;

    select *
    into v_invite
    from public.board_invites
    where id = p_invitation_id
    for update;

    if not found
       or v_invite.accepted_at is not null
       or v_invite.declined_at is not null
       or v_invite.revoked_at is not null
       or v_invite.expires_at <= now() then
        raise exception 'invite_not_found_or_expired';
    end if;

    if lower(v_invite.email) <> lower(v_user_email) then
        raise exception 'email_mismatch';
    end if;

    if exists (
        select 1
        from public.board_members
        where board_id = v_invite.board_id
          and user_id = auth.uid()
    ) then
        raise exception 'already_member';
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
    );

    update public.board_invites
    set accepted_at = now()
    where id = v_invite.id;

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
        v_invite.board_id,
        auth.uid(),
        'invite_accepted',
        'board_invite',
        v_invite.id,
        to_jsonb(v_invite),
        jsonb_build_object(
            'board_id', v_invite.board_id,
            'email', v_invite.email,
            'role', v_invite.role
        )
    );

    return jsonb_build_object(
        'status', 'ok',
        'board_id', v_invite.board_id,
        'role', v_invite.role
    );
end;
$$;

create or replace function public.decline_board_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite public.board_invites;
    v_user_email text;
begin
    select coalesce(auth.email(), p.email)
    into v_user_email
    from public.profiles p
    where p.id = auth.uid();

    if v_user_email is null then
        raise exception 'profile_not_found';
    end if;

    select *
    into v_invite
    from public.board_invites
    where id = p_invitation_id
    for update;

    if not found
       or v_invite.accepted_at is not null
       or v_invite.declined_at is not null
       or v_invite.revoked_at is not null
       or v_invite.expires_at <= now() then
        raise exception 'invite_not_found_or_expired';
    end if;

    if lower(v_invite.email) <> lower(v_user_email) then
        raise exception 'email_mismatch';
    end if;

    update public.board_invites
    set declined_at = now()
    where id = v_invite.id;

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
        v_invite.board_id,
        auth.uid(),
        'invite_declined',
        'board_invite',
        v_invite.id,
        to_jsonb(v_invite),
        jsonb_build_object(
            'board_id', v_invite.board_id,
            'email', v_invite.email,
            'role', v_invite.role
        )
    );

    return jsonb_build_object(
        'status', 'declined',
        'board_id', v_invite.board_id
    );
end;
$$;

create or replace function public.accept_board_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite_id uuid;
begin
    select id
    into v_invite_id
    from public.board_invites
    where token = p_token;

    if v_invite_id is null then
        raise exception 'invite_not_found_or_expired';
    end if;

    return public.accept_board_invitation(v_invite_id);
end;
$$;
