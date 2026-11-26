create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'teacher', 'student')),
  roll_no text unique,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  teacher_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (course_id, student_id)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  attachment_path text,
  total_marks numeric(6,2) not null check (total_marks > 0),
  due_at timestamptz not null,
  allow_late boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_path text,
  text_answer text,
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  marks_obtained numeric(6,2),
  feedback text,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  instructions text,
  duration_minutes int not null check (duration_minutes > 0),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null,
  question_text text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_index int not null check (correct_index >= 0),
  marks numeric(5,2) not null default 1 check (marks > 0),
  unique (quiz_id, position)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  score numeric(6,2),
  unique (quiz_id, student_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.profiles(id),
  course_id uuid references public.courses(id) on delete set null,
  category text not null check (category in ('academic', 'marks', 'teacher', 'technical', 'other')),
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'rejected')),
  admin_response text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(subject) between 1 and 150),
  check (char_length(description) between 1 and 3000)
);

create index enrollments_student_id_idx on public.enrollments (student_id);
create index resources_course_id_idx on public.resources (course_id);
create index assignments_course_due_idx on public.assignments (course_id, due_at);
create index submissions_student_id_idx on public.submissions (student_id);
create index chat_messages_course_created_idx on public.chat_messages (course_id, created_at desc);
create index complaints_raised_by_status_idx on public.complaints (raised_by, status);
create index courses_teacher_id_idx on public.courses (teacher_id);
create index quiz_attempts_student_id_idx on public.quiz_attempts (student_id);
create index announcements_course_created_idx on public.announcements (course_id, created_at desc);

create view public.marks_overview with (security_invoker = true) as
select s.student_id, a.course_id, 'assignment'::text as kind, a.id as item_id,
       a.title, s.marks_obtained as obtained, a.total_marks as total, s.graded_at
from public.submissions s
join public.assignments a on a.id = s.assignment_id
where s.marks_obtained is not null
union all
select qa.student_id, q.course_id, 'quiz'::text as kind, q.id as item_id,
       q.title, qa.score as obtained,
       (select coalesce(sum(qq.marks), 0) from public.quiz_questions qq where qq.quiz_id = q.id) as total,
       qa.submitted_at as graded_at
from public.quiz_attempts qa
join public.quizzes q on q.id = qa.quiz_id
where qa.score is not null;
