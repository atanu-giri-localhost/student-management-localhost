# AGENTS.md — Student Management System

## Project identity

Build a secure, maintainable Student Management System for one coaching institution with mess fee charging. Mess is a fee component only; do not implement hostel, kitchen, meal or inventory operations in the initial MVP.

## Approved stack

- Next.js App Router
- JavaScript / JSX (not TypeScript for application code)
- Cloudflare Workers deployment
- Cloudflare D1 (SQLite)
- Drizzle ORM + Drizzle Kit
- Cloudflare R2
- Tailwind CSS + shadcn/ui
- Zod
- React Hook Form
- WhatsApp OTP provider abstraction

Do not introduce NestJS, Express, PostgreSQL, Prisma, MongoDB or another ORM without explicit approval.

## Before changing code

1. Inspect the existing repository and relevant module.
2. Read the relevant requirements and architecture docs.
3. Identify dependencies and callers.
4. Explain the planned file changes briefly.
5. Do not rewrite unrelated modules or replace working architecture without approval.

## Architecture rules

- Use a modular monolith.
- Keep UI components separate from business logic.
- Route Handlers should validate, authenticate, authorize, call services and shape responses; do not put complex business logic in route files.
- Put domain logic in module services.
- Keep database access behind module repositories/data-access functions.
- Avoid circular module dependencies.
- Use request-scoped Cloudflare bindings; do not capture request-specific D1/R2 bindings in unsafe global singletons.
- Use only APIs supported by the selected Workers runtime and deployment adapter.
- Do not assume Node.js APIs are available in Workers.

## Database rules

- D1 is SQLite. Do not write PostgreSQL-specific SQL.
- Use Drizzle schema definitions and committed SQL migrations.
- Review generated migrations before applying.
- Never use destructive schema push against production.
- Preserve historical enrollment, attendance, exam, invoice and payment records.
- Use integer paise for all INR monetary amounts.
- Use database constraints for uniqueness and referential integrity where practical.
- Do not store uploaded binary files in D1; use R2.
- Verify foreign-key behavior and D1 migration behavior in local tests.
- For multi-statement finance writes, use a verified atomic D1 batch workflow and test rollback.
- Do not assume `db.transaction()` works with the D1 driver until proven for the pinned versions.

## Security rules

- Enforce authorization on the server for every protected operation.
- UI hiding is not authorization.
- Deny by default.
- Parent access must be scoped to verified linked students.
- Teacher access must be scoped to current authorized assignments and approved historical rules.
- Student access must be scoped to own records.
- Never expose student fees to students in the MVP.
- Teachers cannot generate invoices or record payments.
- Parents have read-only fee access.
- Store only OTP hashes; OTP is short-lived and single-use.
- Rate-limit OTP request, resend and verification.
- Never log OTP values, session tokens, passwords or sensitive student data.
- Use secure HttpOnly cookies in production.
- Validate uploads and authorize every R2 object access.

## Coding conventions

- Use `.js` and `.jsx` for application code.
- Use descriptive names and small functions.
- Use Zod at external input boundaries.
- Use JSDoc for important service/API contracts.
- Avoid `any`-style unvalidated data; validate unknown input.
- Keep components accessible and responsive.
- Provide loading, empty, error and success states.
- Use consistent error codes and response envelopes.
- Do not add dependencies without explaining why they are needed.

## Testing requirements

- Add unit tests for business rules.
- Add integration tests for database operations and authorization.
- Add tests for parent/teacher/student resource isolation.
- Test D1 migration from an empty local database.
- Test financial batch rollback and duplicate submission.
- Test OTP expiry, replay, attempt limit and resend throttling.
- Run lint, tests and production build before claiming completion.

## Antigravity operating rules

- Work only on the assigned task.
- Do not silently change requirements, schema decisions or technology choices.
- Do not invent missing business rules; mark them OPEN and ask.
- Do not modify unrelated files.
- Do not create a migration without describing its effect.
- Do not claim tests passed unless they were actually run.
- Summarize changed files, migrations, tests and known limitations at task completion.
- Stop and request human review for authentication, authorization, financial logic, data deletion, production migrations and secrets handling.
