# System Architecture & Technical Design

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**Document Version:** 2.0 (Phase 0 Aligned)  
**PRD Reference:** PRD v1.2 & Phase 0 Architecture Pack  
**Approved Stack:** Next.js App Router (JavaScript) · Cloudflare Workers · Cloudflare D1 (SQLite) · Drizzle ORM · Cloudflare R2 · Tailwind CSS + shadcn/ui · WhatsApp OTP  

---

## 1. Architectural Style & Boundaries

The application is structured as a **Modular Monolith** delivered within a single full-stack Next.js application deployed to **Cloudflare Workers**. 

* **Single Institution Scope (ADR-001):** Built for one coaching institute with mess fees as an integrated fee component. No multi-tenant complexity or separate database per module.
* **Unified Full-Stack Runtime (ADR-002):** UI and backend services reside in the same Next.js repository. No separate Express, NestJS, or external API gateways.
* **Edge-Native Deployment (ADR-004):** Hosted on Cloudflare Workers using the recommended adapter (**vinext** baseline, with **OpenNext** as evaluated fallback).
* **Serverless Storage & Data (ADR-005, ADR-007):** Cloudflare D1 (serverless SQLite) for relational state; Cloudflare R2 for binary assets (photos, documents).
* **JavaScript First (ADR-003):** All application code is standard `.js` and `.jsx` with JSDoc typing and Zod runtime schema validation.

```mermaid
flowchart TD
    subgraph ClientBrowser["Client Layer (Browser)"]
        AdminUI["Admin Portal (/admin)"]
        TeacherUI["Teacher Portal (/teacher)"]
        StudentUI["Student Portal (/student)"]
        ParentUI["Parent Portal (/parent - Child Switcher)"]
        AuthUI["WhatsApp OTP Login (/login)"]
    end

    subgraph CloudflareEdge["Cloudflare Workers Runtime (Next.js App Router)"]
        EdgeRouting["Worker Entry / vinext Adapter"]
        CookieSessionAuth["Session & Cookie Auth Middleware"]
        ServerRouteHandlers["Route Handlers (src/app/api/v1/*)"]
        ServerComponents["Next.js Server Components"]
        
        subgraph DomainModules["Domain Service Modules (src/modules/*)"]
            AuthMod["auth: OTP & Sessions"]
            UsersMod["users: Accounts & Roles"]
            StudentsMod["students: Profiles & LifeCycle"]
            ParentsMod["parents: Profiles & Student Links"]
            AcademicsMod["academics: Sessions, Classes, Enrollments"]
            TeachersMod["teachers: Profiles & Assignments"]
            AttendanceMod["attendance: Daily & Period Registers"]
            PerformanceMod["performance: Daily Tests & Remarks"]
            ExamsMod["examinations: Exams, Subjects & Marks"]
            TimetableMod["timetable: Slots & Conflict Engine"]
            FinanceMod["finance: Fees, Invoices, Payments, Receipts"]
            AuditMod["audit: Immutable Activity Logs"]
        end

        DrizzleLayer["Drizzle ORM (Request-Scoped D1 Client)"]
        StorageService["R2 Storage Service (Signed Access)"]
    end

    subgraph CloudflareDataLayer["Cloudflare Data Layer"]
        D1Database[("Cloudflare D1 (SQLite)\n- Relational Tables\n- Integer Paise Amounts\n- Session-Scoped Enrollments")]
        R2Buckets[("Cloudflare R2 Object Store\n- Student/Staff Photos\n- Academic Documents")]
    end

    subgraph ExternalServices["External Providers"]
        WhatsAppAPI["WhatsApp Business API\n(OTP Delivery Provider)"]
    end

    ClientBrowser -->|HTTPS / Secure Cookies| EdgeRouting
    EdgeRouting --> CookieSessionAuth
    CookieSessionAuth --> ServerRouteHandlers
    CookieSessionAuth --> ServerComponents
    ServerRouteHandlers --> DomainModules
    ServerComponents --> DomainModules
    
    AuthMod -->|Dispatch OTP| WhatsAppAPI
    DomainModules --> DrizzleLayer
    DomainModules --> StorageService
    DrizzleLayer -->|Request-Scoped Binding `env.DB`| D1Database
    StorageService -->|Binding `env.STORAGE`| R2Buckets
```

---

## 2. Technology Stack & Operational Baseline

| Layer | Approved Technology | Decision Driver / Constraint |
| :--- | :--- | :--- |
| **Framework** | **Next.js (App Router)** | Full-stack architecture; Server Components for fast data rendering; Route Handlers for API. |
| **Language** | **JavaScript / JSX (`.js`, `.jsx`)** | Application code is strictly JavaScript; Zod schemas provide boundary validation; JSDoc provides IDE type hinting. |
| **Edge Runtime** | **Cloudflare Workers** | Ultra-low latency, serverless execution at edge. |
| **Deployment Adapter**| **vinext** (or **OpenNext**) | Cloudflare-recommended Next.js on Workers adapter. Tested via Phase 0 compatibility spike. |
| **Database** | **Cloudflare D1 (SQLite)** | Serverless, relational, transactional SQLite. Queries executed via request-scoped environment binding. |
| **ORM / Migrations** | **Drizzle ORM & Drizzle Kit** | Lightweight, high performance, native D1 support, committed reviewed SQL migration files. |
| **File Storage** | **Cloudflare R2** | S3-compatible, zero-egress object storage for photos/documents; metadata in D1. |
| **UI Components** | **Tailwind CSS + shadcn/ui** | Accessible Radix UI primitives, utility-first styling, responsive across desktop and tablet. |
| **Form & Validation** | **React Hook Form + Zod** | Declarative forms, robust client and server schema validation. |
| **Authentication** | **WhatsApp OTP** | Phone-number based OTP challenges with provider abstraction, single-use hashed verification, HttpOnly session cookies. |

