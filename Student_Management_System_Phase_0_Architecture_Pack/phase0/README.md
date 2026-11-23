# Student Management System — Phase 0 Architecture Pack

**Version:** 1.0  
**Status:** Architecture baseline approved; detailed business rules still require sign-off  
**Product:** Single-institution coaching institute + mess-fee management  
**Team:** Two developers using Antigravity as an engineering agent

## Contents

- `docs/PROJECT_OVERVIEW.md` — product vision, boundaries and users
- `docs/PRD_v1.2.md` — requirements baseline, additions and unresolved decisions
- `docs/ARCHITECTURE.md` — application, runtime, modules, security and deployment
- `docs/DATABASE_DESIGN.md` — entity catalogue, constraints, indexing and migration rules
- `docs/ER_DIAGRAM.md` — conceptual Mermaid ER diagram
- `docs/RBAC_MATRIX.md` — initial role and resource access matrix
- `docs/API_DESIGN.md` — REST conventions and initial endpoint catalogue
- `docs/DEVELOPMENT_BACKLOG.md` — epics, tasks, sequencing and two-person ownership
- `docs/TECH_DECISIONS.md` — architecture decision records
- `AGENTS.md` — persistent instructions for Antigravity

## Approved technology baseline

- Next.js App Router, JavaScript
- Cloudflare Workers deployment
- Cloudflare D1 (SQLite)
- Drizzle ORM + Drizzle Kit
- Cloudflare R2 for uploaded files
- Tailwind CSS + shadcn/ui
- Zod and React Hook Form
- WhatsApp Business Platform/provider abstraction for OTP delivery
- GitHub for source control and pull requests

## Important implementation note

Cloudflare currently recommends vinext for new Next.js applications on Workers. Treat this as the deployment path to validate in a short compatibility spike, not as permission to assume every Next.js feature behaves identically. If a required feature is incompatible, evaluate the documented OpenNext path and record the decision before proceeding.

This pack is an architecture baseline, not a fully approved legal or operational specification. Items marked **OPEN** must be resolved before the affected module is implemented.
