# EduSync MVP Features & Demo Data
## Decision Document for Next Week's Presentation

---

# Demo Data Structure

## Schools Overview

| School | Subdomain | Students | Teachers | Classes |
|--------|-----------|----------|----------|---------|
| City Grammar School | citygrammar.edusync.pk | 360 | 10 | Grades 1-12 |
| Bright Future Academy | brightfuture.edusync.pk | 360 | 10 | Grades 1-12 |

**Total per school:**
- 12 grades × 3 sections × 10 students = **360 students**
- 10 teachers (some teaching multiple grades/sections)

---

## Detailed Data Breakdown

### Classes & Sections
```
Grade 1:  Section A (10), Section B (10), Section C (10) = 30 students
Grade 2:  Section A (10), Section B (10), Section C (10) = 30 students
...
Grade 12: Section A (10), Section B (10), Section C (10) = 30 students

Total: 12 grades × 3 sections × 10 students = 360 students per school
```

### Subjects (3 per grade, 5 topics each)

| Grade Range | Subjects | Topics per Subject |
|-------------|----------|-------------------|
| **Grades 1-5** | English, Mathematics, Urdu | 5 each |
| **Grades 6-8** | English, Mathematics, Science | 5 each |
| **Grades 9-10** | English, Mathematics, Physics | 5 each |
| **Grades 11-12** | English, Mathematics, Physics | 5 each |

**Sample Topics (Mathematics - Grade 7):**
1. Integers & Operations
2. Fractions & Decimals
3. Algebra Basics
4. Geometry Fundamentals
5. Data Handling

### Teachers (10 per school)

| Teacher | Subjects | Grades Assigned |
|---------|----------|-----------------|
| Teacher 1 | English | Grades 1-3 |
| Teacher 2 | English | Grades 4-6 |
| Teacher 3 | English | Grades 7-9 |
| Teacher 4 | English | Grades 10-12 |
| Teacher 5 | Mathematics | Grades 1-4 |
| Teacher 6 | Mathematics | Grades 5-8 |
| Teacher 7 | Mathematics | Grades 9-12 |
| Teacher 8 | Urdu/Science | Grades 1-5 (Urdu), 6-8 (Science) |
| Teacher 9 | Science/Physics | Grades 6-8 (Science), 9-10 (Physics) |
| Teacher 10 | Physics | Grades 11-12 |

### Assessments

| Type | Frequency | Per Subject/Term |
|------|-----------|------------------|
| Monthly Tests | Monthly | 1 per month (Oct, Nov, Dec, Jan) = 4 |
| Termly Exams | Per term | 1 mid-term, 1 final = 2 |
| Monthly Assignments | Monthly | 1 per month = 4 |

**Per Subject Per Term:** 4 tests + 2 exams + 4 assignments = 10 assessments

### Fee Structure

| Fee Type | Amount | Frequency |
|----------|--------|-----------|
| Monthly Tuition | Rs. 5,000 | Monthly |
| Annual Registration | Rs. 10,000 | Annual |
| Examination Fee | Rs. 2,000 | Per term |

### Academic Year

```
Academic Year: 2024-2025
├── Term 1: Aug 1 - Nov 30, 2024
│   ├── Monthly Tests: Sep, Oct, Nov
│   └── Mid-term Exam: Oct 15-20
├── Term 2: Dec 1 - Mar 31, 2025  
│   ├── Monthly Tests: Dec, Jan, Feb, Mar
│   └── Final Exam: Mar 15-25
└── Term 3: Apr 1 - Jul 31, 2025
```

---

# MVP Feature Decisions

## Priority Legend
- **P0** = Must have for demo (build first)
- **P1** = Should have for demo (build if time permits)
- **P2** = Nice to have (post-demo)

---

## Admin Portal Features

### P0 - Must Have for Demo ✅

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **Dashboard** | Key metrics (total students, attendance %, fee collection, teachers) | Shows platform value at a glance |
| **User Management** | List, add, edit, delete users (students, teachers, parents) | Core admin function |
| **Bulk Import** | CSV upload for students with parent creation | Shows scalability |
| **Parent Linking** | Link parents to students (1 or 2 parents per student) | Essential relationship |
| **Class/Section Management** | Create classes, sections, assign capacity | Foundation for everything |
| **Subject Management** | Create subjects, assign to classes | Required for assessments |
| **Academic Year Config** | Set terms, dates, current year | Time-based features depend on this |
| **Fee Structure** | Define fee types, amounts, due dates | Key selling point |
| **Fee Invoices** | Generate and view invoices per student | Revenue tracking |
| **Announcements** | Create school-wide or class-specific announcements | Communication feature |

