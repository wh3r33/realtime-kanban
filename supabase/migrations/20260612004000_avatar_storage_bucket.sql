-- Create a public avatar bucket and owner-scoped object policies.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "Public avatar images are readable" on storage.objects;
drop policy if exists "Authenticated users can upload avatar images" on storage.objects;
drop policy if exists "Authenticated users can update avatar images" on storage.objects;
drop policy if exists "Authenticated users can delete avatar images" on storage.objects;

create policy "Public avatar images are readable"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "Authenticated users can upload avatar images"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "Authenticated users can update avatar images"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "Authenticated users can delete avatar images"
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);
