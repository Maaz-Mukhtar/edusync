# EduSync - Implementation Guide

Quick reference for technical implementation details.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 14 | Framework (App Router, SSR) |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| React Query | Data fetching & caching |
| Zustand | State management |
| Recharts | Charts & visualizations |

### Backend
| Technology | Purpose |
|------------|---------|
| Next.js API Routes | API endpoints |
| Prisma | ORM |
| PostgreSQL | Database |
| Supabase | Database hosting, Storage, Realtime |
| NextAuth.js | Authentication (with Supabase adapter) |

### External Services
| Service | Purpose |
|---------|---------|
| Claude API | AI features |
| JazzCash/Easypaisa | Payments |
| SMS Gateway | Notifications |
| Resend | Email |

### Deployment
| Service | Purpose |
|---------|---------|
| Vercel | Hosting |
| Supabase | Database hosting |
| GitHub Actions | CI/CD |

---

## Project Structure

```
edusync/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/
│   │   ├── student/
│   │   ├── parent/
│   │   ├── teacher/
│   │   └── admin/
│   ├── api/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── attendance/
│   │   ├── grades/
│   │   └── ai/
│   └── layout.tsx
├── components/
│   ├── ui/          # shadcn components
│   ├── layout/      # sidebar, header
│   ├── dashboard/   # dashboard components
│   └── forms/       # form components
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── ai.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma
└── types/
```

---

## Multi-Tenancy Architecture

### Approach: Row-Level Security with school_id

Every table has: `school_id` (FK to schools table)

**URL Structure (Subdomain-based):**
```
https://cityschool.edusync.pk    → school_id: 1
https://beaconhouse.edusync.pk   → school_id: 2
```

**Local Development:**
```
http://cityschool.localhost:3000
http://beaconhouse.localhost:3000
```

---

## Database Schema

### Enums

```prisma
enum UserRole {
  SUPER_ADMIN
  ADMIN
  TEACHER
  STUDENT
  PARENT
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

enum AssessmentType {
  TEST
  QUIZ
  ASSIGNMENT
  EXAM
}

enum FeeFrequency {
  MONTHLY
  QUARTERLY
  ANNUAL
  ONE_TIME
}

enum InvoiceStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}
```

### Core Models

