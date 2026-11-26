# Repository Guidelines

## Project Structure & Module Organization

This is a classroom-management system with separate applications:

- `frontend/` is the React 18/Vite client. Place shared UI in `src/components/`, authentication in `src/auth/`, and route-level screens in `src/pages/` (for example, `pages/workspace/`).
- `backend/` is the Node 20/Express API. Keep feature layers aligned: `routes/` register endpoints, `controllers/` handle HTTP concerns, `services/` contain business rules, `repositories/` access Supabase, and `schemas/` hold Zod validation.
- `supabase/migrations/` contains ordered SQL schema, RLS, storage, and feature migrations. `supabase/seed.sql` is local-development data only.
- `docs/` holds project decisions and assumptions. Environment templates are `*.env.example`; never commit actual `.env` files.

## Build, Test, and Development Commands

Run commands from the relevant app directory after `npm install`.

- `cd backend; npm run dev` starts the API with Node watch mode; `npm start` starts it normally. Check `http://localhost:3001/health`.
- `cd frontend; npm run dev` serves the Vite app (normally `http://localhost:5173`).
- `cd frontend; npm run build` creates the production bundle in `frontend/dist/`.
- `cd frontend; npm run preview` serves the built bundle for a local production check.

There is no automated test, lint, or formatting script configured yet. At minimum, run the frontend production build and manually exercise affected API routes before opening a PR.

## Coding Style & Naming Conventions

Use ES modules and match the surrounding JavaScript/JSX style: two-space indentation, semicolons, single quotes, and trailing commas where present. Name React components and files in `PascalCase` (for example, `NotificationCenter.jsx`); use lowercase feature filenames with a suffix for API layers (for example, `courses.controller.js`, `courses.repository.js`). Keep validation in Zod schemas and preserve the existing route/controller/service/repository separation.

## Database, Security & Configuration

Treat migrations as append-only and apply them in timestamp order. Do not rerun migrations 001-004, which the project documentation says were applied manually; reconcile remote history before using `supabase db push`. Keep service-role credentials in `backend/.env` only, and do not expose them through Vite variables. Never use the shared demo credentials in `seed.sql` against the institution project.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout, so use concise imperative subjects such as `Add quiz submission validation`. Keep commits focused. PRs should explain the user-visible change, note migration or environment changes, link the relevant issue when available, include screenshots for UI changes, and state the commands and manual checks performed.
