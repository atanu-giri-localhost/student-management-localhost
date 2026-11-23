# RESTful API Specification

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**API Style:** Next.js App Router Route Handlers (`src/app/api/v1/*`)  
**Base Path:** `/api/v1`  
**Document Version:** 2.0 (Phase 0 Aligned)  

---

## 1. API Conventions & Standard Response Envelopes

### 1.1 General Protocol
* All request and response bodies use JSON (`Content-Type: application/json`).
* Input is validated on the server boundary using **Zod**.
* Monetary amounts are transmitted as **integer paise** (`amountPaise`).
* Timestamps and dates follow ISO-8601 strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`).
* Authentication is maintained via signed, secure `HttpOnly` session cookies.
* Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) incorporate CSRF and origin validation.
* Every response includes a correlation/request identifier (`requestId`).

### 1.2 Response Envelope Structure

#### Success Response
```json
{
  "data": {
    "id": "e8d9c0a1-...",
    "admissionNumber": "ADM-2026-0001",
    "fullName": "Aarav Sharma"
  },
  "meta": {
    "requestId": "req_01HJ8Z9..."
  }
}
```

#### Paginated Collection Response
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 140,
    "totalPages": 6
  },
  "meta": {
    "requestId": "req_01HJ8ZA..."
  }
}
```

#### Standard Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid or missing fields.",
    "details": [
      {
        "field": "amountPaidPaise",
        "message": "Amount must be a positive integer in paise"
      }
    ]
  },
  "meta": {
    "requestId": "req_01HJ8ZB..."
  }
}
```

---

## 2. Authentication & WhatsApp OTP Endpoints (`/auth`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/otp/request` | Public | Request WhatsApp OTP for normalized phone number. Returns generic success without leaking phone registration status. |
| `POST` | `/auth/otp/verify` | Public | Verify 6-digit OTP code. Sets secure `HttpOnly` session cookie on success. |
| `POST` | `/auth/logout` | Authenticated | Revoke active session and clear session cookie. |
| `GET` | `/auth/session` | Authenticated | Returns current authenticated user, active roles, and linked profiles (Parent/Teacher/Student). |
| `POST` | `/auth/session/revoke` | Super Admin | Administratively revoke user sessions. |

#### `POST /auth/otp/request` Payload
```json
{
  "phone": "+919876543210"
}
```
**Response (200 OK):**
```json
{
  "data": {
    "message": "If the phone number is registered, an OTP has been dispatched via WhatsApp.",
    "cooldownSeconds": 60
  },
  "meta": { "requestId": "req_otp_01" }
}
```

#### `POST /auth/otp/verify` Payload
```json
{
  "phone": "+919876543210",
  "otp": "492817"
}
```

---

## 3. Academic Sessions, Classes & Enrollments (`/academics`, `/classes`, `/enrollments`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/academic-sessions` | All Authenticated | List all academic sessions (e.g. 2026-2027). |
| `POST` | `/academic-sessions` | Admin | Create a new academic session. |
| `GET` | `/classes` | All Authenticated | List classes/grades and sections. |
| `POST` | `/classes` | Admin | Create a class/grade. |
| `GET` | `/subjects` | All Authenticated | List master subjects. |
| `POST` | `/subjects` | Admin | Create a subject code and name. |
| `POST` | `/enrollments` | Admin | Enroll a student into a class for an academic session. |
| `GET` | `/students/:id/enrollments`| Admin, Teacher, Parent (Linked), Student (Self) | Get student's historical and current enrollments. |

---

## 4. Student & Parent Profiles (`/students`, `/parents`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/students` | Admin, Teacher (Assigned) | Query student roster with filters (`sessionId`, `classId`, `status`, `search`). |
| `POST` | `/students` | Admin | Admit a student and create initial enrollment. |
| `GET` | `/students/:id` | Admin, Teacher (Assigned), Parent (Linked), Student (Self) | Retrieve comprehensive student profile. |
| `PATCH` | `/students/:id` | Admin | Update student profile data. |
| `GET` | `/parents` | Admin | Query parent portal accounts. |
| `POST` | `/parents` | Admin | Create parent profile. |
| `POST` | `/parents/:id/students` | Admin | Link a student to a parent profile. |
| `DELETE`| `/parents/:id/students/:studentId` | Admin | Unlink student from parent account (soft delete / audited). |
| `GET` | `/parents/my-children` | Parent | Get all verified students linked to the authenticated parent. |

---

## 5. Teacher Profiles & Scoped Assignments (`/teachers`, `/teacher-assignments`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/teachers` | Admin | List teacher profiles. |
| `POST` | `/teachers` | Admin | Create teacher profile. |
| `GET` | `/teachers/:id` | Admin, Teacher (Self) | Get teacher details and assigned classes/subjects. |
| `POST` | `/teacher-assignments` | Admin | Assign teacher to `(sessionId, classId, subjectId)` with `REGULAR_TEACHER` or `CLASS_TEACHER` role. |
| `GET` | `/teachers/me/assignments` | Teacher | Get active assignments for the logged-in teacher. |

