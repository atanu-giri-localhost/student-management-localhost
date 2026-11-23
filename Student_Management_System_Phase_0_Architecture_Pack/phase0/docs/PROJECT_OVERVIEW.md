# Project Overview

## Product vision

Build a reliable, secure, role-based web application that centralizes academic, administrative and fee operations for one coaching institution that also charges mess fees.

Mess is represented as a fee component only in the initial MVP. The application does not manage hostel rooms, meal attendance, kitchen operations, food inventory or accommodation.

## Primary objectives

1. Digitize student admission and profile records.
2. Organize students by academic session, class and subject.
3. Manage teacher profiles, responsibilities and assignments.
4. Record daily and period-wise attendance.
5. Record daily performance, marks and teacher remarks.
6. Manage formal examinations, grading and results.
7. Maintain class and teacher timetables.
8. Generate monthly combined or separate fee invoices.
9. Record cash, UPI and bank-transfer payments, including partial payments.
10. Provide role-specific dashboards and academic/financial reports.
11. Protect student, academic and financial data through server-side authorization and audit history.

## Users

- Super Admin / Owner
- Coaching Admin
- Teacher / Faculty
- Student
- Parent / Guardian

## Product boundary

**In scope:** authentication, role access, student and parent management, academic sessions, classes, subjects, teacher assignments, attendance, performance, examinations, timetable, fee structures, invoices, payment records, receipts, dashboards, reports and audit logs.

**Out of scope for initial MVP:** multi-institution tenancy, independent mess/hostel operations, online payment gateway, general notification system, native mobile apps, teacher payroll, AI analytics and student self-service fee payment.

## Success criteria

The MVP is suitable for an institutional pilot when:
- Each role can authenticate and access only permitted resources.
- Parent access is restricted to linked children.
- Teachers are restricted to assigned classes/subjects and explicitly granted capabilities.
- Academic history survives student promotion and session rollover.
- Attendance, examination and timetable workflows work end-to-end.
- Monthly invoices, partial payments, allocations, balances and receipts reconcile.
- Critical actions are auditable.
- Backup/restore and production operational procedures have been tested.
