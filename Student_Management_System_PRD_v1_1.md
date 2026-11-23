**PROJECT REQUIREMENTS**  
**DOCUMENT**

# **Student Management** **System**

**Coaching Institute \+ Mess Fee Management**

| Document property | Value |
| :---- | :---- |
| Document type | Project Requirements Document (PRD) |
| Version | 1.1 – Draft (Parent role added) |
| Status | For review and discussion |
| Product type | Single-institution web application |
| Institution | Coaching institute with mess fee charging |
| Initial scope | Basic Minimum Viable Product (MVP) |
| Prepared | 19 November 2026 |

*This document records the requirements confirmed so far.*  
*Unresolved decisions are explicitly marked for review.*

# **Document Control**

| Version | Date | Description | Status |
| :---- | :---- | :---- | :---- |
| 1.0 | 19 Nov 2026 | Initial PRD compiled from requirements discussion | Draft – for review |
| 1.1 | 19 Nov 2026 | Added Parent / Guardian role, permissions, dashboard and related requirements | Draft – for review |

## **How to use this document**

Review the confirmed scope and workflows first. Items marked “Pending confirmation” or “Proposed” are not final requirements. They should be discussed and approved before technical design and implementation.

# **Contents**

1. 1\. Project Overview  
2. 2\. Goals, Scope and Users  
3. 3\. Roles and Access Control  
4. 4\. Student Management  
5. 5\. Class and Subject Management  
6. 6\. Teacher Management  
7. 7\. Attendance Management  
8. 8\. Daily Student Performance  
9. 9\. Examination Management  
10. 10\. Timetable Management  
11. 11\. Fee Management  
12. 12\. Dashboards  
13. 13\. Authentication and Security  
14. 14\. Reports  
15. 15\. Non-Functional Requirements  
16. 16\. Out of Scope  
17. 17\. Proposed Development Sequence  
18. 18\. Open Questions and Decisions

# **1\. Project Overview**

## **1.1 Introduction**

The Student Management System (SMS) is a web-based application intended to centralize academic, administrative and financial operations for a single coaching institution. It will manage students, teachers, classes, subjects, attendance, daily performance, examinations, timetables and fee collection.

The system will also support mess fees as a fee component. It is not intended to manage mess operations such as accommodation, meal attendance, kitchen activity or food inventory in the initial version.

## **1.2 Product Vision**

Build a straightforward, reliable and maintainable management platform for one coaching institution, with role-specific dashboards and controlled access to student and financial information.

## **1.3 Objectives**

* Digitize student admission and profile management.  
* Organize students by academic class or grade.  
* Manage teacher assignments, including different responsibilities across classes.  
* Record daily and period-wise attendance.  
* Track daily student performance, marks and teacher remarks.  
* Manage formal examinations, marks and results.  
* Maintain class and teacher timetables.  
* Generate monthly coaching and mess fee invoices, separately or together.  
* Record full and partial payments and track outstanding balances.  
* Provide relevant dashboards and reports for each user role.

# **2\. Goals, Scope and Users**

## **2.1 Product Configuration**

| Item | Decision |
| :---- | :---- |
| Institution type | Coaching \+ mess fee charging |
| Product deployment scope | Single institution |
| Initial scope | Basic MVP |
| Student organization | Class / grade based |
| Billing frequency | Monthly |
| Notification system | Excluded from initial MVP |
| WhatsApp API | Login-related use is being considered; exact flow pending |

## **2.2 In-Scope Modules**

* Authentication and role-based access (including Parent accounts linked to students)  
* Student admission and profile management  
* Class and subject management  
* Teacher profiles and class/subject assignments  
* Daily and period-wise attendance  
* Daily student performance and remarks  
* Formal examinations and results  
* Daily and weekly timetable management  
* Monthly fee generation, invoices and payments  
* Admin, Teacher, Student and Parent dashboards  
* Academic and financial reports

## **2.3 Primary Users**