### P1 - Should Have ⚡

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **Timetable Management** | Create weekly schedules per section | Useful but complex |
| **Action/Audit Logs** | Track who did what when | Security/accountability |
| **Analytics Dashboard** | Charts for attendance trends, fee collection | Visual appeal |
| **Report Cards** | Generate PDF report cards | Parents love this |

### P2 - Post-Demo 📋

| Feature | Description |
|---------|-------------|
| Custom role permissions | Fine-grained access control |
| School settings/branding | Logo, colors, custom subdomain |
| Export data to Excel | Bulk data export |
| Staff management (non-teaching) | Administrative staff |

---

## Teacher Portal Features

### P0 - Must Have for Demo ✅

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **Dashboard** | Today's schedule, pending tasks, class stats | Quick overview |
| **Attendance Marking** | Mark present/absent/late for a class | Most used daily feature |
| **Attendance History** | View past attendance by date/class | Track patterns |
| **Gradebook** | View and manage grades per subject/class | Core academic function |
| **Assessment Creation** | Create tests/quizzes/assignments with topics | Foundation for AI insights |
| **Enter Results** | Input marks per student per assessment | Feed into analytics |
| **Announcements** | Post to own classes or parents | Communication |

### P1 - Should Have ⚡

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **Class Analytics** | AI-powered insights on class performance | Differentiator! |
| **Generate Reports** | Create student progress reports | Parent meeting prep |
| **Message Parents** | Direct messaging to individual parents | Communication |
| **Topic Tagging** | Tag assessment questions with topics | Enables AI insights |

### P2 - Post-Demo 📋

| Feature | Description |
|---------|-------------|
| Assignment submission portal | Students upload work |
| Quiz builder with MCQs | Auto-grading |
| Resource sharing | Upload materials for students |

---

## Student Portal Features

### P0 - Must Have for Demo ✅

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **Dashboard** | Today's classes, recent grades, announcements | Student entry point |
| **Timetable View** | Weekly schedule with times, rooms, teachers | Daily reference |
| **Attendance History** | View own attendance with percentage | Self-awareness |
| **Grades & Results** | View all assessments, scores, subject averages | Track progress |
| **Announcements** | View school and class announcements | Stay informed |

### P1 - Should Have ⚡

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **AI Study Insights** | Weak topics identification, suggestions | Key differentiator! |
| **Practice Questions** | AI-generated questions on weak areas | Unique feature |
| **Upcoming Events** | Calendar of tests, assignments, holidays | Planning |

### P2 - Post-Demo 📋

| Feature | Description |
|---------|-------------|
| Assignment submission | Upload homework |
| Resource downloads | Access teacher materials |
| Discussion forums | Class discussions |

---

## Parent Portal Features

### P0 - Must Have for Demo ✅

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **Dashboard** | Child overview with key stats | Quick snapshot |
| **Child Switcher** | Switch between multiple children | Multi-child families |
| **Attendance View** | See child's attendance record | Top requested feature |
| **Grades View** | All academic results and averages | Track performance |
| **Fee Status** | View pending fees, payment history | Financial clarity |
| **Announcements** | School and class announcements | Stay informed |

### P1 - Should Have ⚡

| Feature | Description | Demo Value |
|---------|-------------|------------|
| **Online Payment** | Pay fees via JazzCash/Easypaisa | Convenience selling point |
| **AI Child Insights** | Understand child's strengths/weaknesses | Differentiator |
| **Message Teacher** | Direct communication channel | Parent engagement |
| **Report Card Download** | PDF report cards | Official records |

### P2 - Post-Demo 📋

| Feature | Description |
|---------|-------------|
| Trip/event approvals | Digital consent forms |
| PTM scheduling | Book meeting slots |
| Transport tracking | Bus location (future) |

---

# Feature Summary Matrix

| Portal | P0 (Must Have) | P1 (Should Have) | Total for Demo |
|--------|---------------|------------------|----------------|
| **Admin** | 10 features | 4 features | 14 |
| **Teacher** | 7 features | 4 features | 11 |
| **Student** | 5 features | 3 features | 8 |
| **Parent** | 6 features | 4 features | 10 |
| **Total** | **28 features** | **15 features** | **43 features** |

---

# Demo Flow Script (15 minutes)

## 1. Admin Portal (4 mins)
```
1. Login as admin
2. Show dashboard with school stats
3. Add a new student via form
4. Demo bulk import (CSV with 10 students)
5. Create parent link
6. Show fee structure and generate invoice
7. Create an announcement
```