---

## 3. Modular Monolith Codebase Structure

In accordance with Phase 0 guidelines, application code resides in a clean modular layout (`src/`):

```text
student-management/
├── src/
│   ├── app/                    # Next.js App Router pages and route handlers
│   │   ├── (auth)/             # Login, OTP verification routes
│   │   │   ├── login/page.jsx
│   │   │   └── verify-otp/page.jsx
│   │   ├── (admin)/            # Admin portal routes
│   │   ├── (teacher)/          # Teacher portal routes
│   │   ├── (student)/          # Student portal routes
│   │   ├── (parent)/           # Parent portal (with Child Switcher)
│   │   ├── api/                # API Route Handlers
│   │   │   └── v1/             # RESTful API endpoints (/api/v1/*)
│   │   ├── layout.jsx          # Root application shell
│   │   └── page.jsx            # Landing / auth redirect
│   │
│   ├── modules/                # Domain-driven feature modules
│   │   ├── auth/               # auth.service.js, auth.repository.js, auth.schemas.js
│   │   ├── users/              # Account and role management
│   │   ├── students/           # Profiles, admission numbers, life-cycle
│   │   ├── parents/            # Parent profiles, multi-child relationships
│   │   ├── academics/          # Sessions, classes, subjects, enrollments
│   │   ├── teachers/           # Staff profiles, session-scoped assignments
│   │   ├── attendance/         # Daily registers and period registers
│   │   ├── performance/        # Daily tests, homework, teacher remarks
│   │   ├── examinations/       # Exams, max/pass marks, results, grading
│   │   ├── timetable/          # Timetable slots and collision engine
│   │   ├── finance/            # Fee structures, invoices, payments, allocations, receipts
│   │   ├── reports/            # Academic & financial query views
│   │   └── audit/              # Immutable audit logging service
│   │
│   ├── components/             # Reusable UI widgets
│   │   ├── ui/                 # shadcn/ui base elements (buttons, dialogs, inputs)
│   │   ├── layout/             # Sidebar, topbar, child-switcher, portal shell
│   │   └── data-display/       # Data tables, stat cards, attendance registers
│   │
│   ├── lib/                    # Shared runtime helpers & integrations
│   │   ├── db/                 # Drizzle client factory (binds `env.DB`)
│   │   ├── cloudflare/         # Cloudflare bindings accessor (D1, R2)
│   │   ├── auth/               # Session cookie and token hashing utilities
│   │   ├── whatsapp/           # WhatsApp OTP provider adapter interface
│   │   ├── money/              # Integer paise math and INR formatting helpers
│   │   ├── validation/         # Common Zod validation rules
│   │   └── dates/              # ISO-8601 date utilities
│   │
│   └── config/                 # Static application configuration constants
│
├── drizzle/                    # Database migrations and Drizzle schema
│   ├── schema/                 # Drizzle JavaScript schema definition files
│   │   ├── auth.js
│   │   ├── students.js
│   │   ├── academics.js
│   │   ├── teachers.js
│   │   ├── attendance.js
│   │   ├── exams.js
│   │   ├── timetable.js
│   │   ├── finance.js
│   │   └── audit.js
│   ├── migrations/             # Generated & committed SQL migration files
│   └── drizzle.config.js       # Drizzle Kit configuration
│
├── wrangler.toml               # Cloudflare Workers, D1 & R2 configuration
├── tailwind.config.js
├── package.json
└── README.md
```

---

## 4. Cloudflare D1 & Workers Execution Model

### 4.1 Request-Scoped Bindings (No Global Singletons)
Workers isolates execution per request. In accordance with `AGENTS.md`:
* Never capture request-specific `env.DB` or `env.STORAGE` bindings in a long-lived global singleton.
* The Drizzle D1 client is initialized per request or passed down through execution context:
  ```javascript
  // src/lib/db/client.js
  import { drizzle } from 'drizzle-orm/d1';
  import * as schema from '../../../drizzle/schema/index.js';

  export function getDb(env) {
    if (!env?.DB) {
      throw new Error('Cloudflare D1 binding (env.DB) is not available.');
    }
    return drizzle(env.DB, { schema });
  }
  ```

### 4.2 SQLite & D1 Concurrency Constraints
* **Single-Threaded Writes:** Each Cloudflare D1 database processes writes serially. 
* **Batch Operations for Financial Integrity:** Critical multi-step operations (e.g., generating invoice + items, recording payment + allocation + receipt) must use D1 atomic batch statements (`db.batch([...])`) to guarantee that all statements commit or all roll back.
* **Storage Limits:** Keep queries indexed, batch mutations, avoid unbounded `SELECT *`, and paginate all collections. Binary files are strictly routed to R2.

---

## 5. Security & Authorization Architecture

1. **Deny-by-Default Server Verification:** Route handlers and domain services inspect the authenticated session on every request. Client-side navigation merely toggles UI.
2. **Parent Access Boundary:** Every parent request must join through `parent_students` and enforce `parent_id = session.parentId`.
3. **Teacher Access Boundary:** Teachers may access only the students, classes, and subjects assigned to them in the active academic session.
4. **Student Fee Wall:** Students have zero access to fee routes. Student fee requests return HTTP `403 Forbidden`.
5. **Secure Session Cookies:** Sessions are tracked via encrypted/signed, `HttpOnly`, `SameSite=Lax` (or `Strict`), `Secure` cookies.
6. **R2 Object Protection:** File access is authorized through server route handlers or short-lived presigned URLs. Private R2 keys are never leaked to the client.
