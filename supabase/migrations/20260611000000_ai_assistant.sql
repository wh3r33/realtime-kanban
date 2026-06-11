create table if not exists public.card_checklist_items (
    id uuid primary key default gen_random_uuid(),
    card_id uuid not null references public.cards(id) on delete cascade,
    title text not null,
    is_done boolean not null default false,
    position integer not null default 0,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists card_checklist_items_card_id_position_idx
on public.card_checklist_items(card_id, position);

alter table public.cards
add column if not exists ai_priority integer;

alter table public.cards
add column if not exists ai_priority_reason text;

drop trigger if exists set_card_checklist_items_updated_at on public.card_checklist_items;
create trigger set_card_checklist_items_updated_at
before update on public.card_checklist_items
for each row execute function public.set_updated_at();

alter table public.card_checklist_items enable row level security;

drop policy if exists "board members can select checklist items" on public.card_checklist_items;
create policy "board members can select checklist items"
on public.card_checklist_items for select
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.is_board_member(c.board_id)
  )
);

drop policy if exists "owners and editors can insert checklist items" on public.card_checklist_items;
create policy "owners and editors can insert checklist items"
on public.card_checklist_items for insert
to authenticated
with check (
  (created_by = auth.uid() or created_by is null)
  and exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
);

drop policy if exists "owners and editors can update checklist items" on public.card_checklist_items;
create policy "owners and editors can update checklist items"
on public.card_checklist_items for update
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
);

drop policy if exists "owners and editors can delete checklist items" on public.card_checklist_items;
create policy "owners and editors can delete checklist items"
on public.card_checklist_items for delete
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_checklist_items.card_id
      and public.has_board_role(c.board_id, array['owner', 'editor'])
  )
);

do $$
begin
  alter publication supabase_realtime add table public.card_checklist_items;
exception
  when duplicate_object then
    raise notice 'public.card_checklist_items is already in the supabase_realtime publication.';
  when undefined_object then
    raise notice 'supabase_realtime publication does not exist; enable Realtime in the Supabase dashboard if needed.';
end;
$$;