## 2. Teacher Portal (5 mins)
```
1. Login as teacher (Ms. Ayesha - Math)
2. Show dashboard with today's schedule
3. Mark attendance for Grade 7-A (30 seconds demo)
4. Navigate to gradebook
5. Create a monthly test with topics tagged
6. Enter results for 5 students
7. [P1] Show class analytics - "3 students struggling with Fractions"
```

## 3. Parent Portal (3 mins)
```
1. Login as parent (with 2 children)
2. Show child switcher
3. View attendance record
4. View grades and results
5. Show fee status (pending invoice)
6. [P1] Show AI insight about child
7. [P1] Demo payment flow (mock)
```

## 4. Student Portal (3 mins)
```
1. Login as student (Ahmed - Grade 7)
2. Show timetable for the week
3. View attendance percentage
4. View grades by subject
5. [P1] Show AI insights - "You're weak in Fractions"
6. [P1] Generate practice questions
```

---

# Sample Demo Data (Names)

## Students (Pakistani Names)
```
Boys: Ahmed, Hassan, Ali, Bilal, Usman, Hamza, Zain, Omar, Saad, Ibrahim
Girls: Fatima, Ayesha, Zara, Maryam, Hira, Sana, Amina, Noor, Sara, Laiba
```

## Teachers
```
1. Ms. Ayesha Malik (English)
2. Mr. Ahmed Khan (English)
3. Ms. Fatima Zahra (English)
4. Mr. Usman Ali (English)
5. Mr. Hassan Raza (Mathematics)
6. Ms. Sana Mirza (Mathematics)
7. Mr. Bilal Ahmed (Mathematics)
8. Ms. Hira Noor (Urdu/Science)
9. Mr. Zain Abbas (Science/Physics)
10. Ms. Maryam Shah (Physics)
```

## Parents
```
Mr. & Mrs. Khan, Mr. & Mrs. Ahmed, Mr. & Mrs. Malik, etc.
(Each student has 1-2 linked parents)
```

---

# Database Seed Script Requirements

```javascript
// Seed data counts
const SCHOOLS = 2;
const GRADES = 12;
const SECTIONS_PER_GRADE = 3;
const STUDENTS_PER_SECTION = 10;
const TEACHERS = 10;
const SUBJECTS_PER_GRADE = 3;
const TOPICS_PER_SUBJECT = 5;

// Total records
const totalStudents = SCHOOLS * GRADES * SECTIONS_PER_GRADE * STUDENTS_PER_SECTION;
// = 2 * 12 * 3 * 10 = 720 students

const totalSections = SCHOOLS * GRADES * SECTIONS_PER_GRADE;
// = 2 * 12 * 3 = 72 sections

const totalSubjects = SCHOOLS * GRADES * SUBJECTS_PER_GRADE;
// = 2 * 12 * 3 = 72 subjects (with overlap)

const totalParents = totalStudents * 1.5; // Some share, some have 2
// ≈ 1080 parent accounts

const totalAssessments = SCHOOLS * GRADES * SUBJECTS_PER_GRADE * 10;
// = 2 * 12 * 3 * 10 = 720 assessments
```

---

# Decisions Needed

## 1. AI Features in Demo?
**Recommendation:** YES - Include as P1. It's your key differentiator.
- Student insights (weak/strong topics)
- Practice questions
- Teacher class analytics

## 2. Online Payment in Demo?
**Recommendation:** MOCK only - Show the flow but don't integrate real gateway yet.
- Display JazzCash/Easypaisa options
- Show "Payment Successful" mock screen

## 3. Which School to Demo Live?
**Recommendation:** Use "City Grammar School" as primary demo
- Pre-populate with realistic attendance data (mix of present/absent)
- Pre-generate some AI insights
- Have some overdue fee invoices

## 4. Cut from MVP Demo?

| Feature | Reason to Cut |
|---------|---------------|
| Report card PDF generation | Complex formatting |
| Timetable management | Time-consuming to build |
| Full audit logs | Low demo impact |
| SMS notifications | Requires gateway integration |
| Assignment submission | Complex file handling |

---

# Next Steps

1. **Finalize this feature list** - Confirm P0 vs P1 cuts
2. **Create database seed script** - Generate all demo data
3. **Build in priority order:**
   - Week 1: Auth + Admin (User, Class, Fee management)
   - Week 2: Teacher (Attendance, Gradebook, Assessments)
   - Week 3: Student + Parent portals
   - Week 4: AI features + Polish
4. **Prepare demo script** - Practice the 15-min flow
5. **Create backup** - Static screenshots if live demo fails

---

*Document Version: 1.0 | January 2025*