| Role | Primary purpose |
| :---- | :---- |
| Super Admin / Owner | Overall control and access to all system modules |
| Coaching Admin | Day-to-day institutional and administrative operations |
| Teacher / Faculty | Academic work for assigned classes and subjects; view assigned students' fee details |
| Student | View own profile and academic information |
| Parent / Guardian | View linked child's academic, attendance and fee information (read-only) |

# **3\. Roles and Access Control**

## **3.1 Super Admin / Owner**

* Access all modules and institutional records.  
* Manage users, students, teachers, classes and subjects.  
* Manage attendance, performance, examinations and timetables.  
* Generate invoices, record payments and view financial reports.  
* Manage system settings and permissions.

## **3.2 Coaching Admin**

* Manage student admissions and profiles.  
* Manage classes, subjects and teacher assignments.  
* Manage attendance, examinations, results and timetables.  
* Generate monthly fee invoices and record payments.  
* View operational and financial reports.

The exact permission differences between Super Admin and Coaching Admin are pending confirmation.

## **3.3 Teacher / Faculty**

* View assigned classes, subjects and student lists.  
* Mark daily attendance for assigned classes.  
* Enter daily performance marks and remarks.  
* Enter formal examination marks where authorized.  
* View personal teaching timetable and historical student performance.  
* View complete fee information for students associated with assigned classes.  
* Cannot generate invoices or record payments.

## **3.4 Student**

* View own personal and admission details.  
* View own class, subjects, attendance, daily performance and teacher remarks.  
* View own examination results/report cards and timetable.  
* View upcoming examinations.  
* Cannot view fee information or other students' records.  
* Cannot edit attendance, marks or teacher remarks.

## **3.5 Parent / Guardian**

* View linked child's personal and admission details (read-only).  
* View linked child's class, subjects, attendance, daily performance and teacher remarks.  
* View linked child's examination results/report cards, timetable and upcoming examinations.  
* View linked child's fee information: invoices, total fee, paid amount, pending amount, due dates, overdue status and payment history.  
* Parents with more than one child enrolled can view each linked child separately.  
* Cannot view other students' records or fee information.  
* Cannot edit student profiles, attendance, marks or teacher remarks.  
* Cannot generate invoices, record payments or pay online in the initial version.

## **3.6 Initial Access Matrix**

| Capability | Admin | Teacher | Student | Parent |
| :---- | :---- | :---- | :---- | :---- |
| Manage student profiles | Full | Assigned scope / pending exact edit rights | View own | View linked child (read-only) |
| View class and subject data | All | Assigned | Own class | Linked child's class |
| Manage attendance | All | Assigned classes | View own | View linked child |
| Daily marks and remarks | All | Assigned students | View own | View linked child |
| Formal exam marks | All | Assigned / authorized | View own results | View linked child's results |
| Timetable | Manage all | View own | View class | View linked child's class |
| View fee details | Full | Assigned students – full details | No access | Linked child's fees (read-only) |
| Generate invoices | Yes | No | No | No |
| Record payments | Yes | No | No | No |
| Financial reports | Yes | No | No | No |

# **4\. Student Management**

## **4.1 Admission and Unique Identifier**

Authorized administrators can create student admission records. Each student must have a unique admission number that can be used as a human-readable identifier across the application.

## **4.2 Student Profile Fields**

| Category | Fields |
| :---- | :---- |
| Personal | Full name, photograph, date of birth, gender |
| Contact | Phone number, email, residential address |
| Parent / Guardian | Parent or guardian name, relationship, contact and linked Parent portal account (one parent account can be linked to more than one student) |
| Admission | Unique admission number, admission date |
| Academic | Class / grade, previous academic information |
| Emergency | Emergency contact |
| Status | Active, Inactive, Left |

## **4.3 Student Operations**

* Create, view and edit student records.  
* Search students and filter by class or status.  
* Maintain admission and academic history.  
* Activate or deactivate student records.  
* Retain historical records when a student leaves.

