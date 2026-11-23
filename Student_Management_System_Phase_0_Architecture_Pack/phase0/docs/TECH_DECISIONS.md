# Technology Decisions and Architecture Decision Records

## Approved decisions

### ADR-001 — Single-institution product
**Decision:** Build for one institution in the initial product.  
**Reason:** Keeps product and operational scope focused.  
**Consequence:** Keep institution-specific configuration cleanly separated, but do not build tenant registration or multi-tenant isolation in the MVP.

### ADR-002 — Next.js App Router
**Decision:** Use Next.js as the full-stack application framework.  
**Consequence:** UI and server-side API/business services live in one application. Do not add NestJS or Express as a separate backend without a new architecture review.

### ADR-003 — JavaScript
**Decision:** Application code uses JavaScript/JSX.  
**Consequence:** Use consistent JSDoc and runtime Zod validation. Drizzle tooling compatibility with JS schema/config must be proven. Any tooling-only TypeScript exception requires explicit approval.

### ADR-004 — Cloudflare Workers
**Decision:** Deploy the application on Cloudflare Workers.  
**Consequence:** Validate runtime compatibility and use Cloudflare bindings through supported runtime APIs.

### ADR-005 — Cloudflare D1
**Decision:** Use one D1 SQLite database for the single institution.  
**Consequence:** Respect SQLite semantics, D1 size/concurrency limits, query limits and migration workflow. Benchmark before production.

### ADR-006 — Drizzle ORM
**Decision:** Use Drizzle ORM and Drizzle Kit.  
**Consequence:** Drizzle schema and committed SQL migrations are the database contract. Review generated SQL.

### ADR-007 — Cloudflare R2
**Decision:** Use R2 for file objects.  
**Consequence:** D1 stores metadata/object keys, not binary files.

### ADR-008 — WhatsApp OTP
**Decision:** WhatsApp OTP is the initial authentication direction.  
**Consequence:** Provider abstraction required; provider, template, account recovery and fallback remain open until confirmed.

### ADR-009 — Modular monolith
**Decision:** One deployable application with domain modules and service boundaries.  
**Consequence:** No microservices in the initial MVP.

## Deployment adapter decision — pending proof

Cloudflare's current documentation recommends vinext for new Next.js applications on Workers. The project will run a compatibility spike and pin the selected adapter/tool versions. If vinext does not support a required feature, evaluate OpenNext and document the trade-off.

## External references

- Cloudflare Next.js on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare OpenNext adapter: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 database API: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Drizzle Cloudflare D1: https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1
- Drizzle D1 migrations: https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit

Re-check official documentation when initializing the repository because runtime adapters, package versions and plan limits can change.
