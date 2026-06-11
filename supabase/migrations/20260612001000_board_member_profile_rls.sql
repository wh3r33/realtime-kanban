drop policy if exists "board members can read shared profiles" on public.profiles;
create policy "board members can read shared profiles"
on public.profiles
for select
using (
    id = auth.uid()
    or exists (
        select 1
        from public.board_members target_member
        join public.board_members current_member
          on current_member.board_id = target_member.board_id
        where target_member.user_id = profiles.id
          and current_member.user_id = auth.uid()
    )
);
