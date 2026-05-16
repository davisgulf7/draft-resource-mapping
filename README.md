# Instructional Intelligence Coordination — Demo App

Two browser-based demos for the USF Coordinated Learning Systems IIC service.

## Demo 1 — Resource Mapping
**File:** `resource-mapping.html`

Schools map their instructional resources into a structured database. Demonstrates:
- Viewing existing classroom resource inventories
- Adding a new classroom with device/platform/accommodation details
- Adding resources to a classroom by category

## Demo 2 — Lesson Planner
**File:** `lesson-planner.html`

Teachers converse with an AI that already knows their classroom. Demonstrates:
- Selecting a classroom and seeing the pre-fetched context
- Free conversation with Claude grounded in the classroom's actual resources and student needs
- Resource-aware lesson plan generation

## Setup
Both demos connect to a Supabase backend. The anon key and project URL are embedded in each file (safe — RLS is enabled, public read/insert only, no student PII).

The lesson planner calls a Supabase Edge Function (`lesson-planner`) which holds the Claude API key securely server-side.

## Stack
- HTML / CSS / Vanilla JS
- Supabase JS client (CDN)
- Claude API via Supabase Edge Function
- USF brand styles
