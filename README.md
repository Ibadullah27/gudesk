# Classroom Management System

An internal classroom management application for one institution. The user confirmed migrations 001-004 were executed in the `GUTECH-LLM` Supabase project. Do not reapply those SQL files.

## Architecture

- `frontend/`: React 18, Vite, React Router, TanStack Query, Tailwind, React Hook Form, Zod, and Supabase JS for Auth and Realtime.
- `backend/`: Node 20 and Express, with Zod validation, Helmet, strict CORS, rate limits, Pino logging, and layered route/controller/service/repository modules.
- `supabase/`: ordered SQL migrations, RLS/storage policies, and development-only seed data.
- API requests use the Supabase access token in `Authorization: Bearer`. The service-role secret stays in `backend/.env` and is never bundled for the browser.

## Requirements

- Node.js 20.19+ and npm.
- Supabase project URL, publishable/anon key, and service-role key. Keep the service-role key only in the backend environment.
- The user reports migrations 001-004 have already been applied in the SQL Editor. CLI migration history has not been reconciled.

## Setup

1. Copy `backend/.env.example` to `backend/.env`, and `frontend/.env.example` to `frontend/.env`. Fill in each app's required values. The root `.env.example` is a reference only.
2. Install and run each application in a separate terminal:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

3. The API health endpoint is `http://localhost:3001/health`; Vite defaults to `http://localhost:5173`.
4. Configure Supabase Auth SMTP and allow the frontend URL plus `/reset-password` before relying on password recovery email in production.
5. `supabase/seed.sql` is for local development only. Never apply its shared demo password/accounts to the institution project.

Environment validation fails fast while placeholders remain. `.env` files are ignored by Git.

## Feature requirement map

| PDF requirement | Phase | Implementation and status |
| --- | --- | --- |
| FR 1: Login | 1 | `backend/src/routes/auth.routes.js`; `frontend/src/pages/auth/`; implemented; live API checks pass, Supabase authenticated round trip pending network access |
| FR 2: Teacher resources and student marks | 4 and 7 | Teacher resource upload/list/delete and enrolled-student/admin download implemented in Phase 4; gradebook and student marks implemented in Phase 7 |
| FR 3: Courses and student assignment | 2 and 3 | Phase 2 course creation/editing and Phase 3 student enrollment are implemented |
| FR 4: Assignments/submissions | 5 | Teacher assignment CRUD, student submissions/resubmissions, attachment upload, deadline/late checks, and submission roster implemented; Supabase round trip pending network access |
| FR 5: Quizzes | 6 | Implemented; apply migration 007 before using timed attempts |
| FR 6: Announcements | 8 | Implemented; live Supabase visibility checks pending |
| FR 7: Grading | 7 | Implemented; live Supabase grading and marks checks pending |
| FR 8: Classroom chat | 9 | Implemented; live multi-user Realtime checks pending |
| FR 9: Complaints | 10 | Implemented; live private-access checks pending |
| FR 10: Password recovery | 1 and 2 | Self-service reset implemented in Phase 1; admin temporary-password reset implemented in Phase 2 |
| FR 11: Admin panel | 2 | Account creation/list/edit/deactivation, password reset, CSV import, and course management implemented |
| FR 12: Role dashboards and polish | 11 | Implemented in `frontend/src/pages/workspace/DashboardOverview.jsx` and `backend/src/routes/dashboard.routes.js`; includes role-scoped metrics, deadlines, loading/empty/error states, and responsive layout |
| User-requested profile page | 11 | Implemented in `frontend/src/pages/workspace/ProfileWorkspace.jsx` and `/api/me/profile`; supports name, contact email, phone, private photo, current-password verification, and role-specific course information; requires migration 008 |
| User-requested notifications | 11 | Implemented in `frontend/src/components/NotificationCenter.jsx` and `/api/notifications`; RLS-protected event notifications, read status, realtime updates, and 24-hour assignment/quiz reminders; requires migration 008 |

## Phase status

### Phase 0: Foundation and database

- User-confirmed migrations 001-004 succeeded in Supabase; seed data was not run against that project.
- Existing migration files include schema, RLS/storage policies, and quiz totals for the marks view.
- Phase 11 adds `20261030000008_profile_notifications.sql` for profile contact/photo fields, the private avatars bucket, notification storage/RLS/triggers, and Realtime publication. Run migration 008 once in the SQL Editor before using profiles or notifications. Migration 007 is required for quiz attempts; migrations 005-006 cover resource indexing/storage ownership.
- Before a future `supabase db push`, compare remote migration history. If versions 001-004 are missing, reconcile them with `supabase migration repair 20261029000001 20261029000002 20261029000003 20261029000004 --status applied`; after manually applying migrations 005-006, reconcile those versions too before using `db push`; this records the SQL Editor changes without rerunning SQL. Do not use `--include-seed` on the institution project.