```prisma
model School {
  id          String   @id @default(cuid())
  name        String
  subdomain   String   @unique
  address     String?
  phone       String?
  email       String?
  logo        String?
  settings    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users         User[]
  classes       Class[]
  subjects      Subject[]
  feeStructures FeeStructure[]
  announcements Announcement[]
  academicYears AcademicYear[]
}

model User {
  id            String    @id @default(cuid())
  schoolId      String
  email         String?
  phone         String?
  passwordHash  String?
  role          UserRole
  firstName     String
  lastName      String
  avatar        String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  school          School           @relation(fields: [schoolId], references: [id])
  studentProfile  StudentProfile?
  teacherProfile  TeacherProfile?
  parentProfile   ParentProfile?

  @@unique([schoolId, email])
  @@unique([schoolId, phone])
  @@index([schoolId])
}

model StudentProfile {
  id vishe           String   @id @default(cuid())
  userId        String   @unique
  sectionId     String
  rollNumber    String?
  dateOfBirth   DateTime?
  admissionDate DateTime?
  bloodGroup    String?
  address       String?

  user        User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  section     Section            @relation(fields: [sectionId], references: [id])
  parents     ParentStudent[]
  attendances Attendance[]
  results     AssessmentResult[]
  feeInvoices FeeInvoice[]
  insights    StudentInsight[]

  @@index([sectionId])
}

model TeacherProfile {
  id           String   @id @default(cuid())
  userId       String   @unique
  employeeId   String?
  qualification String?
  joinDate     DateTime?
  specialization String?

  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  sections         SectionTeacher[]
  subjectsTaught   TeacherSubject[]
  attendancesTaken Attendance[]
  assessments      Assessment[]
}

model ParentProfile {
  id           String  @id @default(cuid())
  userId       String  @unique
  occupation   String?
  relationship String? // father, mother, guardian

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  children ParentStudent[]
}

model ParentStudent {
  id        String @id @default(cuid())
  parentId  String
  studentId String

  parent  ParentProfile  @relation(fields: [parentId], references: [id], onDelete: Cascade)
  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([parentId, studentId])
}

model AcademicYear {
  id        String   @id @default(cuid())
  schoolId  String
  name      String   // "2024-2025"
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)

  school  School @relation(fields: [schoolId], references: [id])
  terms   Term[]

  @@index([schoolId])
}

model Term {
  id             String   @id @default(cuid())
  academicYearId String
  name           String   // "Term 1", "Mid-Term"
  startDate      DateTime
  endDate        DateTime

  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])
  assessments  Assessment[]
}

model Class {
  id          String @id @default(cuid())
  schoolId    String
  name        String // "Grade 7", "Class 10"
  displayOrder Int   @default(0)

  school        School         @relation(fields: [schoolId], references: [id])
  sections      Section[]
  feeStructures FeeStructure[]

  @@unique([schoolId, name])
  @@index([schoolId])
}

model Section {
  id       String @id @default(cuid())
  classId  String
  name     String // "A", "B", "Blue"
  capacity Int?

  class       Class            @relation(fields: [classId], references: [id])
  students    StudentProfile[]
  teachers    SectionTeacher[]
  timetable   TimetableSlot[]
  attendances Attendance[]
  assessments Assessment[]

  @@unique([classId, name])
  @@index([classId])
}

model Subject {
  id       String @id @default(cuid())
  schoolId String
  name     String
  code     String?
  color    String? // For UI display

  school      School           @relation(fields: [schoolId], references: [id])
  teachers    TeacherSubject[]
  timetable   TimetableSlot[]
  assessments Assessment[]

  @@unique([schoolId, name])
  @@index([schoolId])
}

model SectionTeacher {
  id         String  @id @default(cuid())
  sectionId  String
  teacherId  String
  isClassTeacher Boolean @default(false)

  section Section        @relation(fields: [sectionId], references: [id])
  teacher TeacherProfile @relation(fields: [teacherId], references: [id])

  @@unique([sectionId, teacherId])
}

model TeacherSubject {
  id        String @id @default(cuid())
  teacherId String
  subjectId String

  teacher TeacherProfile @relation(fields: [teacherId], references: [id])
  subject Subject        @relation(fields: [subjectId], references: [id])

  @@unique([teacherId, subjectId])
}

model TimetableSlot {
  id        String @id @default(cuid())
  sectionId String
  subjectId String
  teacherId String?
  dayOfWeek Int    // 0-6 (Sunday-Saturday)
  startTime String // "08:00"
  endTime   String // "08:45"
  room      String?

  section Section @relation(fields: [sectionId], references: [id])
  subject Subject @relation(fields: [subjectId], references: [id])

  @@index([sectionId])
}

model Attendance {
  id        String           @id @default(cuid())
  studentId String
  sectionId String
  date      DateTime         @db.Date
  status    AttendanceStatus
  remarks   String?
  markedBy  String?          // TeacherProfile id
  markedAt  DateTime         @default(now())

  student  StudentProfile  @relation(fields: [studentId], references: [id])
  section  Section         @relation(fields: [sectionId], references: [id])
  teacher  TeacherProfile? @relation(fields: [markedBy], references: [id])

  @@unique([studentId, date])
  @@index([sectionId, date])
}

model Assessment {
  id          String         @id @default(cuid())
  sectionId   String
  subjectId   String
  termId      String?
  createdById String
  title       String
  type        AssessmentType
  totalMarks  Float
  date        DateTime
  topics      String[]       // For AI analysis
  description String?
  createdAt   DateTime       @default(now())

  section   Section            @relation(fields: [sectionId], references: [id])
  subject   Subject            @relation(fields: [subjectId], references: [id])
  term      Term?              @relation(fields: [termId], references: [id])
  createdBy TeacherProfile     @relation(fields: [createdById], references: [id])
  results   AssessmentResult[]

  @@index([sectionId])
  @@index([subjectId])
}

model AssessmentResult {
  id            String  @id @default(cuid())
  assessmentId  String
  studentId     String
  marksObtained Float
  grade         String?
  remarks       String?
  topicScores   Json?   // {"algebra": 8, "geometry": 5}

  assessment Assessment     @relation(fields: [assessmentId], references: [id])
  student    StudentProfile @relation(fields: [studentId], references: [id])

  @@unique([assessmentId, studentId])
  @@index([studentId])
}

model FeeStructure {
  id        String       @id @default(cuid())
  schoolId  String
  classId   String?
  name      String       // "Monthly Tuition", "Annual Registration"
  amount    Float
  frequency FeeFrequency
  dueDay    Int?         // Day of month for recurring fees

  school   School       @relation(fields: [schoolId], references: [id])
  class    Class?       @relation(fields: [classId], references: [id])
  invoices FeeInvoice[]

  @@index([schoolId])
}

model FeeInvoice {
  id             String        @id @default(cuid())
  studentId      String
  feeStructureId String
  amount         Float
  dueDate        DateTime
  paidDate       DateTime?
  status         InvoiceStatus @default(PENDING)
  paymentMethod  String?
  transactionId  String?
  remarks        String?
  createdAt      DateTime      @default(now())

  student      StudentProfile @relation(fields: [studentId], references: [id])
  feeStructure FeeStructure   @relation(fields: [feeStructureId], references: [id])

  @@index([studentId])
  @@index([status])
}

model Announcement {
  id        String   @id @default(cuid())
  schoolId  String
  title     String
  content   String
  audience  String[] // ["all", "teachers", "parents", "students", "class:7", "section:7-A"]
  priority  String   @default("normal") // "low", "normal", "high", "urgent"
  publishAt DateTime @default(now())
  expiresAt DateTime?
  createdBy String
  createdAt DateTime @default(now())

  school School @relation(fields: [schoolId], references: [id])

  @@index([schoolId])
}

model StudentInsight {
  id           String   @id @default(cuid())
  studentId    String
  subjectId    String
  weakTopics   String[]
  strongTopics String[]
  trend        String   // "improving", "stable", "declining"
  percentile   Float?
  aiSummary    String?
  generatedAt  DateTime @default(now())

  student StudentProfile @relation(fields: [studentId], references: [id])

  @@index([studentId])
}
```