Student self-edit permissions and the exact class-promotion workflow are pending confirmation.

# **5\. Class and Subject Management**

## **5.1 Class Management**

* Create and manage grades/classes such as Class 8 through Class 12\.  
* Assign students to classes.  
* View class details and class-wise student lists/counts.  
* Support class-wise subject configuration.

## **5.2 Subject Management**

* Create and edit subjects.  
* Assign subjects to classes.  
* Assign teachers to class/subject combinations.  
* View subjects by class.

# **6\. Teacher Management**

## **6.1 Teacher Responsibilities**

The system must support two responsibility categories: Regular Teacher and Class Teacher. A teacher may perform both categories, depending on the class assignment. Therefore, category belongs to the teacher's assignment rather than being a single exclusive property of the teacher profile.

## **6.2 Regular Teacher**

* Responsible for regular teaching in one or more assigned classes.  
* Can record daily class-test marks.  
* Can evaluate homework, classwork and assignments.  
* Can record general performance such as behaviour, participation and discipline.  
* Can add individual student remarks.

## **6.3 Class Teacher**

* May teach different subjects across different classes.  
* Can be assigned to multiple class/subject combinations.  
* Can enter daily marks and remarks for assigned students.  
* Can maintain academic progress records for assigned classes/subjects.

## **6.4 Teacher Assignment Example**

| Teacher | Class | Assignment category |
| :---- | :---- | :---- |
| Teacher A | Class 9 | Regular Teacher |
| Teacher A | Class 10 | Class Teacher |
| Teacher B | Class 9 | Class Teacher |
| Teacher B | Class 11 | Regular Teacher |

## **6.5 Teacher Profile**

* Name and photograph  
* Contact information and address  
* Qualification and specialization  
* Joining date  
* Assigned classes and subjects  
* Employment status

Salary/payroll management is not confirmed for the MVP.

# **7\. Attendance Management**

## **7.1 Attendance Modes**

| Mode | Requirement |
| :---- | :---- |
| Daily attendance | One daily attendance record per student per date |
| Period-wise attendance | Separate attendance for individual class/subject sessions |

## **7.2 Attendance Statuses**

* Present  
* Absent  
* Late  
* Leave

## **7.3 Functional Requirements**

* Teachers can mark attendance for assigned classes.  
* Administrators can view and manage attendance across the institution.  
* Students can view their own attendance.  
* Parents can view their linked child's attendance.  
* View student attendance history and monthly summaries.  
* Generate class-wise and subject-wise reports.  
* Calculate attendance percentages.

Daily and period-wise attendance must be stored separately. Reporting rules must avoid double-counting the same absence.

Exact rules for late arrival, leave approval and attendance correction are pending confirmation.

# **8\. Daily Student Performance**

## **8.1 Evaluation Categories**

| Category | Examples |
| :---- | :---- |
| Class tests | Daily test marks and subject-wise scores |
| Homework / classwork | Completion, quality, assignment marks |
| General performance | Behaviour, participation, discipline and overall classroom performance |

## **8.2 Student Remarks**

Teachers can add individual remarks for students, for example: “Good performance today”, “Needs improvement in Mathematics”, “Homework not completed” or “Very active in class”.

## **8.3 Performance Record Fields**

* Student reference  
* Teacher reference  
* Class and subject, where applicable  
* Date  
* Performance category  
* Marks or score, where applicable  
* Remarks / feedback

Historical performance records must be retained. Teachers can review records within their assigned scope; students can view their own records; parents can view their linked child's records.

# **9\. Examination Management**

## **9.1 Examination Types**

* Unit Test  
* Monthly Test  
* Half-Yearly Examination  
* Final Examination

## **9.2 Examination Setup**

* Create examinations and assign them to specific classes.  
* Create/select subjects for the examination.  
* Set maximum marks for each subject.

## **9.3 Marks and Result Calculation**

* Enter marks for individual students.  
* Automatically calculate total obtained marks and percentage.  
* Automatically calculate grades and pass/fail status.  
* Allow Admin to configure grading and passing criteria.

