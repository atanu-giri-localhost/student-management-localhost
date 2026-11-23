# Initial RBAC Matrix

**Legend:** Manage = create/update/archive within scope; View = read-only; Assigned = only assigned resources; Linked = only verified linked children; No = denied.

| Capability | Super Admin | Coaching Admin | Teacher | Student | Parent |
|---|---|---|---|---|---|
| Manage user accounts | Manage | Limited / OPEN | No | No | No |
| Manage roles/permissions | Manage | No / OPEN | No | No | No |
| Student profile | Manage | Manage | Assigned view; edit rights OPEN | Own view | Linked view |
| Parent-child links | Manage | Manage | No | No | Own links view |
| Academic sessions | Manage | Manage | Assigned view | Own session view | Linked child view |
| Classes/subjects | Manage | Manage | Assigned view | Own class view | Linked child view |
| Teacher profiles | Manage | Manage | Own view | No | No |
| Teacher assignments | Manage | Manage | Own assignments view | No | No |
| Daily attendance | Manage | Manage | Assigned mark/view | Own view | Linked view |
| Period attendance | Manage | Manage | Assigned mark/view | Own view | Linked view |
| Daily performance/remarks | Manage | Manage | Assigned create/view | Own view | Linked view |
| Examination setup | Manage | Manage | No / assigned input only | No | No |
| Examination marks | Manage | Manage | Authorized assigned marks | Own results view | Linked results view |
| Timetable | Manage | Manage | Own schedule view | Class schedule view | Linked class view |
| Fee configuration | Manage | Manage | No | No | No |
| Invoice generation | Manage | Manage | No | No | No |
| Payment recording | Manage | Manage | No | No | No |
| Fee information | Full | Full | Assigned students, read-only | No | Linked child, read-only |
| Financial reports | Full | Full | No | No | No |
| Audit log | Full | Limited / OPEN | No | No | No |

## Enforcement rules

1. Authorization is enforced in server-side service/repository paths, not only UI navigation.
2. A request must be scoped to the current authenticated user and their verified role.
3. Parent endpoints must join through `parent_students` and filter by the authenticated parent profile.
4. Teacher endpoints must filter through active teacher assignments for the relevant academic session. Historical access requires a separate approved rule.
5. Students can only access their own student profile/enrollment/results.
6. Teachers cannot generate invoices or record payments.
7. Students cannot access fee information in the initial MVP.
8. Parent fee access is read-only.
9. Admin role differences must be finalized before production.
10. Deny by default; unknown permissions and missing relationships return forbidden/not-found without leaking resource existence.
