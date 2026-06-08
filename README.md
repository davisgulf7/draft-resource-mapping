# Instructional Intelligence Coordination — Demo App

Static-HTML demo app for the USF Coordinated Learning Systems IIC service.
Auth, role-based access, AI-grounded lesson planning, and a Quill rich-text
lesson editor — all without a build step.

## Roles

Self-signup with role chosen at signup. Demo-grade; replace with invite
codes / admin-creates-teacher for production.

- **Teacher** — manages their own classrooms; runs the AI lesson planner
  against any classroom they're linked to; saves and edits lesson plans.
- **School Admin** — manages building-wide resources and the school's
  technology profile; sees every classroom and every saved lesson plan
  (read-only on plans); reassigns teachers across classrooms.

## Pages

| Page | Who | What it does |
|---|---|---|
| `login.html` | Anyone | Email/password sign-in. Redirects to the role-appropriate home. |
| `signup.html` | Anyone | Email/password sign-up; role radio (Teacher / School Admin). |
| `unauthorized.html` | Anyone | Shown when a signed-in user lacks the page's required role. |
| `admin-dashboard.html` | Admin | Stat tiles (classrooms, teachers, school resources, saved plans) + quick-access tiles + recent lessons. **Admin landing page.** |
| `admin-teachers.html` | Admin | Card per teacher with linked-classroom chips; link/unlink controls. |
| `resource-mapping.html` | Both | Dashboard of classrooms (admin = all, teacher = own); add-classroom + add-resource forms; classroom detail view. **Teacher landing page.** |
| `my-classroom.html` | Teacher | Edit classroom info, notes, and resources. Classroom switcher for multi-classroom teachers. URL `?id=` deep-link. |
| `school-resources.html` | Both | **School Profile** panel (admin form / teacher read-only chips) + building-wide resource list (admin CRUD with edit-in-place; teacher read-only). |
| `lesson-planner.html` | Both | Two-pane conversational UI. Left = pre-fetched classroom + school context. Right = streaming Claude chat. Save Lesson Plan button on substantive responses (teacher). |
| `lesson-editor.html` | Teacher | Quill 2 rich-text editor for a saved lesson. Stores both Delta and HTML; Cmd/Ctrl+S; beforeunload guard. |
| `my-lessons.html` | Teacher | Card grid of the signed-in teacher's saved plans. |

Shared scripts loaded by every page:

- `config.js` — `window.sb` Supabase client, `SUPABASE_URL`, `SUPABASE_ANON`.
- `auth.js` — `Auth.requireSession`, `Auth.currentUser`, `Auth.signOut`,
  `Auth.renderUserChip`, `Auth.applyRoleGatedNav`, `Auth.homePathFor`,
  `Auth.goHome`. Role-gated nav via `data-teacher-only` / `data-admin-only`
  attributes.

## Data model (Supabase Postgres)

| Table | Purpose |
|---|---|
| `profiles` | One row per `auth.users` row. `role IN ('teacher','admin')`. Populated by `handle_new_user()` trigger from signup metadata. |
| `classrooms` | One row per classroom. `created_by uuid DEFAULT auth.uid()` lets a teacher read their own row immediately after INSERT (`RETURNING`). |
| `classroom_teachers` | Many-to-many join. Auto-populated by `handle_new_classroom()` AFTER INSERT trigger when a teacher inserts a classroom. |
| `classroom_resources` | Per-classroom resources (category + name + notes). |
| `classroom_notes` | Per-classroom Instructional Context + Student Support Details. |
| `school_profile` | **Singleton** (PK pinned to `'00000000-0000-0000-0000-000000000001'`). School name, primary ecosystem, devices, platforms. |
| `school_resources` | Building-wide resources (admin-managed; readable by all). |
| `lesson_plans` | Saved AI-generated plans. Stores both `content_delta` (Quill JSON, canonical) and `content_html` (rendered for display/print) plus topic, time frame, and source conversation. |

All tables have RLS. Helpers: `auth_role()`, `user_teaches_classroom(uuid)`.

## Edge Function

`supabase/functions/lesson-planner/index.ts` — POST endpoint that builds a
two-block system prompt (cached framework + per-session classroom context)
and streams text deltas from Claude Sonnet 4.5 back to the browser.

Environment secret: `ANTHROPIC_API_KEY`.

## Stack

- HTML + CSS + Vanilla JS (no build step)
- Supabase JS via CDN
- Quill 2 via CDN (rich-text editor)
- USF brand styles (`main.css`)
- Supabase Edge Function (Deno) for the Claude call

## Setup

1. Email confirmation must be **off** in Supabase Dashboard → Auth → Sign In / Providers → Email so signups land directly in a session.
2. Open `signup.html` to create the first admin account.
3. Build out school profile + school resources, sign up teachers, etc.

The Supabase URL and anon key are embedded in `config.js` — safe because RLS
gates every protected row, and the only public-readable rows are the
school profile chip values teachers need to see.