## **9.4 Result History and Reports**

* Maintain previous examination results.  
* Generate class-wise result reports.  
* Students and linked Parents can view the student's examination results.

Individual report-card generation was not explicitly confirmed in the final selected examination features and remains to be confirmed.

# **10\. Class Timetable Management**

* Create and manage classes and class schedules.  
* Add subjects to each class.  
* Assign teachers to subjects and classes.  
* Create daily and weekly timetables.  
* Set class timings and classroom/room numbers.  
* View individual teacher schedules.  
* View class-wise schedules.  
* Handle timetable changes and cancellations.

The system should prevent or flag conflicting teacher, class or room assignments. Conflict-handling rules should be finalized during detailed design.

# **11\. Fee Management**

## **11.1 Fee Scope**

Mess is included only as a fee component. Independent mess operations—room allocation, meal attendance, food inventory, kitchen operations and accommodation management—are outside the initial scope.

## **11.2 Fee Components**

* Coaching fee  
* Mess fee  
* Other additional charges

## **11.3 Fee Configuration**

* Support course-wise fee amounts.  
* Support custom fee amounts for individual students.  
* An individual student's custom fee can differ from the standard course fee.

## **11.4 Monthly Fee Generation**

The standard billing frequency is monthly. The system must support combined invoices and separate invoices.

### **11.5 Invoice Options**

| Method | Description |
| :---- | :---- |
| Combined invoice | One invoice can contain coaching fee, mess fee and other charges. |
| Separate invoices | Coaching and mess fees can be invoiced independently. |

Illustrative combined invoice:

| Fee component | Example amount |
| :---- | :---- |
| Coaching fee | ₹1,500 |
| Mess fee | ₹2,000 |
| Other charges | ₹100 |
| Total payable | ₹3,600 |

## **11.6 Payment Methods and Partial Payments**

* Cash  
* UPI / QR Code  
* Bank transfer  
* Partial payments are allowed; each installment must be recorded independently.

For the initial version, UPI and bank-transfer payments are expected to be recorded manually with a transaction/reference identifier. Payment gateway integration is out of scope.

## **11.7 Invoice and Balance Status**

* Paid  
* Partially Paid  
* Unpaid  
* Overdue should be tracked separately based on the due date.

## **11.8 Required Fee Tracking and Reports**

* Track due dates and overdue fees.  
* View student-wise payment history.  
* View monthly fee collection reports.  
* View pending and outstanding fee reports.

## **11.9 Fee Access Rules**

| Role | Fee access |
| :---- | :---- |
| Super Admin / Owner | Full access to fees, invoices, payments and reports |
| Coaching Admin | Fee generation, payment recording and financial reporting |
| Teacher | Full fee details for students associated with assigned classes: total fee, paid amount, pending amount, due dates and overdue status; cannot generate invoices or record payments |
| Student | No fee information access in the initial version |
| Parent / Guardian | Read-only fee details for own linked child: invoices, total fee, paid amount, pending amount, due dates, overdue status and payment history; cannot generate invoices, record payments or pay online |

The rule for teachers accessing historical fee information for students no longer in their assigned classes is pending confirmation.

# **12\. Dashboards**

## **12.1 Admin Dashboard**

* Total students, split into Active / Inactive / Left.  
* Total teachers.  
* Class-wise student count.  
* Today's attendance summary.  
* Monthly fee collection.  
* Total pending fees.  
* Overdue fee summary.  
* Recent fee payments.  
* Upcoming examinations.  
* Today's timetable.  
* Recent student admissions.

Suggested presentation: summary cards for key counts, charts for attendance/collections, and tables for recent payments and admissions.

## **12.2 Student Dashboard**

* Personal profile and admission details.  
* Class and subject information.  
* Daily and monthly attendance.  
* Daily performance marks.  
* Teacher remarks and feedback.  
* Examination results and report cards.  
* Class timetable.  
* Upcoming examinations.