---

## Development Sprints

### Sprint 1: Foundation (Week 1-2)

#### Week 1
- [ ] Project setup (Next.js, Prisma, Supabase)
- [ ] Database schema implementation
- [ ] Authentication system (NextAuth.js + Supabase)
- [ ] Role-based middleware

#### Week 2
- [ ] Multi-tenant architecture (subdomain routing)
- [ ] Dashboard layout components
- [ ] Navigation components (sidebar, header)
- [ ] Seed data script

**Deliverables:**
- Working login for all roles
- Multi-tenant isolation
- Base UI framework

---

### Sprint 2: Admin Portal (Week 3-4)

#### Week 3
- [ ] User management (CRUD for all roles)
- [ ] Link parents to students
- [ ] Class/section management
- [ ] Subject management

#### Week 4
- [ ] Fee structure configuration
- [ ] Invoice generation
- [ ] CSV bulk import
- [ ] Admin dashboard with stats

**Deliverables:**
- Complete admin functionality
- Fee management
- Bulk operations

---

### Sprint 3: Teacher Portal (Week 5-6)

#### Week 5
- [ ] Teacher dashboard
- [ ] Attendance marking interface
- [ ] View historical attendance
- [ ] Gradebook interface

#### Week 6
- [ ] Assessment creation
- [ ] Results entry with topic tagging
- [ ] Announcement system
- [ ] Basic messaging

