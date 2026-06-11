create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    v_email text;
    v_name text;
    v_avatar_url text;
begin
    v_email := nullif(
        btrim(coalesce(new.email, metadata->>'email', '')),
        ''
    );
    if v_email is null then
        v_email := new.id::text || '@invalid.local';
    end if;

    v_name := nullif(
        btrim(
            coalesce(
                metadata->>'name',
                metadata->>'full_name',
                metadata->>'display_name',
                metadata->>'user_name',
                metadata->>'username',
                split_part(coalesce(new.email, metadata->>'email', ''), '@', 1)
            )
        ),
        ''
    );

    v_avatar_url := nullif(
        btrim(
            coalesce(
                metadata->>'avatar_url',
                metadata->>'picture',
                metadata->>'avatar',
                metadata->>'photo_url'
            )
        ),
        ''
    );

    insert into public.profiles (id, email, name, avatar_url)
    values (new.id, v_email, v_name, v_avatar_url)
    on conflict (id) do update
      set email = excluded.email,
          name = excluded.name,
          avatar_url = excluded.avatar_url,
          updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
