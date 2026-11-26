create unique index if not exists resources_file_path_unique
  on public.resources (file_path);

create index if not exists resources_course_created_at_idx
  on public.resources (course_id, created_at desc);
