drop policy if exists resources_storage_delete on storage.objects;

create policy resources_storage_delete_uploaded
on storage.objects for delete to authenticated
using (
  bucket_id = 'resources' and exists (
    select 1
    from public.resources r
    where r.file_path = name
      and r.uploaded_by = (select auth.uid())
      and public.teaches_course(r.course_id)
  )
);