Student fee information is excluded. Students have read-only access to their own academic records.

## **12.3 Teacher Dashboard**

* View assigned classes and subjects.  
* View student lists for assigned classes.  
* Mark daily student attendance.  
* Enter daily performance marks.  
* Add individual student remarks.  
* Enter formal examination marks.  
* View personal teaching timetable.  
* View previous student performance records.  
* View complete fee information for students in assigned classes.

## **12.4 Parent Dashboard**

* Linked child's profile and admission details; switch between children where more than one is linked.  
* Class and subject information.  
* Daily and monthly attendance.  
* Daily performance marks, teacher remarks and feedback.  
* Examination results and report cards.  
* Class timetable and upcoming examinations.  
* Fee summary: total fee, paid amount, pending amount, due dates and overdue status.  
* Invoices and payment history.

Parents have read-only access to their linked child's records. Fee information is view-only; Parents cannot generate invoices or record payments.

# **13\. Authentication and Security**

## **13.1 Authentication**

All protected areas require authentication. Accounts must be associated with a role and appropriate access permissions.

## **13.2 Security Requirements**

* Secure password storage.  
* Role-based authorization enforced on the backend, not only in the user interface.  
* Protected application routes and APIs.  
* Secure session management.  
* Account activation and deactivation.  
* Input validation and protection against unauthorized data access.  
* Audit history for important actions such as marks changes, attendance corrections, invoice generation and payment recording.  
* Parent accounts must be linked to one or more students, and the backend must restrict every Parent request to the data of those linked students only.

## **13.3 WhatsApp API**

WhatsApp API is intended for login-related use. The exact workflow has not been selected yet (for example, WhatsApp OTP verification versus login alerts). General notifications are excluded from the initial MVP.

## **13.4 Notification System**

In-app, email and general WhatsApp notifications are skipped for now.

# **14\. Reports**

## **14.1 Student Reports**

* Total student count and status-wise lists.  
* Class-wise student lists.  
* Recent admissions.

## **14.2 Attendance Reports**

* Daily attendance.  
* Monthly attendance.  
* Student-wise attendance history.  
* Class-wise attendance summary and attendance percentage.  
* Subject/period-wise attendance where applicable.

## **14.3 Academic Reports**

* Daily performance history.  
* Student remarks history.  
* Examination results.  
* Class-wise examination reports.

## **14.4 Financial Reports**

* Monthly fee collection.  
* Student-wise payment history.  
* Pending fee reports.  
* Outstanding balance reports.  
* Overdue fee reports.

# **15\. Non-Functional Requirements**

## **15.1 Security and Privacy**

Student personal data, academic records and financial information must be accessible only to authorized users. Teacher access must be restricted to assigned classes and students. Parent access must be restricted to the students linked to that parent account.

## **15.2 Performance**

Common workflows—student search, attendance entry, marks entry, invoice generation and report retrieval—should remain responsive under the expected institution workload. Expected user and record volumes are pending confirmation.

## **15.3 Reliability and Data Integrity**

* Prevent duplicate admission numbers.  
* Ensure payment totals and outstanding balances remain consistent.  
* Preserve examination and attendance history.  
* Use database transactions for multi-step financial operations.  
* Prevent unauthorized or accidental changes to finalized records.

## **15.4 Maintainability**

Use a modular architecture with clear separation between student, academic, attendance, examination, timetable and finance domains.

## **15.5 Usability**

Provide a clear, consistent interface with role-specific navigation, validation feedback and straightforward workflows.

## **15.6 Backup and Recovery**

Establish a regular database backup process and documented recovery procedure before production use.

# **16\. Out of Scope for Initial MVP**

* Multi-institution SaaS and tenant registration.  
* Independent mess/hostel operations, room allocation and accommodation tracking.  
* Meal attendance, food inventory and kitchen management.  
* General in-app, email or WhatsApp notification system.  
* Online payment gateway integration.  
* Student self-service fee portal.  
* Online fee payment by Parents (Parent fee access is view-only).  
* Native mobile applications.  
* Advanced AI-based student analytics.  
* Teacher payroll and salary processing, unless added after review.

