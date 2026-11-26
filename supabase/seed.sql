-- Development seed only. Fake .test addresses; never run against production.
-- Shared temporary password: ClassroomDemo2026. Every profile requires a password change.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Avery Admin"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mira.teacher@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Mira Shah"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'omar.teacher@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Omar Siddiqui"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'student1@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Noor Ahmed"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'student2@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Rayyan Malik"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'student3@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ayla Khan"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'student4@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Zain Ali"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'student5@classroom.test', extensions.crypt('ClassroomDemo2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hana Raza"}'::jsonb, now(), now())
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.profiles (id, full_name, email, role, roll_no, is_active, must_change_password)
values
  ('00000000-0000-4000-8000-000000000001', 'Avery Admin', 'admin@classroom.test', 'admin', null, true, true),
  ('00000000-0000-4000-8000-000000000002', 'Mira Shah', 'mira.teacher@classroom.test', 'teacher', null, true, true),
  ('00000000-0000-4000-8000-000000000003', 'Omar Siddiqui', 'omar.teacher@classroom.test', 'teacher', null, true, true),
  ('00000000-0000-4000-8000-000000000011', 'Noor Ahmed', 'student1@classroom.test', 'student', 'GT-1001', true, true),
  ('00000000-0000-4000-8000-000000000012', 'Rayyan Malik', 'student2@classroom.test', 'student', 'GT-1002', true, true),
  ('00000000-0000-4000-8000-000000000013', 'Ayla Khan', 'student3@classroom.test', 'student', 'GT-1003', true, true),
  ('00000000-0000-4000-8000-000000000014', 'Zain Ali', 'student4@classroom.test', 'student', 'GT-1004', true, true),
  ('00000000-0000-4000-8000-000000000015', 'Hana Raza', 'student5@classroom.test', 'student', 'GT-1005', true, true)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  roll_no = excluded.roll_no,
  is_active = true,
  must_change_password = true;

insert into public.courses (id, code, title, description, teacher_id)
values
  ('10000000-0000-4000-8000-000000000001', 'CS-101', 'Foundations of Computing', 'Development-only sample course.', '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000002', 'MA-102', 'Applied Mathematics', 'Development-only sample course.', '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003', 'EN-103', 'Academic Writing', 'Development-only sample course.', '00000000-0000-4000-8000-000000000003')
on conflict (id) do update set
  code = excluded.code,
  title = excluded.title,
  description = excluded.description,
  teacher_id = excluded.teacher_id;

insert into public.enrollments (course_id, student_id)
select c.id, p.id
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid),
  ('10000000-0000-4000-8000-000000000002'::uuid),
  ('10000000-0000-4000-8000-000000000003'::uuid)
) as c(id)
cross join (values
  ('00000000-0000-4000-8000-000000000011'::uuid),
  ('00000000-0000-4000-8000-000000000012'::uuid),
  ('00000000-0000-4000-8000-000000000013'::uuid),
  ('00000000-0000-4000-8000-000000000014'::uuid),
  ('00000000-0000-4000-8000-000000000015'::uuid)
) as p(id)
on conflict (course_id, student_id) do nothing;