**Deliverables:**
- Attendance system
- Gradebook
- Assessment management

---

### Sprint 4: Student & Parent Portals (Week 7-8)

#### Week 7
- [ ] Student dashboard
- [ ] Timetable view
- [ ] Attendance history view
- [ ] Grades/results view

#### Week 8
- [ ] Parent dashboard
- [ ] Multi-child support (child switcher)
- [ ] Fee viewing & payment history
- [ ] Event/trip approvals

**Deliverables:**
- Complete student portal
- Complete parent portal

---

### Sprint 5: AI Features & Polish (Week 9)

- [ ] Claude API integration
- [ ] Student insights generation
- [ ] Practice question generation
- [ ] Teacher class analytics
- [ ] UI polish & bug fixes

**Deliverables:**
- AI features working
- Polished UI

---

### Sprint 6: Demo Prep (Week 10)

- [ ] Demo data creation (realistic school data)
- [ ] End-to-end testing
- [ ] Landing page
- [ ] Demo script preparation

**Deliverables:**
- Demo-ready product

---

## MVP Feature Checklist

### Must Have (P0)
- [ ] Authentication (email, phone)
- [ ] Role-based access (Admin, Teacher, Student, Parent)
- [ ] Multi-tenant (subdomain-based)
- [ ] User management (CRUD)
- [ ] Class/section management
- [ ] Subject management
- [ ] Attendance marking
- [ ] Gradebook
- [ ] Assessment creation & results
- [ ] Fee structure & invoices
- [ ] Student dashboard
- [ ] Parent dashboard (with multi-child)
- [ ] Announcements

### Should Have (P1)
- [ ] AI student insights
- [ ] AI practice questions
- [ ] Messaging system
- [ ] Bulk CSV import
- [ ] Timetable management

---

## Setup Commands

```bash
# Create project
npx create-next-app@latest edusync --typescript --tailwind --eslint --app

cd edusync

# Install core dependencies
npm install prisma @prisma/client
npm install next-auth @auth/prisma-adapter
npm install @supabase/supabase-js

# Install form & validation
npm install zod react-hook-form @hookform/resolvers

# Install data fetching & state
npm install @tanstack/react-query zustand

# Install UI dependencies
npm install recharts lucide-react date-fns clsx tailwind-merge
npm install class-variance-authority

# Initialize Prisma
npx prisma init

# Initialize shadcn/ui
npx shadcn@latest init
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[project].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon-key]"
SUPABASE_SERVICE_ROLE_KEY="[service-role-key]"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[generate-with-openssl-rand-base64-32]"

# AI
ANTHROPIC_API_KEY="sk-ant-xxx"

# Email (Resend)
RESEND_API_KEY="re_xxx"

# SMS Gateway (configure based on provider)
SMS_API_KEY="xxx"
SMS_SENDER_ID="EduSync"
```

---

## Portal Access by Role

| Feature | Admin | Teacher | Student | Parent |
|---------|-------|---------|---------|--------|
| User Management | Full | View own students | - | - |
| Class Management | Full | View assigned | - | - |
| Attendance | Reports | Mark & View | View own | View child |
| Grades | Reports | Full | View own | View child |
| Assessments | Reports | Full | View own | View child |
| Fee Management | Full | - | View own | View & Pay |
| Announcements | Create | Create | View | View |
| AI Insights | School-wide | Class-level | Personal | Child's |

---

## API Routes Structure

```
/api/auth/[...nextauth]     # Authentication
/api/users                  # User CRUD
/api/classes                # Class management
/api/sections               # Section management
/api/subjects               # Subject management
/api/attendance             # Attendance operations
/api/assessments            # Assessment CRUD
/api/results                # Assessment results
/api/fees                   # Fee structures
/api/invoices               # Fee invoices
/api/announcements          # Announcements
/api/ai/insights            # Generate student insights
/api/ai/practice            # Generate practice questions
```

---

*Last Updated: January 2025*