### Phase 1: Authentication

- Implemented login with rate limiting, token verification, role-aware routing, active-profile checks, change password, and non-enumerating forgot-password behavior.
- Local API checks passed: `/health` 200, unauthenticated `/api/auth/me` 401, invalid login generic 401, forgot-password generic 200. Frontend production build passed.
- Supabase authenticated login/password-change checks could not be completed because temporary Auth user setup returned a network failure from this execution environment.
- Password recovery email requires Supabase SMTP and an allowed reset redirect URL.

### Phase 2: Admin panel and course management

- Admin endpoints: `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/bulk`, and `POST /api/admin/users/:id/reset-password`.
- Course endpoints: `GET /api/courses` (role-scoped), `GET /api/courses/teachers`, `POST /api/courses`, and `PATCH /api/courses/:id`.
- The admin workspace supports account search/filter/pagination, create/edit/deactivate/reactivate, temporary-password resets, CSV import, and course create/edit with active teacher assignment. Teacher/student workspaces show their scoped course list.
- Existing `profiles`/`courses` tables, foreign keys, indexes, and RLS policies already cover Phase 2; no schema change was required, so no migration was added.
- Frontend production build and backend syntax checks passed. The API is running on port 3001 with Phase 2-5 routes loaded; unauthenticated protected routes return 401.
- Database-backed account/course actions remain unverified here because this execution environment cannot reach Supabase; verify them from an environment with Supabase connectivity.

### Phase 3: Course enrollment

- Added `GET /api/courses/:id/students`, `POST /api/courses/:id/enroll`, `DELETE /api/courses/:id/enroll/:studentId`, and `POST /api/courses/:id/enroll/bulk`.
- Admins can manage all course rosters; teachers can manage only their own courses. Only active student accounts can be newly enrolled. Duplicate IDs/roll numbers are ignored, inactive or unknown roll numbers are returned, and removing an enrollment leaves past submissions and marks intact.
- Admin and teacher course screens include a searchable, paginated roster dialog with multi-select enrollment, individual removal, and CSV roll-number import.
- Existing enrollment table, unique constraint, indexes, and RLS policies cover this phase; no migration was added.
- Frontend build, backend syntax/schema validation, and unauthenticated route guards were checked. Supabase-backed roster and enrollment flows remain unverified due to network access from this environment.

### Phase 4: Resources and private storage

- Added upload URL, resource registration, course-scoped list, signed download, and resource delete API endpoints.
- Private `resources` bucket rules in migration 003 enforce course membership, file types, and the 20 MB limit; the API validates metadata and course roles too. Downloads use 60-second signed URLs.
- Teacher course cards and admin course management open a resource dialog. Teachers upload with progress/retry and delete their own resources; admins and enrolled students can download.
- Added migrations `20261029000005_resource_indexes.sql` and `20261029000006_resource_storage_ownership.sql` for unique paths, efficient course/date pagination, and uploader-only storage deletion. Apply both once in the Supabase SQL Editor, in order; migrations 001-004 remain untouched.
- Frontend production build, backend syntax/validation, and route authentication checks passed. Database-backed upload/download depends on Supabase network access.
- Supabase Storage JS does not expose a per-link expiry for signed upload tokens; their lifetime is controlled by the Supabase Storage service. Download URLs are explicitly set to 60 seconds and upload tokens are restricted to one path with overwrite disabled.
### Phase 5: Assignments and submissions

- Added teacher assignment create/edit/list/delete, student course-scoped list and own-submission view, teacher paginated submission roster, and signed attachment/submission downloads.
- Teacher attachments and student submissions use private Storage buckets and signed upload URLs. Server and bucket validate the allowed file types and 20 MB limit.
- The database `submit_assignment` RPC and trigger set the authoritative submission timestamp and late status. Students may replace a submission before its deadline or after it when late work is enabled; past submission lateness is not rewritten when an assignment due date changes.
- Assignment deletion asks for confirmation when submissions exist, then cascades records and cleans up assignment/submission files.
- No migration was needed: assignment/submission tables, RPC, triggers, buckets, and RLS policies are in existing migrations 001-003. User reports migration 006 was pasted; Phase 5 did not modify it.
- Frontend production build and backend syntax/schema validation pass. The API health and protected assignment routes return 200/401 respectively. Actual storage and deadline-flow acceptance checks need Supabase connectivity.

### Phase 6: Quizzes

