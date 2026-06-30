# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Marketplace — Project Memory

## Stack
TypeScript everywhere. Express (API), React 18 + Vite (web), PostgreSQL 16 + Drizzle ORM,
Vitest (tests), Docker, GitHub Actions (CI). Modular monolith — one repo, bounded modules.
Do NOT split into microservices without an ADR.

## Layout
- `/src/modules/{catalog,cart,checkout,orders,identity}` — bounded contexts; each exposes a typed interface (e.g. `catalog/index.ts`). Cross-module calls go through that interface only — never import from another module's internals.
- `/src/db` — Drizzle schema (`schema.ts`) + migration files; schema is frozen unless explicitly asked to change
- `/api/openapi.yaml` — FROZEN API contract; backend AND web derive types from it (do not hand-write API types)
- `/web` — React 18 + Vite frontend
- `/docs/{prd,adr,specs}` — FROZEN artifacts, read-only to implementers

## Commands
Install: `npm ci` · Dev: `npm run dev` · Test: `npm test` · Lint: `npm run lint`
Typecheck: `npm run typecheck` · Migrate: `npm run db:migrate`
Single test: `npm test -- --reporter=verbose <path-or-test-name-pattern>`

## Invariants (NEVER violate — if the spec conflicts, STOP and report, do not edit the spec)
- Auth = JWT in httpOnly secure cookies. NEVER localStorage.
- All money = integer minor units (cents). Never floats.
- All prices/tax/totals computed SERVER-side. The client never sets a price.
- Modules communicate through their published interface, never another module's internals.
- Migrations are forward-only and human-approved before apply.
- FROZEN ARTIFACTS — read-only to all implementation work:
  /docs/adr/**, /docs/prd/**, /api/openapi.yaml, /src/db/schema.ts
  Implementers READ these; they NEVER edit them. If one seems wrong or
  under-specified during build, STOP and escalate to the human — do not
  "fix" it by editing the spec or weakening a test.
- All user-facing UI is built from the design system in web/src/components/ui
  and the tokens in tailwind.config. No raw/unstyled HTML elements and no
  ad-hoc inline styles for UI. If a needed primitive is missing, ADD it to the
  design system — never one-off it. Every interactive element has visible
  focus, hover, disabled, loading, empty, and error states.
- Every web page except the standalone auth flows (/login, /register,
  /register/seller, /forgot-password, /reset-password) MUST be a child route
  inside <AppShell> (web/src/components/layout/AppShell.tsx). The AppShell
  header must be visible and must show the current user's display name, role
  badge, and logout control. Never add a new routed page outside this layout
  without an explicit exception in the spec.

## Conventions
- Conventional commits (feat/fix/chore/...). One concern per PR.
- Tests are written from the spec, NOT from the implementation.
- Do not edit /docs/adr, /docs/prd, /api/openapi.yaml, or /src/db/schema.ts unless explicitly asked.

## /compact policy
When summarizing: preserve all API/schema decisions + rationale, the list of modified files,
and any failing-test findings. Summarize exploration attempts in one line each.