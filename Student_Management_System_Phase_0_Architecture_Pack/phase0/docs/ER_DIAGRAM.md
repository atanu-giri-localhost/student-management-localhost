# Conceptual ER Diagram

This is a conceptual model, not the final physical schema. Table names and optional relationships may change after open business rules are approved.

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : assigned
  USER ||--o| TEACHER_PROFILE : may_have
  USER ||--o| PARENT_PROFILE : may_have
  PARENT_PROFILE ||--o{ PARENT_STUDENT : links
  STUDENT ||--o{ PARENT_STUDENT : linked_to
  STUDENT ||--o{ ENROLLMENT : has
  ACADEMIC_SESSION ||--o{ ENROLLMENT : contains
  CLASS ||--o{ ENROLLMENT : places
  ACADEMIC_SESSION ||--o{ CLASS_SUBJECT : offers
  CLASS ||--o{ CLASS_SUBJECT : has
  SUBJECT ||--o{ CLASS_SUBJECT : included
  TEACHER_PROFILE ||--o{ TEACHER_ASSIGNMENT : receives
  ACADEMIC_SESSION ||--o{ TEACHER_ASSIGNMENT : scopes
  CLASS ||--o{ TEACHER_ASSIGNMENT : assigned
  SUBJECT ||--o{ TEACHER_ASSIGNMENT : teaches

  ENROLLMENT ||--o{ DAILY_ATTENDANCE_RECORD : records
  ATTENDANCE_DAY ||--o{ DAILY_ATTENDANCE_RECORD : contains
  ENROLLMENT ||--o{ PERIOD_ATTENDANCE_RECORD : records
  PERIOD_ATTENDANCE_REGISTER ||--o{ PERIOD_ATTENDANCE_RECORD : contains
  ENROLLMENT ||--o{ PERFORMANCE_RECORD : has
  TEACHER_PROFILE ||--o{ PERFORMANCE_RECORD : enters

  ACADEMIC_SESSION ||--o{ EXAMINATION : schedules
  EXAMINATION ||--o{ EXAM_SUBJECT : contains
  EXAM_SUBJECT ||--o{ EXAM_MARK : receives
  ENROLLMENT ||--o{ EXAM_MARK : earns

  CLASS ||--o{ TIMETABLE_SLOT : schedules
  SUBJECT ||--o{ TIMETABLE_SLOT : covers
  TEACHER_PROFILE ||--o{ TIMETABLE_SLOT : teaches

  ENROLLMENT ||--o{ STUDENT_FEE_ASSIGNMENT : has
  STUDENT ||--o{ INVOICE : billed
  INVOICE ||--|{ INVOICE_ITEM : contains
  STUDENT ||--o{ PAYMENT : makes
  PAYMENT ||--o{ PAYMENT_ALLOCATION : allocated
  INVOICE ||--o{ PAYMENT_ALLOCATION : receives
  PAYMENT ||--o| RECEIPT : documented

  USER ||--o{ AUDIT_LOG : performs
```

## Notes

- `USER_ROLE` supports role assignments; application policy should prevent privilege escalation.
- `PARENT_STUDENT` is a many-to-many relationship and must include verification/status metadata.
- `ENROLLMENT` is the historical link between a student, class and academic session.
- Attendance records should reference the enrollment and their register.
- `EXAM_MARK` references a specific exam subject and enrollment.
- Finance records must preserve invoice and payment history.
- The ER diagram omits some lookup/configuration tables for readability.
