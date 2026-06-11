create unique index if not exists board_invites_pending_unique_idx
on public.board_invites(board_id, lower(email))
where accepted_at is null;

create table if not exists public.card_comments (
    id uuid primary key default gen_random_uuid(),
    card_id uuid not null references public.cards(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists card_comments_card_id_created_at_idx
on public.card_comments(card_id, created_at desc);

drop trigger if exists set_card_comments_updated_at on public.card_comments;

create trigger set_card_comments_updated_at
before update on public.card_comments
for each row execute function public.set_updated_at();

alter table public.card_comments enable row level security;

drop policy if exists "board members can select card comments" on public.card_comments;
create policy "board members can select card comments"
on public.card_comments for select
to authenticated
using (
    exists (
        select 1
        from public.cards c
        where c.id = card_comments.card_id
          and public.kanban_is_board_member(c.board_id)
    )
);

drop policy if exists "owners and editors can insert card comments" on public.card_comments;
create policy "owners and editors can insert card comments"
on public.card_comments for insert
to authenticated
with check (
    user_id = auth.uid()
    and exists (
        select 1
        from public.cards c
        where c.id = card_comments.card_id
          and public.user_has_board_role(c.board_id, array['owner', 'editor']::text[])
    )
);

drop policy if exists "comment authors can update own comments" on public.card_comments;
create policy "comment authors can update own comments"
on public.card_comments for update
to authenticated
using (
    user_id = auth.uid()
    and exists (
        select 1
        from public.cards c
        where c.id = card_comments.card_id
          and public.user_has_board_role(c.board_id, array['owner', 'editor']::text[])
    )
)
with check (
    user_id = auth.uid()
    and exists (
        select 1
        from public.cards c
        where c.id = card_comments.card_id
          and public.user_has_board_role(c.board_id, array['owner', 'editor']::text[])
    )
);

drop policy if exists "comment authors and owners can delete comments" on public.card_comments;
create policy "comment authors and owners can delete comments"
on public.card_comments for delete
to authenticated
using (
    exists (
        select 1
        from public.cards c
        where c.id = card_comments.card_id
          and (
              card_comments.user_id = auth.uid()
              or public.user_has_board_role(c.board_id, array['owner']::text[])
          )
    )
);

do $$
begin
    alter publication supabase_realtime add table public.card_comments;
exception
    when duplicate_object then
        raise notice 'public.card_comments is already in the supabase_realtime publication.';
    when undefined_object then
        raise notice 'supabase_realtime publication does not exist; enable Realtime in the Supabase dashboard if needed.';
end;
$$;
