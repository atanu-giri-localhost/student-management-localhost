-- ============================================================================
-- Synthetic Development Seed Data: seeds/seed.sql
-- Project: Student Management System (Coaching Institute + Mess Fee Ledger)
-- WARNING: SYNTHETIC DEVELOPMENT FIXTURES ONLY.
--          NEVER place inside migrations/ and NEVER run against production D1.
-- Usage:   npx wrangler d1 execute sms-coaching-d1 --local --file=./seeds/seed.sql
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. System Roles (5 canonical roles)
-- ----------------------------------------------------------------------------
INSERT INTO roles (id, name, description) VALUES
  ('10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN', 'Owner and full institutional administrator'),
  ('10000000-0000-4000-8000-000000000002', 'COACHING_ADMIN', 'Day-to-day academic, admission, and finance administrator'),
  ('10000000-0000-4000-8000-000000000003', 'TEACHER', 'Faculty member scoped by class/subject assignments'),
  ('10000000-0000-4000-8000-000000000004', 'STUDENT', 'Student portal read-only academic access (zero fee access)'),
  ('10000000-0000-4000-8000-000000000005', 'PARENT', 'Parent/guardian read-only multi-child academic and fee access')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Demo Users (matching docs/DEVELOPMENT_GUIDE.md)
-- ----------------------------------------------------------------------------
INSERT INTO users (id, phone_normalized, email, is_active, created_at, updated_at) VALUES
  ('11000000-0000-4000-8000-000000000001', '+919999900001', 'superadmin@apexcoaching.example', 1, '2026-04-01T09:00:00.000Z', '2026-04-01T09:00:00.000Z'),
  ('11000000-0000-4000-8000-000000000002', '+919999900002', 'admin@apexcoaching.example', 1, '2026-04-01T09:05:00.000Z', '2026-04-01T09:05:00.000Z'),
  ('11000000-0000-4000-8000-000000000003', '+919876500001', 'priya.nair@apexcoaching.example', 1, '2026-04-01T09:10:00.000Z', '2026-04-01T09:10:00.000Z'),
  ('11000000-0000-4000-8000-000000000004', '+919876500002', 'vikram.mehta@apexcoaching.example', 1, '2026-04-01T09:15:00.000Z', '2026-04-01T09:15:00.000Z'),
  ('11000000-0000-4000-8000-000000000005', '+919876510001', 'aarav.sharma@apexcoaching.example', 1, '2026-04-01T09:20:00.000Z', '2026-04-01T09:20:00.000Z'),
  ('11000000-0000-4000-8000-000000000006', '+919876520001', 'sunita.sharma@apexcoaching.example', 1, '2026-04-01T09:25:00.000Z', '2026-04-01T09:25:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES
  ('12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-04-01T09:00:00.000Z'),
  ('12000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '2026-04-01T09:05:00.000Z'),
  ('12000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '2026-04-01T09:10:00.000Z'),
  ('12000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', '2026-04-01T09:15:00.000Z'),
  ('12000000-0000-4000-8000-000000000005', '11000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', '2026-04-01T09:20:00.000Z'),
  ('12000000-0000-4000-8000-000000000006', '11000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005', '2026-04-01T09:25:00.000Z')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Academic Sessions, Classes, Subjects & Curriculum Mapping
-- ----------------------------------------------------------------------------
INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, created_at) VALUES
  ('16000000-0000-4000-8000-000000000001', '2025-2026', '2025-04-01', '2026-03-31', 0, '2025-03-15T08:00:00.000Z'),
  ('16000000-0000-4000-8000-000000000002', '2026-2027', '2026-04-01', '2027-03-31', 1, '2026-03-15T08:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO classes (id, name, grade_level, section) VALUES
  ('17000000-0000-4000-8000-000000000001', 'Class 9', 9, 'A'),
  ('17000000-0000-4000-8000-000000000002', 'Class 10', 10, 'A'),
  ('17000000-0000-4000-8000-000000000003', 'Class 11', 11, 'Science')
ON CONFLICT DO NOTHING;

INSERT INTO subjects (id, name, code, created_at) VALUES
  ('18000000-0000-4000-8000-000000000001', 'Mathematics', 'MATH-10', '2026-03-15T08:05:00.000Z'),
  ('18000000-0000-4000-8000-000000000002', 'Science', 'SCI-10', '2026-03-15T08:05:00.000Z'),
  ('18000000-0000-4000-8000-000000000003', 'English', 'ENG-10', '2026-03-15T08:05:00.000Z'),
  ('18000000-0000-4000-8000-000000000004', 'Mathematics', 'MATH-09', '2026-03-15T08:05:00.000Z'),
  ('18000000-0000-4000-8000-000000000005', 'Science', 'SCI-09', '2026-03-15T08:05:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO class_subjects (id, academic_session_id, class_id, subject_id) VALUES
  ('19000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001'),
  ('19000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000002'),
  ('19000000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000003'),
  ('19000000-0000-4000-8000-000000000004', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000004'),
  ('19000000-0000-4000-8000-000000000005', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000005'),
  ('19000000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Students, Parent Profiles, Parent-Student Links & Enrollments
-- ----------------------------------------------------------------------------
INSERT INTO students (
  id, user_id, admission_number, full_name, date_of_birth, gender, blood_group,
  photo_file_id, contact_phone, residential_address, emergency_contact_name,
  emergency_contact_phone, lifecycle_status, admission_date, created_at, updated_at
) VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000005',
    'ADM-2026-0001',
    'Aarav Sharma',
    '2011-05-14',
    'Male',
    'B+',
    NULL,
    '+919876510001',
    '42 MG Road, Sector 4, Jaipur',
    'Sunita Sharma',
    '+919876520001',
    'ACTIVE',
    '2025-04-01',
    '2025-04-01T09:00:00.000Z',
    '2026-04-01T09:20:00.000Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    NULL,
    'ADM-2026-0002',
    'Diya Sharma',
    '2012-08-22',
    'Female',
    'O+',
    NULL,
    NULL,
    '42 MG Road, Sector 4, Jaipur',
    'Sunita Sharma',
    '+919876520001',
    'ACTIVE',
    '2026-04-01',
    '2026-04-01T09:25:00.000Z',
    '2026-04-01T09:25:00.000Z'
  ),
  (
    '14000000-0000-4000-8000-000000000003',
    NULL,
    'ADM-2026-0003',
    'Kabir Patel',
    '2011-02-10',
    'Male',
    'A+',
    NULL,
    NULL,
    '18 Station Road, Jaipur',
    'Ramesh Patel',
    '+919876520099',
    'ACTIVE',
    '2026-04-01',
    '2026-04-01T09:30:00.000Z',
    '2026-04-01T09:30:00.000Z'
  )
ON CONFLICT DO NOTHING;

INSERT INTO parent_profiles (
  id, user_id, full_name, phone_normalized, email, relationship_type, created_at
) VALUES
  (
    '13000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000006',
    'Sunita Sharma',
    '+919876520001',
    'sunita.sharma@apexcoaching.example',
    'Mother',
    '2026-04-01T09:25:00.000Z'
  )
ON CONFLICT DO NOTHING;

-- Multi-child verified linkage for Sunita Sharma (Aarav in 10-A, Diya in 9-A; Kabir unlinked)
INSERT INTO parent_students (
  id, parent_profile_id, student_id, is_primary, verification_status, created_at
) VALUES
  ('15000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 1, 'VERIFIED', '2026-04-01T09:26:00.000Z'),
  ('15000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 1, 'VERIFIED', '2026-04-01T09:27:00.000Z')
ON CONFLICT DO NOTHING;

-- Historical (2025-2026 PROMOTED) + Active (2026-2027 ACTIVE) enrollments
INSERT INTO enrollments (
  id, student_id, academic_session_id, class_id, roll_number, enrollment_status, start_date, end_date, created_at
) VALUES
  ('1a000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000001', '09A-01', 'PROMOTED', '2025-04-01', '2026-03-31', '2025-04-01T09:00:00.000Z'),
  ('1a000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '10A-01', 'ACTIVE', '2026-04-01', NULL, '2026-04-01T09:20:00.000Z'),
  ('1a000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '09A-01', 'ACTIVE', '2026-04-01', NULL, '2026-04-01T09:25:00.000Z'),
  ('1a000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '10A-02', 'ACTIVE', '2026-04-01', NULL, '2026-04-01T09:30:00.000Z')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Teacher Profiles & Session-Scoped Assignments
-- ----------------------------------------------------------------------------
INSERT INTO teacher_profiles (
  id, user_id, employee_code, full_name, qualification, specialization,
  joining_date, employment_status, photo_file_id, created_at
) VALUES
  (
    '1b000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000003',
    'TCH-001',
    'Priya Nair',
    'M.Sc., B.Ed.',
    'Physics & General Science',
    '2024-06-01',
    'ACTIVE',
    NULL,
    '2026-04-01T09:10:00.000Z'
  ),
  (
    '1b000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000004',
    'TCH-002',
    'Vikram Mehta',
    'M.Sc. Mathematics',
    'Algebra & Geometry',
    '2025-01-15',
    'ACTIVE',
    NULL,
    '2026-04-01T09:15:00.000Z'
  )
ON CONFLICT DO NOTHING;

-- Priya Nair is CLASS_TEACHER for Class 10-A and REGULAR_TEACHER for Class 9-A Science
-- Vikram Mehta is REGULAR_TEACHER for Class 10-A Math and CLASS_TEACHER for Class 9-A
INSERT INTO teacher_assignments (
  id, teacher_profile_id, academic_session_id, class_id, subject_id, responsibility_category, created_at
) VALUES
  ('1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000002', 'CLASS_TEACHER', '2026-04-01T09:12:00.000Z'),
  ('1c000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000005', 'REGULAR_TEACHER', '2026-04-01T09:12:00.000Z'),
  ('1c000000-0000-4000-8000-000000000003', '1b000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', 'REGULAR_TEACHER', '2026-04-01T09:16:00.000Z'),
  ('1c000000-0000-4000-8000-000000000004', '1b000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000004', 'CLASS_TEACHER', '2026-04-01T09:16:00.000Z')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Dual Attendance, Daily Performance, Exams, Grading & Timetable Samples
-- ----------------------------------------------------------------------------
INSERT INTO attendance_days (
  id, academic_session_id, class_id, attendance_date, marked_by_teacher_id, is_locked, created_at
) VALUES
  ('1d000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '2026-11-23', '1b000000-0000-4000-8000-000000000001', 0, '2026-11-23T03:30:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO daily_attendance_records (
  id, attendance_day_id, enrollment_id, status, remarks, created_at
) VALUES
  ('1e000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000002', 'PRESENT', NULL, '2026-11-23T03:30:00.000Z'),
  ('1e000000-0000-4000-8000-000000000002', '1d000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000004', 'LATE', 'Arrived 10 minutes late', '2026-11-23T03:30:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO period_attendance_registers (
  id, academic_session_id, class_id, subject_id, attendance_date, period_number, marked_by_teacher_id, is_locked, created_at
) VALUES
  ('1f000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', '2026-11-23', 1, '1b000000-0000-4000-8000-000000000002', 0, '2026-11-23T04:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO period_attendance_records (
  id, register_id, enrollment_id, status, remarks, created_at
) VALUES
  ('20000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000002', 'PRESENT', NULL, '2026-11-23T04:00:00.000Z'),
  ('20000000-0000-4000-8000-000000000002', '1f000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000004', 'PRESENT', NULL, '2026-11-23T04:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO performance_records (
  id, enrollment_id, teacher_profile_id, subject_id, evaluation_date,
  category, marks_obtained, max_marks, remarks, created_at
) VALUES
  (
    '21000000-0000-4000-8000-000000000001',
    '1a000000-0000-4000-8000-000000000002',
    '1b000000-0000-4000-8000-000000000002',
    '18000000-0000-4000-8000-000000000001',
    '2026-11-22',
    'CLASS_TEST',
    18.0,
    20.0,
    'Strong grasp of quadratic equations.',
    '2026-11-22T10:30:00.000Z'
  )
ON CONFLICT DO NOTHING;

INSERT INTO examinations (
  id, academic_session_id, name, exam_type, start_date, end_date, is_published, created_at
) VALUES
  ('22000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', 'Unit Test 1 - 2026', 'UNIT_TEST', '2026-08-10', '2026-08-14', 1, '2026-08-01T08:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO exam_subjects (
  id, examination_id, class_id, subject_id, exam_date, max_marks, passing_marks
) VALUES
  ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', '2026-08-10', 50.0, 18.0)
ON CONFLICT DO NOTHING;

INSERT INTO exam_marks (
  id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks, entered_by_teacher_id, created_at
) VALUES
  ('24000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000002', 44.0, 0, 'Consistent problem-solving accuracy.', '1b000000-0000-4000-8000-000000000002', '2026-08-18T11:00:00.000Z')
ON CONFLICT DO NOTHING;

-- Synthetic grading scale fixture (institutional grade boundaries remain OPEN #9)
INSERT INTO grading_scales (
  id, academic_session_id, name, grade_label, min_percentage, max_percentage,
  grade_point, is_passing, effective_from, is_active, created_at
) VALUES
  ('25000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'A+', 90.0, 100.0, 10.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'A', 80.0, 89.99, 9.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'B', 65.0, 79.99, 8.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000004', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'C', 50.0, 64.99, 7.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000005', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'D', 35.0, 49.99, 6.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'F', 0.0, 34.99, 0.0, 0, '2026-04-01', 1, '2026-04-01T08:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO rooms (id, name, code, capacity, floor_or_building, is_active, created_at) VALUES
  ('26000000-0000-4000-8000-000000000001', 'Room 101', 'R-101', 40, 'First Floor', 1, '2026-04-01T08:00:00.000Z'),
  ('26000000-0000-4000-8000-000000000002', 'Science Lab', 'SCI-LAB', 30, 'Ground Floor', 1, '2026-04-01T08:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO timetable_slots (
  id, academic_session_id, class_id, subject_id, teacher_profile_id,
  room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
) VALUES
  ('27000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000002', '26000000-0000-4000-8000-000000000001', 'Room 101', 1, 1, '09:00', '09:50', '2026-04-01T08:30:00.000Z'),
  ('27000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', '26000000-0000-4000-8000-000000000002', 'Science Lab', 1, 2, '10:00', '10:50', '2026-04-01T08:30:00.000Z')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. Finance: Fee Components, Structures, Overrides, Invoices, Payments, Receipts
--    All amounts are INTEGER PAISE (100 paise = 1 INR).
-- ----------------------------------------------------------------------------
INSERT INTO fee_components (id, code, name, description) VALUES
  ('28000000-0000-4000-8000-000000000001', 'COACHING', 'Coaching Fee', 'Monthly academic coaching tuition charge'),
  ('28000000-0000-4000-8000-000000000002', 'MESS', 'Mess Fee', 'Monthly mess fee component (fee charging only; no kitchen/hostel operations)'),
  ('28000000-0000-4000-8000-000000000003', 'OTHER', 'Other Charges', 'Printed study material and miscellaneous charges')
ON CONFLICT DO NOTHING;

-- Class 10-A default combined total: 150000 + 200000 + 10000 = 360000 paise (INR 3,600.00)
-- Class 9-A  default combined total: 120000 + 200000 + 10000 = 330000 paise (INR 3,300.00)
INSERT INTO fee_structures (
  id, academic_session_id, class_id, fee_component_id, default_amount_paise, effective_from
) VALUES
  ('29000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '28000000-0000-4000-8000-000000000001', 150000, '2026-04-01'),
  ('29000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '28000000-0000-4000-8000-000000000002', 200000, '2026-04-01'),
  ('29000000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '28000000-0000-4000-8000-000000000003', 10000, '2026-04-01'),
  ('29000000-0000-4000-8000-000000000004', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '28000000-0000-4000-8000-000000000001', 120000, '2026-04-01'),
  ('29000000-0000-4000-8000-000000000005', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '28000000-0000-4000-8000-000000000002', 200000, '2026-04-01'),
  ('29000000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '28000000-0000-4000-8000-000000000003', 10000, '2026-04-01')
ON CONFLICT DO NOTHING;

-- Custom override fixture for Diya Sharma (Class 9-A): INR 1,000.00 coaching fee
INSERT INTO student_fee_assignments (
  id, enrollment_id, fee_component_id, custom_amount_paise, reason, effective_from
) VALUES
  ('2a000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000003', '28000000-0000-4000-8000-000000000001', 100000, 'Custom enrollment override fixture (concession policy OPEN #10)', '2026-04-01')
ON CONFLICT DO NOTHING;

-- Sample Invoices (November 2026):
--   INV-202611-0001: Aarav Sharma (PAID: 360000 / 360000)
--   INV-202611-0002: Kabir Patel  (PARTIALLY_PAID: 200000 / 360000, outstanding 160000)
--   INV-202611-0003: Diya Sharma  (UNPAID: 0 / 310000 using custom coaching override)
INSERT INTO invoices (
  id, invoice_number, student_id, enrollment_id, billing_month, billing_year,
  invoice_type, total_amount_paise, due_date, status, created_at
) VALUES
  ('2b000000-0000-4000-8000-000000000001', 'INV-202611-0001', '14000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000002', 11, 2026, 'COMBINED', 360000, '2026-11-10', 'PAID', '2026-11-01T04:00:00.000Z'),
  ('2b000000-0000-4000-8000-000000000002', 'INV-202611-0002', '14000000-0000-4000-8000-000000000003', '1a000000-0000-4000-8000-000000000004', 11, 2026, 'COMBINED', 360000, '2026-11-10', 'PARTIALLY_PAID', '2026-11-01T04:00:00.000Z'),
  ('2b000000-0000-4000-8000-000000000003', 'INV-202611-0003', '14000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000003', 11, 2026, 'COMBINED', 310000, '2026-11-10', 'UNPAID', '2026-11-01T04:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, fee_component_id, description, amount_paise) VALUES
  ('2c000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', '28000000-0000-4000-8000-000000000001', 'Coaching Fee - Nov 2026 (Class 10-A)', 150000),
  ('2c000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000001', '28000000-0000-4000-8000-000000000002', 'Mess Fee - Nov 2026 (Class 10-A)', 200000),
  ('2c000000-0000-4000-8000-000000000003', '2b000000-0000-4000-8000-000000000001', '28000000-0000-4000-8000-000000000003', 'Other Charges - Nov 2026 (Class 10-A)', 10000),
  ('2c000000-0000-4000-8000-000000000004', '2b000000-0000-4000-8000-000000000002', '28000000-0000-4000-8000-000000000001', 'Coaching Fee - Nov 2026 (Class 10-A)', 150000),
  ('2c000000-0000-4000-8000-000000000005', '2b000000-0000-4000-8000-000000000002', '28000000-0000-4000-8000-000000000002', 'Mess Fee - Nov 2026 (Class 10-A)', 200000),
  ('2c000000-0000-4000-8000-000000000006', '2b000000-0000-4000-8000-000000000002', '28000000-0000-4000-8000-000000000003', 'Other Charges - Nov 2026 (Class 10-A)', 10000),
  ('2c000000-0000-4000-8000-000000000007', '2b000000-0000-4000-8000-000000000003', '28000000-0000-4000-8000-000000000001', 'Coaching Fee - Nov 2026 (Custom Override)', 100000),
  ('2c000000-0000-4000-8000-000000000008', '2b000000-0000-4000-8000-000000000003', '28000000-0000-4000-8000-000000000002', 'Mess Fee - Nov 2026 (Class 9-A)', 200000),
  ('2c000000-0000-4000-8000-000000000009', '2b000000-0000-4000-8000-000000000003', '28000000-0000-4000-8000-000000000003', 'Other Charges - Nov 2026 (Class 9-A)', 10000)
ON CONFLICT DO NOTHING;

INSERT INTO payments (
  id, student_id, amount_paid_paise, payment_method, transaction_reference,
  payment_date, notes, recorded_by_user_id, created_at
) VALUES
  ('2d000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 360000, 'UPI', 'UPI/20261105/000123', '2026-11-05', 'Full November fee payment via institute QR', '11000000-0000-4000-8000-000000000002', '2026-11-05T06:15:00.000Z'),
  ('2d000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000003', 200000, 'CASH', NULL, '2026-11-06', 'Partial cash installment for November invoice', '11000000-0000-4000-8000-000000000002', '2026-11-06T07:20:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO payment_allocations (
  id, payment_id, invoice_id, allocated_amount_paise, created_at
) VALUES
  ('2e000000-0000-4000-8000-000000000001', '2d000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', 360000, '2026-11-05T06:15:00.000Z'),
  ('2e000000-0000-4000-8000-000000000002', '2d000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000002', 200000, '2026-11-06T07:20:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO receipts (id, receipt_number, payment_id, issued_date, created_at) VALUES
  ('2f000000-0000-4000-8000-000000000001', 'REC-202611-0001', '2d000000-0000-4000-8000-000000000001', '2026-11-05', '2026-11-05T06:15:00.000Z'),
  ('2f000000-0000-4000-8000-000000000002', 'REC-202611-0002', '2d000000-0000-4000-8000-000000000002', '2026-11-06', '2026-11-06T07:20:00.000Z')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. Sample Audit Log Entry
-- ----------------------------------------------------------------------------
INSERT INTO audit_logs (
  id, actor_user_id, action, entity_type, entity_id,
  old_values, new_values, ip_address, request_id, created_at
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    'CREATE',
    'PAYMENT',
    '2d000000-0000-4000-8000-000000000001',
    NULL,
    '{"amountPaidPaise":360000,"paymentMethod":"UPI","invoiceId":"2b000000-0000-4000-8000-000000000001","receiptNumber":"REC-202611-0001"}',
    '127.0.0.1',
    'req_seed_0001',
    '2026-11-05T06:15:00.000Z'
  )
ON CONFLICT DO NOTHING;
