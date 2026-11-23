# Development Backlog and Two-Developer Plan

## Working model

Both developers work across frontend and backend. Assign **feature ownership**, not a permanent frontend/backend split. Every feature owner is responsible for UI, API/service logic, database changes, tests and documentation for that feature.

Suggested labels:
- `P0`: blocks foundation or security
- `P1`: required for MVP
- `P2`: useful MVP enhancement / pilot follow-up
- `OPEN`: requires product decision before implementation

## Phase 0 — close-out (both developers)

- [ ] Review this architecture pack together.
- [ ] Resolve all OPEN decisions that affect the data model.
- [ ] Confirm expected student/teacher/concurrent-user volumes.
- [ ] Confirm WhatsApp Business provider and template feasibility.
- [ ] Approve vinext compatibility spike outcome.
- [ ] Approve Drizzle JavaScript schema/config proof.
- [ ] Approve ER diagram and RBAC matrix.
- [ ] Sign off PRD v1.2.

## Phase 1 — repository and technical foundation

**Developer 1 — platform/runtime ownership**
- [ ] Create GitHub repository and branch protection.
- [ ] Scaffold Next.js App Router in JavaScript.
- [ ] Configure Cloudflare Workers deployment path and Wrangler.
- [ ] Create local D1 database and bindings.
- [ ] Prove request-scoped D1 binding access.
- [ ] Prove Drizzle + Drizzle Kit JavaScript compatibility.
- [ ] Configure local/staging/production environment separation.
- [ ] Add health route and structured logging.

**Developer 2 — UI/design-system ownership**
- [ ] Establish enterprise design tokens and typography.
- [ ] Configure Tailwind CSS and shadcn/ui.
- [ ] Build application shell, sidebar, header and responsive layout.
- [ ] Build reusable table, form, dialog, badge, empty/loading/error states.
- [ ] Establish role-aware navigation configuration (presentation only).
- [ ] Add accessibility and responsive checks.

**Shared acceptance**
- [ ] Both developers can run the app locally.
- [ ] Local D1 migrations apply from a clean database.
- [ ] Preview deployment works.
- [ ] CI runs lint, tests and build/deploy validation.
- [ ] No secrets are committed.

## Phase 2 — identity, OTP and authorization

**Developer 1**
- [ ] User, role, user-role, OTP challenge and session schema.
- [ ] OTP request/verify services.
- [ ] WhatsApp provider adapter interface and sandbox integration.
- [ ] OTP expiry, hash storage, attempt limit and resend cooldown.
- [ ] Session creation, secure cookie and revocation.
- [ ] Authentication and authorization integration tests.

**Developer 2**
- [ ] Login and OTP verification UI.
- [ ] OTP resend/countdown and accessible error states.
- [ ] Authenticated application shell.
- [ ] Session expiry and logout UX.
- [ ] Role-based route presentation.

**Acceptance**
- [ ] Unregistered account requests do not leak account existence.
- [ ] OTP cannot be reused or verified after expiry.
- [ ] Rate limits and attempt limits work.
- [ ] Every protected service denies unauthenticated access.
- [ ] UI restrictions are backed by server authorization.

## Phase 3 — institution, student and academic foundation

**Developer 1**
- [ ] Academic sessions and lifecycle.
- [ ] Classes, subjects and class-subject mapping.
- [ ] Student admission and unique admission number.
- [ ] Enrollment history and promotion groundwork.
- [ ] Student search/filter APIs.

**Developer 2**
- [ ] Student list, filters and detail pages.
- [ ] Admission form and profile pages.
- [ ] Academic session/class/subject management UI.
- [ ] Parent profile and parent-student linking UI.

**Shared**
- [ ] Agree student profile and parent account linking rules.
- [ ] Test duplicate admission number and historical enrollment behavior.

## Phase 4 — teacher management and assignments

- [ ] Teacher profile lifecycle.
- [ ] Teacher assignment model by session/class/subject.
- [ ] Assignment responsibility category.
- [ ] Teacher class/subject scope queries.
- [ ] Teacher list, detail and assignment UI.
- [ ] Authorization tests for cross-class access.

## Phase 5 — attendance and daily performance

- [ ] Daily attendance register and records.
- [ ] Period attendance register and records.
- [ ] Duplicate prevention and correction workflow.
- [ ] Attendance summaries and percentage calculation.
- [ ] Daily performance categories, scores and remarks.
- [ ] Teacher attendance-entry screens.
- [ ] Student/parent read-only views.
- [ ] Audit sensitive corrections.

## Phase 6 — examinations and results

- [ ] Examination setup and class assignment.
- [ ] Exam subject and maximum/passing marks.
- [ ] Grading configuration and versioning.
- [ ] Marks entry and validation.
- [ ] Result calculations and history.
- [ ] Student/parent result views.
- [ ] Printable report cards if approved.

## Phase 7 — timetable

- [ ] Timetable slots and weekly schedule.
- [ ] Teacher/class/room conflict detection.
- [ ] Admin timetable editor.
- [ ] Teacher schedule.
- [ ] Student/parent class schedule.
- [ ] Substitution/cancellation workflow if approved.

## Phase 8 — finance

**Critical: finance design review before implementation.**

- [ ] Fee components and standard fee structures.
- [ ] Student-specific fee assignment/override.
- [ ] Invoice generation, invoice numbering and snapshots.
- [ ] Combined and separate invoice rules.
- [ ] Partial payment recording.
- [ ] Payment allocation to invoices.
- [ ] Atomic D1 batch workflow and rollback tests.
- [ ] Duplicate submission/idempotency protection.
- [ ] Outstanding and overdue calculations.
- [ ] Payment reversal/refund policy if approved.
- [ ] Receipt generation and printable view if approved.
- [ ] Monthly collection and outstanding reports.
- [ ] Teacher/parent read-only fee views.

## Phase 9 — dashboards and reports

- [ ] Admin dashboard metrics.
- [ ] Teacher dashboard.
- [ ] Student dashboard.
- [ ] Parent dashboard and child switcher.
- [ ] Student, attendance, academic and finance reports.
- [ ] CSV export with authorization and safe formula handling.
- [ ] Pagination and query-performance review.

## Phase 10 — hardening, pilot and release

- [ ] Unit, integration and end-to-end test coverage.
- [ ] Role/resource authorization test matrix.
- [ ] Financial reconciliation and concurrency tests.
- [ ] Accessibility and responsive testing.
- [ ] D1 query/index review using representative data.
- [ ] Backup/restore drill and recovery runbook.
- [ ] Monitoring, alerting and error reporting.
- [ ] Privacy notice, retention and consent review.
- [ ] Staging user acceptance test.
- [ ] Production deployment and pilot sign-off.

## Feature completion definition

A feature is not complete merely because its screen works. It must include:
- Approved requirement and acceptance criteria.
- Server-side validation.
- Server-side authorization and resource scoping.
- Database constraints/migration where needed.
- Loading, empty, error and success UI states.
- Unit/integration tests appropriate to risk.
- Audit behavior for sensitive operations.
- Documentation/API contract update.
- Code review and merged pull request.

## Suggested weekly cadence

- Planning: agree 3–5 small deliverables.
- Daily: each developer updates branch and integration status.
- Mid-week: review schema/API changes together.
- End-week: demo, test, merge and update backlog.
- Never let both developers independently edit the same migration without coordination.
