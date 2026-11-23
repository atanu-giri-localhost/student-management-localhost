# API Design — Initial REST Contract

## 1. Conventions

Base path: `/api/v1`

- JSON request and response bodies.
- Use plural resource names.
- Use HTTP methods consistently.
- Validate all input with Zod at the server boundary.
- Use pagination for collections.
- Use ISO date strings and explicit timezone semantics.
- Use integer paise for money.
- Return stable error codes; do not expose stack traces or SQL details.
- Authenticate using secure session cookies.
- Mutating requests require CSRF protection appropriate to the cookie/session design.
- Add request/correlation IDs.
- Do not expose OTP hashes, session hashes, internal audit payloads or private R2 keys.

## 2. Suggested response envelope

Success:
```json
{
  "data": {},
  "meta": {
    "requestId": "opaque-id"
  }
}
```

Paginated:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0
  }
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": []
  },
  "meta": {
    "requestId": "opaque-id"
  }
}
```

## 3. Authentication endpoints

- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/logout`
- `GET /auth/session`
- `POST /auth/session/revoke` (authorized administrative workflow)

OTP request responses must not reveal whether a phone number is registered. Rate-limit by phone hash, IP/device signals and provider limits. Never return OTP values from production endpoints.

## 4. Users and relationships

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `POST /users/:id/deactivate`
- `GET /parents`
- `POST /parents`
- `POST /parents/:parentId/students`
- `DELETE /parents/:parentId/students/:studentId` (soft unlink/audited workflow)

## 5. Students and academics

- `GET /students`
- `POST /students`
- `GET /students/:id`
- `PATCH /students/:id`
- `POST /students/:id/archive`
- `GET /academic-sessions`
- `POST /academic-sessions`
- `GET /classes`
- `POST /classes`
- `GET /subjects`
- `POST /subjects`
- `POST /enrollments`
- `POST /enrollments/:id/promote` (only after promotion rules are approved)
- `GET /students/:id/enrollments`

## 6. Teachers

- `GET /teachers`
- `POST /teachers`
- `GET /teachers/:id`
- `PATCH /teachers/:id`
- `POST /teacher-assignments`
- `PATCH /teacher-assignments/:id`
- `GET /teachers/me/assignments`

## 7. Attendance and performance

- `POST /attendance/daily/registers`
- `PUT /attendance/daily/registers/:id/records`
- `GET /attendance/daily`
- `POST /attendance/period/registers`
- `PUT /attendance/period/registers/:id/records`
- `GET /attendance/reports`
- `POST /performance-records`
- `GET /performance-records`

Attendance write endpoints must be idempotent or protected against duplicate submission and must enforce assignment scope.

## 8. Examinations and timetable

- `POST /examinations`
- `GET /examinations`
- `POST /examinations/:id/subjects`
- `PUT /examinations/:id/marks`
- `GET /examinations/:id/results`
- `GET /students/me/results`
- `GET /timetable/classes/:classId`
- `GET /timetable/teachers/me`
- `POST /timetable/slots`
- `PATCH /timetable/slots/:id`

## 9. Finance

- `GET /fee-components`
- `POST /fee-structures`
- `POST /student-fee-assignments`
- `POST /invoices/generate`
- `GET /invoices`
- `GET /invoices/:id`
- `POST /payments`
- `GET /payments`
- `GET /invoices/:id/allocations`
- `GET /receipts/:id`

Payment creation must be idempotent against duplicate client submissions. The service must validate payment amount, allocation totals, invoice outstanding amounts and actor permissions, then commit the related writes atomically.

## 10. Reports and audit

- `GET /reports/students`
- `GET /reports/attendance`
- `GET /reports/examinations`
- `GET /reports/fees/collection`
- `GET /reports/fees/outstanding`
- `GET /audit-logs`

Report endpoints must enforce role and row-level scope and use pagination/date filters.

## 11. API contract workflow

Before a module is implemented:
1. Agree request/response schemas.
2. Agree authorization policy.
3. Agree error codes.
4. Add example payloads.
5. Add integration tests.
6. Update this document when contracts change.
