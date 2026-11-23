# Project Requirements Document — v1.2

**Status:** Architecture-aligned draft; business sign-off required  
**Baseline:** User-provided PRD v1.1  
**Product:** Single-institution Student Management System — Coaching + Mess Fee Management

## 1. Product scope

The system centralizes academic, administrative and financial operations for one coaching institution. Mess is supported only as a fee component.

## 2. Roles

### Super Admin / Owner
Full institutional control, configuration, user and role management, academic operations, financial operations, reports and audit access.

### Coaching Admin
Day-to-day admission, academic and financial operations. Exact differences from Super Admin remain **OPEN**.

### Teacher / Faculty
Access assigned classes, subjects and students; mark attendance; enter daily performance and remarks; enter authorized examination marks; view timetable and permitted fee information. Cannot generate invoices or record payments.

### Student
Read-only access to own profile and academic records. Fee information is excluded from the initial MVP.

### Parent / Guardian
Read-only access to linked children's profiles, academics, attendance, results, timetable and fee details. One parent account may link to multiple students. Parent payment and online fee payment are excluded from the initial MVP.

## 3. Functional modules

1. Authentication and account management
2. Student admission and profile management
3. Parent/guardian management and student linking
4. Academic session management
5. Class, subject and enrollment management
6. Teacher profiles and assignment management
7. Daily and period-wise attendance
8. Daily performance and remarks
9. Examination setup, marks and results
10. Class and teacher timetable
11. Fee configuration, invoices, payments and receipts
12. Role-specific dashboards
13. Academic and financial reports
14. Audit history

## 4. Approved architecture additions to v1.1

These are additions to the original PRD, not claims that they were already confirmed in v1.1.

- Academic sessions are included in the MVP.
- Student class placement is represented by session-based enrollment history; current class must not overwrite historical placement.
- Parent-to-student linking supports multiple children.
- Teacher responsibility category is recorded on class/subject assignments, not as one exclusive teacher profile field.
- Invoice line items retain a snapshot of the amounts charged at invoice generation.
- Payment records and payment allocations are separate concepts.
- Monetary values are stored as integer paise.
- Uploaded photographs/documents are stored in R2; D1 stores metadata and object keys.
- Critical changes are auditable.
- Student promotion, repeat, transfer and leaving actions preserve historical enrollment records.

## 5. Attendance

Statuses: Present, Absent, Late, Leave.

Daily and period-wise attendance are separate record types/workflows. Reports must not double-count absences across modes.

**OPEN:** Whether daily and period-wise modes are both enabled for every class; leave approval; late thresholds; correction/locking policy; attendance calendar and holidays.

## 6. Performance and examinations

Daily evaluation includes class tests, homework/classwork and general performance. Teachers may add individual remarks.

Examinations include Unit Test, Monthly Test, Half-Yearly and Final Examination. Admin-configurable maximum marks, passing criteria and grading rules are required.

**OPEN:** Whether individual downloadable report cards are mandatory in the first pilot; rounding rules; absent/exempt treatment; grade boundaries and pass rules.

## 7. Timetable

Support daily and weekly class schedules, subject/teacher/room assignments and conflict warnings.

**OPEN:** Whether room allocation is needed at launch; whether conflicts block saving or only warn; handling of substitutions and cancellations.

## 8. Finance

Fee components: Coaching, Mess and Other Charges.

Support course-wise defaults, individual student overrides, monthly billing, combined or separate invoices, cash/UPI/bank-transfer recording and partial payments.

Invoice statuses: Paid, Partially Paid, Unpaid. Overdue is a derived condition based on due date and outstanding balance.

Payment gateway integration and online parent payment are out of scope.

**Recommended additions pending operational approval:** printable receipts, bulk invoice generation and discounts/concessions. These must be confirmed before finance implementation.

**OPEN:** Late fines, scholarships, waivers, discounts, refunds, payment reversal/void workflow, invoice numbering, due-date policy, treatment of unallocated credits and receipt format.

## 9. Authentication

Approved direction: WhatsApp OTP login for registered phone numbers. A provider abstraction must isolate WhatsApp delivery from OTP verification and session issuance.

**OPEN:** WhatsApp Business provider, approved template, SMS fallback, account recovery, phone-number change verification and whether all role types have a registered mobile number.

OTP proves control of a phone number; it does not create or prove institutional authorization. Admin-managed account provisioning and parent-child linking remain mandatory.

## 10. Non-functional requirements

- Server-side authorization on every protected data operation.
- Secure OTP lifecycle, rate limiting and abuse controls.
- Input validation and output shaping.
- Referential integrity and unique constraints.
- Atomic financial write workflows.
- Audit trail for sensitive changes.
- Responsive enterprise UI.
- Database backup and recovery procedures.
- Error monitoring and operational health checks.
- Data export and retention policy to be defined.

## 11. Explicitly unresolved decisions

1. Exact Super Admin vs Coaching Admin permissions.
2. WhatsApp provider and OTP recovery/fallback.
3. Account provisioning process for teachers and students.
4. Parent account invitation/verification workflow.
5. Whether both parents can have separate accounts.
6. Academic calendar, session naming and rollover dates.
7. Promotion/repeat/transfer/left workflow details.
8. Attendance correction, leave and locking rules.
9. Examination grading, rounding and report-card requirements.
10. Fee discounts, concessions, fines, refunds and reversals.
11. Bulk invoice generation and receipt requirements.
12. Teacher access to historical students' fee information.
13. Expected student, teacher and concurrent user volumes.
14. Production plan/budget and acceptable recovery objectives.
15. Data retention, privacy notice and consent process.

Do not silently invent answers to these questions. Record decisions in the change log and update this PRD when approved.
