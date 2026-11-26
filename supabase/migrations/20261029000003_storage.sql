insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resources', 'resources', false, 20971520, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'image/png', 'image/jpeg', 'application/zip'
  ]),
  ('assignment-files', 'assignment-files', false, 20971520, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'image/png', 'image/jpeg', 'application/zip'
  ]),
  ('submissions', 'submissions', false, 20971520, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'image/png', 'image/jpeg', 'application/zip'
  ])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy resources_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'resources' and
  (public.is_admin() or public.teaches_course((storage.foldername(name))[1]::uuid)
    or public.is_enrolled((storage.foldername(name))[1]::uuid))
);
create policy resources_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'resources' and public.teaches_course((storage.foldername(name))[1]::uuid)
);
create policy resources_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'resources' and public.teaches_course((storage.foldername(name))[1]::uuid)
);

create policy assignment_files_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'assignment-files' and exists (
    select 1 from public.assignments a
    where a.id = (storage.foldername(name))[2]::uuid
      and a.course_id = (storage.foldername(name))[1]::uuid
      and (public.is_admin() or public.teaches_course(a.course_id) or public.is_enrolled(a.course_id))
  )
);
create policy assignment_files_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-files' and exists (
    select 1 from public.assignments a
    where a.id = (storage.foldername(name))[2]::uuid
      and a.course_id = (storage.foldername(name))[1]::uuid
      and public.teaches_course(a.course_id)
  )
);
create policy assignment_files_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'assignment-files' and exists (
    select 1 from public.assignments a
    where a.id = (storage.foldername(name))[2]::uuid and public.teaches_course(a.course_id)
  )
);

create policy submissions_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'submissions' and exists (
    select 1 from public.assignments a
    where a.id = (storage.foldername(name))[1]::uuid and (
      (storage.foldername(name))[2] = (select auth.uid())::text or
      public.teaches_course(a.course_id) or public.is_admin()
    )
  )
);
create policy submissions_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions' and
  (storage.foldername(name))[2] = (select auth.uid())::text and exists (
    select 1 from public.assignments a
    where a.id = (storage.foldername(name))[1]::uuid
      and public.is_enrolled(a.course_id) and (a.allow_late or now() <= a.due_at)
  )
);
create policy submissions_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'submissions' and
  (storage.foldername(name))[2] = (select auth.uid())::text and exists (
    select 1 from public.assignments a where a.id = (storage.foldername(name))[1]::uuid
      and (a.allow_late or now() <= a.due_at)
  )
);