- Teachers can create timed multiple-choice quizzes, add/edit questions before any attempt, set marks and availability windows, publish/unpublish, and review paginated results.
- Students see only published quizzes in their enrolled courses, start one attempt, autosave answers, see the server-calculated countdown, and submit or auto-submit at timeout. Correct answers are removed from all student-facing payloads; the database performs authoritative scoring.
- Added `supabase/migrations/20261029000007_quiz_attempts.sql`. Run it once in the Supabase SQL Editor before testing quiz attempt endpoints. It provides atomic start/save/submit and question replacement operations with caller identity checks and server time. No prior migration should be rerun.
- Frontend production build, backend syntax and quiz schema checks pass. Local health returns 200 and unauthenticated quiz routes return 401. Supabase-backed timed attempts and scoring remain to be verified after migration 007 is applied.

### Phase 7: Grading and marks

- Teachers can grade or regrade assignment submissions with marks and feedback; the `grade_submission` database function checks teacher course ownership, enforces the assignment maximum, and updates `graded_at` on every save.
- The teacher gradebook combines assignment submissions and published quiz attempts, paginates enrolled students, shows pending/not submitted/in progress states distinctly, and exports the current page as CSV.
- Students have a Marks workspace with per-course graded totals and percentages, assignment feedback, and explicit pending/unsubmitted/unfinished states. Percentages use graded assessments only; ungraded work is excluded from numerator and denominator.
- Existing grading RPC, marks view, schema, and RLS policies in migrations 001, 002, and 004 cover this phase; no new migration was needed. Frontend build, backend syntax/schema checks, API health and unauthenticated route guards passed. Supabase-backed grade validation and view/RLS checks remain unverified here.

### Phase 8: Announcements

- Added scoped, newest-first, paginated announcements with create/edit/delete endpoints. Supabase RLS is applied through the caller's token, and the backend also checks role, teacher course ownership, and author ownership.
- Administrators can post global announcements; teachers can post only to courses they teach; students are read-only. The dashboard shows the latest feed, and the Announcements page provides the full feed and author controls.
- Existing announcements table and RLS policies in migrations 001-002 cover this phase; no migration was needed. Frontend production build, backend syntax/schema checks, API health and unauthenticated route guards passed. Live role/scope visibility checks need Supabase connectivity.

### Phase 9: Classroom chat

- Added course-scoped history (`GET /api/courses/:id/chat?before=...`), message send (`POST /api/courses/:id/chat`), and teacher/admin moderation delete (`DELETE /api/chat/:messageId`). History is returned oldest-to-newest in 50-message pages.
- Teachers and enrolled students can read and send; admins can read and moderate but cannot send. Backend course checks and caller-scoped Supabase requests complement the existing chat RLS. Sends are limited to 12 per user per minute; messages are trimmed and capped at 2,000 characters.
- Course chat dialog subscribes to filtered Supabase Realtime inserts/deletes, reconnects after connection loss, loads older messages, preserves scroll position, and follows new messages only when the reader is at the bottom. Message content renders as plain text.
- Existing chat table, RLS, index, and Realtime publication in migrations 001-002 cover this phase; no migration was needed. Frontend production build, backend syntax/schema checks, API health and unauthenticated route guards passed. Two-user instant delivery and non-member checks require Supabase connectivity.

### Phase 10: Complaints

- Students and teachers can submit a complaint with category, optional accessible course, subject, and description, then track its status and admin response. Submitted complaints cannot be edited by the reporter.
- Administrators have a paginated queue with status/category filters and can move complaints through open, in review, resolved, and rejected states. A non-empty response is required to resolve or reject; each update records the responder and timestamp.
- Owner/admin-only complaint visibility is enforced by existing RLS and caller-scoped Supabase queries, with backend role and owner scoping as well. Existing complaint table, indexes, and policies in migrations 001-002 cover this phase; no migration was needed.
- Frontend production build, backend syntax and complaint schema checks pass. API health returns 200 and unauthenticated complaint routes return 401. Owner-versus-other-user Supabase checks remain unverified without project connectivity.

### Phase 11: Dashboards, profiles, notifications, and polish

- Added role-specific dashboard summaries: students see course count, pending assignments/quizzes, and upcoming deadlines; teachers see course count, ungraded submissions, and upcoming deadlines; admins see active users, courses, and open complaints.
- Added a profile page for editing display name, contact email, and phone; uploading/removing a private JPG/PNG/WebP photo; changing password after verifying the current password; and viewing role-specific course information.
- Added private, owner-scoped notifications for announcements, assignments, assignment/quiz deadline reminders, published quizzes, grades, complaint updates, enrollments, and resources. Notifications support pagination, unread counts, mark-read actions, Realtime updates, and polling for scheduled reminders.
- Added migration `20261030000008_profile_notifications.sql`. Run it once in the Supabase SQL Editor. Do not rerun migrations 001-007. It adds profile columns, avatar storage policies, the notifications table/RLS policies, event triggers, and Realtime publication membership.
- Dashboard/profile/notification data views include loading, empty, and error handling. Local backend syntax checks, frontend production build, API health, and unauthenticated route checks are recorded below; live data, upload, RLS, and multi-user realtime behavior still require a connected Supabase environment and migration 008.

