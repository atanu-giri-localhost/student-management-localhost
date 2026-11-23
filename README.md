# Student Management System (SMS)
### Coaching Institute + Mess Fee Management System

[![Version](https://img.shields.io/badge/PRD_Version-1.2-blue.svg)](./Student_Management_System_Phase_0_Architecture_Pack/phase0/docs/PRD_v1.2.md)
[![Architecture](https://img.shields.io/badge/Architecture-Modular_Monolith-emerald.svg)](./docs/ARCHITECTURE.md)
[![Runtime](https://img.shields.io/badge/Runtime-Cloudflare_Workers-orange.svg)](./docs/ARCHITECTURE.md)
[![Database](https://img.shields.io/badge/Database-Cloudflare_D1_(SQLite)-indigo.svg)](./docs/DATABASE_SCHEMA.md)
[![ORM](https://img.shields.io/badge/ORM-Drizzle_ORM_(JavaScript)-yellow.svg)](./docs/DATABASE_SCHEMA.md)
[![Storage](https://img.shields.io/badge/Storage-Cloudflare_R2-blue.svg)](./docs/CONFIGURATION_AND_ENV.md)

---

## 📖 Project Overview

The **Student Management System (SMS)** is a web application designed to centralize academic, administrative, and fee operations for a single coaching institution that also charges mess fees. Mess is managed strictly as an integrated fee component; hostel rooming, meal attendance, and kitchen inventory operations are excluded from the initial MVP.

The application delivers tailored, role-specific portals with strict, server-side Role-Based Access Control (RBAC):
* **Super Admin / Owner:** Full institutional governance, user accounts, fee configuration, and immutable audit logs.
* **Coaching Admin:** Day-to-day admissions, academic sessions, timetable, attendance, exams, and fee collection.
* **Teacher / Faculty:** Class and subject assignments (supporting both `REGULAR_TEACHER` and `CLASS_TEACHER` duties), attendance marking, daily performance scores/remarks, exam grading, and read-only student fee status for assigned classes.
* **Student:** Read-only portal for personal profile, timetable, attendance history, daily test scores, and exam report cards. **(Student fee information is strictly hidden).**
* **Parent / Guardian:** Read-only portal with a multi-child switcher, displaying linked child's attendance, daily marks, exam results, and itemized fee status (invoices, payments, pending balances, and printable receipts).

---

## 🛠️ Approved Technology Stack (Phase 0 Baseline)

* **Framework:** Next.js App Router (Full-Stack Modular Monolith).
* **Language:** **JavaScript / JSX (`.js`, `.jsx`)** across application code (Zod for runtime validation, JSDoc for typing).
* **Edge Runtime:** Cloudflare Workers (deployed via **vinext** adapter; OpenNext fallback evaluated).
* **Database:** **Cloudflare D1 (SQLite)** accessed via request-scoped bindings.
* **ORM:** **Drizzle ORM & Drizzle Kit** with committed, reviewed SQL migrations.
* **File Storage:** **Cloudflare R2** for student/staff photographs and documents.
* **Financial Storage:** **Integer Paise (`amount_paise INTEGER`)** for all INR monetary calculations.
* **Authentication:** **WhatsApp OTP** with provider abstraction, hashed OTP verification, and secure `HttpOnly` session cookies.
* **Styling & Components:** Tailwind CSS + shadcn/ui (Radix UI primitives).

---

## 📚 Technical Documentation Suite

All architectural blueprints, database schemas, and guides in `docs/` are aligned with the Phase 0 Architecture Pack:

| Document | Purpose & Summary | Direct Link |
| :--- | :--- | :--- |
| **System Architecture** | Modular Monolith layout, Cloudflare Workers execution model, request-scoped D1 bindings, R2 storage, and security layers. | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| **Database Schema** | Cloudflare D1 (SQLite) relational schema, ER diagram, integer paise rules, session-based enrollments, and Drizzle definitions. | [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) |
| **RESTful API Spec** | Next.js App Router Route Handlers (`/api/v1/*`), WhatsApp OTP lifecycle, integer paise payloads, and response envelopes. | [docs/API_SPECIFICATION.md](./docs/API_SPECIFICATION.md) |
| **Business Rules & Logic** | Domain logic: fee invoicing, payment allocations, dual attendance registers, teacher scoping, and list of 15 OPEN decisions. | [docs/BUSINESS_RULES_AND_LOGIC.md](./docs/BUSINESS_RULES_AND_LOGIC.md) |
| **Frontend & UI Spec** | WhatsApp OTP screens, role-based navigation, Parent Child Switcher, Rapid Attendance Sheet, and INR currency formatting. | [docs/FRONTEND_AND_UI_SPEC.md](./docs/FRONTEND_AND_UI_SPEC.md) |
| **Configuration & Env** | Cloudflare `wrangler.toml` configuration, D1 & R2 bindings, `.env.local` template, and session cookie policies. | [docs/CONFIGURATION_AND_ENV.md](./docs/CONFIGURATION_AND_ENV.md) |
| **Development Guide** | Local development with Wrangler D1 emulation, compatibility spike checklist, Drizzle migrations, and test strategy. | [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) |
| **Phase 0 Baseline Pack** | Approved Phase 0 Architecture Pack and sign-off checklist. | [Phase 0 Pack](./Student_Management_System_Phase_0_Architecture_Pack/phase0/) |

---

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone <repository_url> student-management
cd student-management

# 2. Install dependencies
pnpm install

# 3. Configure local environment variables
cp .env.example .env.local

# 4. Generate & apply Drizzle migrations to local Cloudflare D1
pnpm exec drizzle-kit generate
pnpm exec wrangler d1 execute sms-coaching-d1 --local --file=./drizzle/migrations/0000_initial_schema.sql

# 5. Seed synthetic development data
pnpm exec wrangler d1 execute sms-coaching-d1 --local --file=./drizzle/seed.sql

# 6. Start the development server
pnpm dev
```

* **Application URL:** `http://localhost:3000`

---

## 👥 Demo Credentials (Local Development)

In local development (`WHATSAPP_PROVIDER="MOCK"`), use default OTP `123456`:

| Role | Normalized Phone Number | Target Portal Route |
| :--- | :--- | :--- |
| **Super Admin** | `+919999900001` | `/admin/dashboard` |
| **Coaching Admin** | `+919999900002` | `/admin/dashboard` |
| **Teacher (Class 10 Lead)** | `+919876500001` | `/teacher/dashboard` |
| **Teacher (Regular Math)** | `+919876500002` | `/teacher/dashboard` |
| **Student** | `+919876510001` | `/student/dashboard` |
| **Parent (Multi-Child)** | `+919876520001` | `/parent/dashboard` |

---

## 🔒 Security & Data Integrity Invariants

1. **Server-Side Authorization:** Every Route Handler verifies role and resource ownership. UI hiding is never treated as authorization.
2. **Double-Entry Financial Allocations:** Payments and Invoices are decoupled via `payment_allocations` in integer paise.
3. **Session-Based Enrollments:** Students retain a single permanent record in `students`, while academic placements are preserved across sessions in `enrollments`.
4. **Attendance Segregation:** Institutional daily attendance (`attendance_days`) and period attendance (`period_attendance_registers`) are tracked in separate tables to avoid double-counting.
