# System Architecture

## 1. Architectural style

Use a **modular monolith** implemented as one Next.js application. The application has a single deployable web/API codebase, but business domains are separated into modules with explicit service boundaries.

Do not introduce microservices for the initial single-institution product.

## 2. Approved stack

- Next.js App Router (JavaScript)
- React
- Cloudflare Workers runtime
- Cloudflare D1 (SQLite)
- Drizzle ORM and Drizzle Kit
- Cloudflare R2 for file objects
- Tailwind CSS and shadcn/ui
- Zod for runtime validation
- React Hook Form for forms
- TanStack Query only where client-side cache/server-state behavior is needed
- Wrangler for local development, bindings and deployment
- GitHub Actions for CI

## 3. Cloudflare Next.js deployment path

Cloudflare's current documentation recommends **vinext** for new Next.js applications on Workers. Validate it with a compatibility spike before committing the production foundation.

The spike must test:
- App Router pages and layouts
- Server Components
- Route Handlers
- Authentication/session cookie handling
- D1 access from server-side code
- R2 access and signed upload/download flow
- Zod validation and required Node-compatible dependencies
- Build, preview and production deployment
- Error monitoring and logging

If a required feature is incompatible, evaluate Cloudflare's documented OpenNext adapter and record the reason for choosing it. Avoid relying on unsupported Node APIs or undocumented runtime behavior.

## 4. Runtime and request flow

1. Browser requests a Next.js page or API endpoint over HTTPS.
2. Cloudflare Workers executes the application.
3. Middleware/layout may perform coarse routing checks, but must not be the only authorization boundary.
4. Route Handler validates input and resolves the authenticated user/session.
5. Application service applies business rules and resource-level authorization.
6. Repository/data-access function queries D1 through Drizzle.
7. File operations use R2 bindings; D1 stores object metadata, not file bytes.
8. Response returns only fields permitted for the requesting role.

## 5. Module boundaries

- `auth`: OTP challenges, verification, sessions, logout and revocation
- `users`: user accounts, account state and role assignments
- `students`: student profiles, admission numbers and lifecycle
- `parents`: guardian profiles and parent-student relationships
- `academics`: academic sessions, classes, subjects and enrollments
- `teachers`: teacher profiles and teaching assignments
- `attendance`: daily and period/session attendance
- `performance`: daily evaluations and remarks
- `examinations`: examination setup, subject configuration, marks and results
- `timetable`: class schedules, teacher schedules and conflict checks
- `finance`: fee plans, student fee overrides, invoices, invoice items, payments, allocations and receipts
- `reports`: academic and financial read models/exports
- `audit`: immutable event history for sensitive operations
- `storage`: R2 upload metadata and access policy

Modules may call other modules through exported service functions. Avoid circular dependencies and direct cross-module table manipulation from UI code.

## 6. Suggested source structure

```text
src/
  app/
    (auth)/
    (admin)/
    (teacher)/
    (student)/
    (parent)/
    api/
  modules/
    auth/
      auth.service.js
      auth.repository.js
      auth.schemas.js
      auth.permissions.js
    students/
      students.service.js
      students.repository.js
      students.schemas.js
    finance/
      finance.service.js
      finance.repository.js
      finance.schemas.js
  components/
    ui/
    layout/
    data-display/
    forms/
  lib/
    auth/
    db/
    cloudflare/
    validation/
    http/
    dates/
    money/
  hooks/
  config/
drizzle/
  migrations/
  schema/
tests/
  unit/
  integration/
  e2e/
```

Use `.js` / `.jsx` consistently. Drizzle's examples and tooling are TypeScript-oriented; validate JavaScript schema/config support in the setup spike. If Drizzle Kit requires a TypeScript config or schema in the pinned version, use the minimum tooling-only TypeScript file only after explicitly amending the “JavaScript throughout” decision. Do not let Antigravity quietly introduce TS files.

## 7. Database access and migrations

- Access D1 using the request's Cloudflare environment binding.
- Do not create a long-lived global database client that captures request-specific bindings.
- Initialize the Drizzle D1 client from the current request/runtime environment.
- Use Drizzle schema definitions as the source of truth.
- Generate reviewed SQL migrations and commit them.
- Apply migrations to local D1 first, then staging, then production.
- Never use destructive schema push commands against production.
- Keep migration files immutable after deployment; create a new migration to correct a mistake.
- Seed only synthetic development data; never put real student data in Git.

## 8. Financial consistency

D1 batch operations are transactional and execute statements sequentially. Critical multi-statement financial workflows must use an atomic D1 batch workflow supported by the selected Drizzle/D1 integration, or a carefully reviewed D1 prepared-statement batch at the repository boundary.

Examples:
- Create invoice + invoice items.
- Record payment + allocations + receipt number.
- Reverse/void payment with corresponding allocation adjustments and audit event.

Integration tests must prove rollback if any statement fails. Do not assume a generic ORM transaction API is supported until verified for the pinned Drizzle D1 driver.

Store currency as integer paise (`amountPaise`). Never use floating-point arithmetic for money.

## 9. D1 capacity and performance

D1 is SQLite-backed and each individual database is single-threaded. Current Cloudflare limits list a maximum database size of 500 MB on Free and 10 GB on Workers Paid. Keep queries indexed, minimize round trips, batch related operations, paginate lists and avoid unbounded report queries.

Before production:
- Estimate record growth and file storage separately.
- Benchmark common flows with representative data.
- Estimate peak concurrent attendance/fee-entry periods.
- Establish a capacity alert and growth review.
- Reassess the database choice if workload or data size approaches platform constraints.

One D1 database is appropriate for the approved single-institution initial scope. Do not create one database per student or per module.

## 10. Authentication and authorization

- OTP challenge and authenticated session are separate records.
- Store only a hash of OTP values.
- OTPs expire, have attempt limits and are single-use.
- Apply request throttling and resend cooldowns.
- Do not reveal account existence in OTP request responses.
- Use secure, HttpOnly, SameSite cookies for browser sessions, with Secure in production.
- Revoke sessions on logout, account deactivation and sensitive credential changes.
- Enforce role and resource authorization in services/route handlers.
- Parent queries must constrain every student resource by verified parent-student links.
- Teacher queries must constrain every student resource by current authorized assignments and any explicitly approved historical-access policy.

## 11. File storage

- Store photographs/documents in R2.
- Store object key, owner, category, content type, size, checksum and upload timestamp in D1.
- Validate file type and size on the server.
- Use private objects by default.
- Issue short-lived authorized download URLs or stream through an authorization-checked route.
- Never trust a client-supplied object key as proof of access.

## 12. Observability and operations

- Structured logs with request/correlation IDs.
- Never log OTP values, session tokens, passwords or sensitive student data.
- Capture application exceptions and Worker errors.
- Health endpoint must not expose secrets or internal details.
- Monitor D1 query failures, latency, database size and Worker errors.
- Document backup/restore and perform a restore drill before pilot.