# **17\. Proposed Development Sequence**

19. Project foundation, environments and authentication.  
20. User and role management, including Parent–student linking.  
21. Student admission and profile management.  
22. Class and subject management.  
23. Teacher profiles and assignments.  
24. Daily and period-wise attendance.  
25. Daily student performance and remarks.  
26. Examination and result management.  
27. Class and teacher timetable management.  
28. Fee configuration, invoice generation and payment records.  
29. Admin, Teacher, Student and Parent dashboards.  
30. Reports, audit history, testing and deployment.

This is a proposed sequence. The final implementation plan should account for dependencies and the chosen technology architecture.

# **18\. Open Questions and Decisions**

The following items are not fully settled. They should be reviewed before the PRD is approved.

| Area | Question to resolve |
| :---- | :---- |
| Roles and permissions | What exact permissions distinguish Super Admin from Coaching Admin? Can Coaching Admin perform all financial operations? |
| Login | Will login use username/password, phone/password, WhatsApp OTP, or another flow? Is WhatsApp intended for OTP verification or login alerts? |
| Account creation | Are teacher and student accounts created manually by Admin, automatically on admission, or through invitations? |
| Academic sessions | Should the system support academic years/sessions and retain class-wise history across sessions? |
| Student promotion | How are students promoted to the next class, repeated, transferred or marked as left? |
| Teacher assignments | Can a teacher enter formal examination marks for any assigned subject, or only specific examination assignments? |
| Teacher fee visibility | Should teachers retain access to fee details for students from previously assigned classes? |
| Attendance rules | What are the exact rules for late, leave, corrections, locking and daily versus period-wise attendance? |
| Examination reports | Are individual downloadable/printable report cards required in the MVP? |
| Fee receipts | Should every payment generate a printable/downloadable receipt? |
| Fee adjustments | Are discounts, scholarships, concessions, late fines or waivers required? |
| Fee generation | Should bulk monthly fee generation be supported for an entire class or selected students? |
| Student profile edits | Can students edit contact details, or is all profile editing Admin-only? |
| Parent accounts | How are Parent accounts created and linked to students (manually by Admin, automatically from the parent contact on admission, or by invitation)? Can one account cover siblings, and can both parents/guardians have separate accounts? |
| Parent permissions | Confirm that Parents may view their child's fee details (proposed read-only). Can Parents download invoices/receipts or edit their own contact details? |
| Scale and deployment | How many students, teachers and concurrent users are expected? Will the application be hosted online or on the institution's local network? |

# **19\. Acceptance Principles**

The MVP can be considered ready for institutional pilot use when:

* Each role can sign in and is restricted to its authorized data and actions.  
* Parents can sign in and view only the academic, attendance and fee information of their linked children.  
* Administrators can create and manage students, classes, subjects and teachers.  
* Teacher assignments support both responsibility categories across different classes.  
* Daily and period-wise attendance can be recorded and reported separately.  
* Teachers can record daily marks and remarks and review prior performance.  
* Examinations can be configured, marks entered and totals/percentages/grades calculated using configured rules.  
* Class and teacher timetables can be created and viewed.  
* Monthly combined and separate fee invoices can be generated.  
* Cash, UPI and bank-transfer payments, including partial payments, can be recorded accurately.  
* Paid, partially paid, unpaid and overdue balances are calculated correctly.  
* Dashboards show the agreed information for each role.  
* Core reports can be generated and key actions are auditable.  
* Backup and recovery procedures have been tested.

# **20\. Conclusion**

This PRD captures the current understanding of the Student Management System for a single coaching institution with mess fee charging. It establishes the initial MVP scope, user roles, principal modules and confirmed functional requirements.

This is a review draft, not a final implementation contract. The open questions should be resolved and the document version updated before database design, API specifications and development begin.