### Requirements pass and UI refresh

- **Sidebar per role (§8):** each section is now a real URL (`/admin/users`, `/admin/courses`, `/teacher/courses`, `/student/marks`, `/{role}/announcements`, `/{role}/complaints`, `/{role}/profile`; the dashboard is `/{role}`). Refresh and browser back keep your place; unknown or other-role sections redirect to the caller's dashboard.
- **Admin panel:** Users and Courses are separate sidebar pages instead of dashboard tabs. The admin dashboard shows metrics, quick actions, and the latest announcements. Admins can no longer see a Deactivate button on their own account, and deactivating asks for confirmation. The stale "enrollment is the next phase" card was replaced with roster instructions.
- **Teacher/student dashboards:** greeting, metrics, upcoming deadlines, a preview of up to six courses (with "View all"), and the latest announcements. The full course list with search is under My courses.
- **Toasts (§8):** successful actions now raise a toast in addition to the inline notice. Quiz autosave notices stay inline to avoid noise.
- **Expired sessions (§7.1):** any API response with `401 UNAUTHORIZED` signs the user out locally, which sends them to `/login`.
- **Styling:** added styles for previously unstyled dashboard stat cards, deadline badges, profile cards, toasts, skip link, and status dots; refreshed sidebar, top bar (shows the current page), course cards, and surfaces in light and dark mode.
- Checked with `npm run build` and in the browser against a local mock API (student and admin roles, desktop and mobile). Live Supabase flows were not exercised in this pass.

### TanStack Query data layer

- All API reads now go through TanStack Query (spec §2). `frontend/src/lib/queryClient.js` holds the shared client and `useApiQuery(key, path, params, options)`, which caches each GET under its path segments plus params.
- Writes still call `apiFetch`, then invalidate the affected keys. For example, grading invalidates the course, its gradebook, student marks, and dashboards, and roster changes invalidate that course and the dashboards.
- Defaults: 30-second freshness, no refetch on window focus, no retries for 4xx responses, and the previous page stays visible while the next one loads. Notifications poll every 60 seconds and refresh on Realtime events.
- The cache is cleared on sign-out, so a second account on the same browser never sees the first account's data.
- Classroom chat is intentionally left outside the cache because it merges a live Realtime stream with history and scroll state.
- Fixed while migrating: quiz results pagination passed a function instead of a page number to the API, so Next/Previous on results did not work.
- Checked with `npm run build` and in the browser against the mock API as a teacher: dashboard, course dialogs, notifications, and save-then-refetch on the profile page.

## Vercel deployment

- Two Vercel projects in the `ib-587e` team: **gudesk-web** (`frontend/`, https://gudesk-web.vercel.app) and **gudesk-api** (`backend/`, https://gudesk-api.vercel.app).
- The API runs as one serverless function: `backend/api/index.js` exports the Express app and `backend/vercel.json` routes every path to it. Local `npm run dev` is unchanged. On Vercel the app trusts one proxy hop so rate limits apply per caller.
- `frontend/vercel.json` rewrites all paths to `index.html` so deep links such as `/student/marks` load on refresh.
- Production env vars are stored in each Vercel project. **gudesk-api:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_AUDIENCE`, and `CLIENT_ORIGIN=https://gudesk-web.vercel.app`. **gudesk-web:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=https://gudesk-api.vercel.app/api`. The service role key exists only in the API project.
- `.vercelignore` in each app keeps local `.env` files out of uploads.
- Redeploy after changes: `vercel deploy --prod` from `backend/` or `frontend/`. If either URL changes, update the other project's `CLIENT_ORIGIN` or `VITE_API_URL` and redeploy that project; the frontend reads `VITE_*` values at build time.
- Supabase Auth must allow `https://gudesk-web.vercel.app/reset-password` as a redirect URL (Authentication → URL Configuration) for password-reset emails.

## Running and checking

- `npm run dev` in `backend/` starts the API in watch mode.
- `npm run dev` in `frontend/` starts Vite.
- `npm start` in `backend/` starts the API without watch mode.
- `npm run build` in `frontend/` builds the production bundle.
- For a production API, set `NODE_ENV=production`, configure exact `CLIENT_ORIGIN`, and provide the Supabase URL, publishable key, and service-role key in `backend/.env`. Deploy the frontend static `frontend/dist` directory and set `VITE_API_BASE_URL` to the deployed API origin before building.
- Apply ordered SQL migrations only once. Since earlier migrations were executed manually, inspect/reconcile Supabase CLI migration history before using `supabase db push`; never use `db push` until remote versions are reconciled to avoid replaying SQL. Apply migration 008 in SQL Editor if it has not already been run.
- All API errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`; paginated lists include `meta` with page, pageSize, and total.

See [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) for implementation decisions and verification limits.