---

## 6. Attendance & Daily Performance (`/attendance`, `/performance-records`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/attendance/daily/registers` | Admin, Teacher (Class Teacher) | Initialize daily attendance register for a class on a date. |
| `PUT` | `/attendance/daily/registers/:id/records` | Admin, Teacher (Class Teacher) | Submit/update daily attendance records for enrollments. |
| `GET` | `/attendance/daily` | Admin, Teacher (Assigned) | Fetch daily register by class and date. |
| `POST` | `/attendance/period/registers` | Admin, Teacher (Regular Teacher) | Initialize period attendance register for a subject/period. |
| `PUT` | `/attendance/period/registers/:id/records`| Admin, Teacher (Regular Teacher) | Submit/update period attendance records. |
| `GET` | `/attendance/reports` | Admin, Teacher (Assigned) | Query attendance percentage summaries. |
| `POST` | `/performance-records` | Admin, Teacher (Assigned) | Submit daily class test score, homework status, or remarks. |
| `GET` | `/performance-records` | All (Scope Guarded) | Query daily performance history for a student enrollment. |

#### `PUT /attendance/daily/registers/:id/records` Payload
```json
{
  "records": [
    { "enrollmentId": "enr-01", "status": "PRESENT" },
    { "enrollmentId": "enr-02", "status": "ABSENT", "remarks": "Fever reported" },
    { "enrollmentId": "enr-03", "status": "LATE", "remarks": "Arrived 15m late" }
  ]
}
```

---

## 7. Examinations & Results (`/examinations`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/examinations` | All Authenticated | List scheduled examinations. |
| `POST` | `/examinations` | Admin | Create examination in an academic session. |
| `POST` | `/examinations/:id/subjects` | Admin | Configure exam subject, max marks, passing marks, and date. |
| `PUT` | `/examinations/:id/marks` | Admin, Teacher (Assigned) | Enter or update student marks for an exam subject. |
| `GET` | `/examinations/:id/results` | Admin, Teacher (Assigned) | Consolidated class results sheet with grades. |
| `GET` | `/students/me/results` | Student | Get own examination report card. |
| `GET` | `/students/:studentId/results`| Admin, Teacher, Parent (Linked) | Get student's examination results. |

---

## 8. Timetable Endpoints (`/timetable`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/timetable/classes/:classId` | All Authenticated | Get weekly timetable matrix for a class. |
| `GET` | `/timetable/teachers/me` | Teacher | Get logged-in teacher's personal timetable. |
| `POST` | `/timetable/slots` | Admin | Create timetable slot with collision validation. |
| `PATCH`| `/timetable/slots/:id` | Admin | Update timetable slot. |

---

## 9. Finance, Invoicing & Payments (`/finance`)

> **Access Boundary:** Super Admin and Coaching Admin have full control. Teachers have read-only visibility into assigned students' fee status. Parents have read-only visibility into their linked child's fees. **Students have zero access (HTTP 403 Forbidden).**

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/fee-components` | Admin | List fee components (Coaching, Mess, Other). |
| `POST` | `/fee-structures` | Admin | Configure standard amounts in paise per class/session. |
| `POST` | `/student-fee-assignments` | Admin | Set student-specific fee overrides in paise. |
| `POST` | `/invoices/generate` | Admin | Generate monthly invoices (Combined or Separate) for a class. |
| `GET` | `/invoices` | Admin | List invoices with status, class, and overdue filters. |
| `GET` | `/invoices/:id` | Admin, Teacher (Assigned), Parent (Linked) | Get itemized invoice details. |
| `POST` | `/payments` | Admin | Record payment in paise; atomically allocates to invoice and issues receipt. |
| `GET` | `/payments` | Admin | Query payment ledger. |
| `GET` | `/receipts/:id` | Admin, Parent (Linked) | View or print formal payment receipt. |

#### `POST /payments` Payload (Integer Paise)
```json
{
  "studentId": "std_01HJ8Z...",
  "amountPaidPaise": 360000,
  "paymentMethod": "UPI",
  "transactionReference": "UPI/20261123/987123984",
  "paymentDate": "2026-11-23",
  "notes": "Full fee payment via institute QR code",
  "allocations": [
    {
      "invoiceId": "inv_01HJ8Z...",
      "allocatedAmountPaise": 360000
    }
  ]
}
```

---

## 10. Reports & Audit Logs (`/reports`, `/audit-logs`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/reports/students` | Admin | Student strength and enrollment reports. |
| `GET` | `/reports/attendance` | Admin | Monthly attendance percentages by class and subject. |
| `GET` | `/reports/fees/collection` | Admin | Monthly collections broken down by cash, UPI, bank transfer. |
| `GET` | `/reports/fees/outstanding` | Admin | Overdue defaulters list and outstanding fee balances. |
| `GET` | `/audit-logs` | Super Admin | Search immutable audit trail by actor, entity type, and date range. |
