# Online Test Builder - Implementation Documentation

**Feature:** Online Test Builder for Teachers
**Status:** In Development
**Created:** January 2025
**Last Updated:** January 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Database Schema](#database-schema)
4. [API Routes](#api-routes)
5. [UI Pages Structure](#ui-pages-structure)
6. [Implementation Phases](#implementation-phases)
7. [Security Considerations](#security-considerations)
8. [Files to Create](#files-to-create)
9. [Validation Schemas](#validation-schemas)
10. [Verification Steps](#verification-steps)

---

## Overview

The Online Test Builder feature allows teachers to create interactive tests with MCQ and short-answer questions. Students can take timed tests online with automatic grading for MCQs. Teachers can manually grade short-answer questions and export/print tests for in-person use.

### Key Capabilities

- **Question Types:** Multiple Choice (MCQ) and Short Answer
- **Test Settings:** Time limits, instructions, question shuffling, pass/fail thresholds
- **Student Interface:** Timer, auto-save, question navigation
- **Automatic Grading:** MCQs are auto-graded on submission
- **Manual Grading:** Short-answer questions graded by teachers with feedback
- **Export/Print:** Print-friendly version with optional answer key

---

## Features

### Teacher Features

| Feature | Description |
|---------|-------------|
| Create Online Test | Convert an assessment to an online test with questions |
| Add MCQ Questions | Multiple choice with 2-6 options, single correct answer |
| Add Short Answer Questions | Text-based questions for manual grading |
| Set Time Limit | Optional time limit in minutes |
| Add Instructions | Test instructions shown to students |
| Shuffle Questions | Randomize question order per student |
| Set Passing Score | Optional minimum percentage to pass |
| Schedule Test | Set start and end times for availability |
| Preview Test | View test as students will see it |
| Publish/Close Test | Control test availability |
| View Attempts | See all student submissions |
| Grade Short Answers | Award marks and provide feedback |
| Export/Print | Generate printable version with answer key |

### Student Features

| Feature | Description |
|---------|-------------|
| View Available Tests | See tests assigned to their section |
| Start Test | Begin a test attempt |
| Timer Display | Countdown timer for timed tests |
| Question Navigation | Jump between questions |
| Auto-Save | Answers saved every 30 seconds |
| Submit Test | Final submission with confirmation |
| View Results | See score, correct answers, and feedback |

---

## Database Schema

### New Enums

```prisma
enum QuestionType {
  MCQ           // Multiple choice, single answer
  SHORT_ANSWER  // Text-based, manually graded
}

enum OnlineTestStatus {
  DRAFT         // Being created, not visible to students
  PUBLISHED     // Available for students to take
  CLOSED        // No longer accepting submissions
}

enum TestAttemptStatus {
  IN_PROGRESS   // Student currently taking the test
  SUBMITTED     // Student submitted, awaiting grading
  GRADED        // All questions graded
}
```

### New Models

#### OnlineTest

Links to existing Assessment model with additional online test settings.

```prisma
model OnlineTest {
  id               String           @id @default(cuid())
  assessmentId     String           @unique
  status           OnlineTestStatus @default(DRAFT)
  timeLimitMins    Int?             // Optional time limit in minutes
  instructions     String?          @db.Text
  shuffleQuestions Boolean          @default(false)
  showResults      Boolean          @default(true)
  passingScore     Float?           // Optional passing percentage
  startTime        DateTime?        // When test becomes available
  endTime          DateTime?        // When test closes
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  assessment       Assessment       @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  questions        Question[]
  attempts         TestAttempt[]

  @@index([assessmentId])
  @@index([status])
}
```

#### Question

Individual questions within a test.

```prisma
model Question {
  id            String       @id @default(cuid())
  onlineTestId  String
  type          QuestionType
  questionText  String       @db.Text
  marks         Float
  orderIndex    Int
  explanation   String?      @db.Text
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  onlineTest    OnlineTest       @relation(fields: [onlineTestId], references: [id], onDelete: Cascade)
  options       QuestionOption[]
  answers       StudentAnswer[]

  @@index([onlineTestId])
  @@index([orderIndex])
}
```

#### QuestionOption

MCQ answer options.

```prisma
model QuestionOption {
  id          String   @id @default(cuid())
  questionId  String
  optionText  String   @db.Text
  isCorrect   Boolean  @default(false)
  orderIndex  Int

  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([questionId])
}
```

#### TestAttempt

Student's test attempt record.

```prisma
model TestAttempt {
  id            String            @id @default(cuid())
  onlineTestId  String
  studentId     String
  status        TestAttemptStatus @default(IN_PROGRESS)
  startedAt     DateTime          @default(now())
  submittedAt   DateTime?
  timeTakenSecs Int?
  totalScore    Float?
  maxScore      Float?
  percentage    Float?
  isPassed      Boolean?

  onlineTest    OnlineTest     @relation(fields: [onlineTestId], references: [id], onDelete: Cascade)
  student       StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  answers       StudentAnswer[]

  @@unique([onlineTestId, studentId])
  @@index([onlineTestId])
  @@index([studentId])
  @@index([status])
}
```

#### StudentAnswer

Individual answers submitted by students.

```prisma
model StudentAnswer {
  id               String    @id @default(cuid())
  attemptId        String
  questionId       String
  answerText       String?   @db.Text
  selectedOptionId String?
  isCorrect        Boolean?
  marksAwarded     Float?
  feedback         String?
  gradedAt         DateTime?
  gradedBy         String?

  attempt          TestAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question         Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([attemptId, questionId])
  @@index([attemptId])
  @@index([questionId])
}
```

### Model Updates

Add relations to existing models:

```prisma
// Add to Assessment model
model Assessment {
  // ... existing fields ...
  onlineTest    OnlineTest?
}

// Add to StudentProfile model
model StudentProfile {
  // ... existing fields ...
  testAttempts  TestAttempt[]
}
```

---

## API Routes

### Teacher Routes

Base path: `/api/teacher/online-tests/`

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | List all online tests created by teacher |
| `/` | POST | Create new online test (linked to assessment) |
| `/[testId]` | GET | Get online test details with questions |
| `/[testId]` | PUT | Update online test settings |
| `/[testId]` | DELETE | Delete online test |
| `/[testId]/publish` | POST | Publish test (DRAFT → PUBLISHED) |
| `/[testId]/close` | POST | Close test (PUBLISHED → CLOSED) |
| `/[testId]/questions` | GET | Get all questions for a test |
| `/[testId]/questions` | POST | Add question to test |
| `/[testId]/questions/reorder` | PUT | Reorder questions |
| `/[testId]/questions/[questionId]` | GET | Get single question |
| `/[testId]/questions/[questionId]` | PUT | Update question |
| `/[testId]/questions/[questionId]` | DELETE | Delete question |
| `/[testId]/attempts` | GET | Get all student attempts |
| `/[testId]/attempts/[attemptId]` | GET | Get specific attempt with answers |
| `/[testId]/attempts/[attemptId]/grade` | PATCH | Grade short-answer questions |
| `/[testId]/export` | GET | Export test as printable HTML |

### Student Routes

Base path: `/api/student/tests/`

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | List available tests for student |
| `/[testId]` | GET | Get test info (without answers) |
| `/[testId]/start` | POST | Start test attempt |
| `/[testId]/attempt` | GET | Get current attempt with questions |
| `/[testId]/attempt/answer` | POST | Save answer (auto-save) |
| `/[testId]/attempt/submit` | POST | Submit test attempt |
| `/[testId]/result` | GET | Get test result (after submission) |

---

## UI Pages Structure

### Teacher Portal

```
src/app/(dashboard)/teacher/online-tests/
├── page.tsx                     # List all online tests
├── online-tests-content.tsx     # Client component for list
├── loading.tsx                  # Loading skeleton
├── new/
│   └── page.tsx                 # Create new online test wizard
└── [testId]/
    ├── page.tsx                 # Test builder/editor
    ├── test-builder.tsx         # Main builder component
    ├── preview/
    │   └── page.tsx             # Test preview (teacher view)
    ├── attempts/
    │   ├── page.tsx             # View all student attempts
    │   └── [attemptId]/
    │       └── page.tsx         # Grade individual attempt
    └── export/
        └── page.tsx             # Export/print view
```

### Student Portal

```
src/app/(dashboard)/student/tests/
├── page.tsx                     # List available tests
├── tests-content.tsx            # Client component for list
├── loading.tsx                  # Loading skeleton
└── [testId]/
    ├── page.tsx                 # Test info/start page
    ├── take/
    │   └── page.tsx             # Test-taking interface
    └── result/
        └── page.tsx             # View test result
```

### Shared Components

```
src/components/
├── teacher/
│   ├── question-editor-modal.tsx   # Modal for creating/editing questions
│   ├── question-list.tsx           # Draggable question list
│   └── grading-interface.tsx       # Interface for grading attempts
└── student/
    ├── test-timer.tsx              # Countdown timer component
    ├── question-display.tsx        # Display question with answer input
    └── test-navigation.tsx         # Question navigation sidebar
```

---

## Implementation Phases

### Phase 1: Database & Infrastructure

**Tasks:**
- Add new enums and models to `prisma/schema.prisma`
- Run migration: `npx prisma migrate dev --name add_online_tests`
- Create Zod validation schemas in `src/lib/validations/online-tests.ts`
- Install new shadcn components: `npx shadcn@latest add radio-group progress switch`

### Phase 2: Teacher Test Creation APIs

**Tasks:**
- Create `/api/teacher/online-tests/route.ts` (GET, POST)
- Create `/api/teacher/online-tests/[testId]/route.ts` (GET, PUT, DELETE)
- Create question management routes
- Create publish/close routes

### Phase 3: Teacher Test Builder UI

**Tasks:**
- Create online tests list page with filters
- Create test builder page with settings sidebar
- Create question editor modal (MCQ and Short Answer tabs)
- Implement drag-and-drop question reordering
- Create test preview page

### Phase 4: Student Test-Taking APIs

**Tasks:**
- Create `/api/student/tests/` routes
- Implement auto-grading for MCQ on submission
- Implement time tracking

### Phase 5: Student Test-Taking UI

**Tasks:**
- Create tests list page
- Create test-taking interface with timer
- Implement auto-save (every 30 seconds)
- Create result viewing page

### Phase 6: Grading System

**Tasks:**
- Create attempts listing for teachers
- Create grading UI for short-answer questions
- Integrate with existing AssessmentResult model

### Phase 7: Export/Print Feature

**Tasks:**
- Create export API generating printable HTML
- Create print-friendly CSS
- Add answer key toggle

---

## Security Considerations

1. **Answer Protection**
   - Never send `isCorrect` field to students before submission
   - API filters out correct answers when serving questions
   - Only return results after test is submitted

2. **Access Control**
   - Verify student belongs to the section of the assessment
   - Check test status (PUBLISHED) before allowing attempt
   - Check time window (startTime/endTime) if set
   - Prevent multiple active attempts (one per student per test)

3. **Grading Integrity**
   - Only teacher who created the test can grade
   - MCQ scores are immutable after auto-grading
   - Track who graded each short-answer question

4. **Time Management**
   - Auto-submit if timer expires (client and server validation)
   - Persist remaining time in database for refresh resilience
   - Show warnings at 5 minutes and 1 minute remaining

---

## Files to Create

### API Routes (Teacher)

- `src/app/api/teacher/online-tests/route.ts`
- `src/app/api/teacher/online-tests/[testId]/route.ts`
- `src/app/api/teacher/online-tests/[testId]/questions/route.ts`
- `src/app/api/teacher/online-tests/[testId]/questions/[questionId]/route.ts`
- `src/app/api/teacher/online-tests/[testId]/questions/reorder/route.ts`
- `src/app/api/teacher/online-tests/[testId]/publish/route.ts`
- `src/app/api/teacher/online-tests/[testId]/close/route.ts`
- `src/app/api/teacher/online-tests/[testId]/attempts/route.ts`
- `src/app/api/teacher/online-tests/[testId]/attempts/[attemptId]/route.ts`
- `src/app/api/teacher/online-tests/[testId]/attempts/[attemptId]/grade/route.ts`
- `src/app/api/teacher/online-tests/[testId]/export/route.ts`

### API Routes (Student)

- `src/app/api/student/tests/route.ts`
- `src/app/api/student/tests/[testId]/route.ts`
- `src/app/api/student/tests/[testId]/start/route.ts`
- `src/app/api/student/tests/[testId]/attempt/route.ts`
- `src/app/api/student/tests/[testId]/attempt/answer/route.ts`
- `src/app/api/student/tests/[testId]/attempt/submit/route.ts`
- `src/app/api/student/tests/[testId]/result/route.ts`

### Teacher UI Pages

- `src/app/(dashboard)/teacher/online-tests/page.tsx`
- `src/app/(dashboard)/teacher/online-tests/online-tests-content.tsx`
- `src/app/(dashboard)/teacher/online-tests/loading.tsx`
- `src/app/(dashboard)/teacher/online-tests/new/page.tsx`
- `src/app/(dashboard)/teacher/online-tests/[testId]/page.tsx`
- `src/app/(dashboard)/teacher/online-tests/[testId]/test-builder.tsx`
- `src/app/(dashboard)/teacher/online-tests/[testId]/preview/page.tsx`
- `src/app/(dashboard)/teacher/online-tests/[testId]/attempts/page.tsx`
- `src/app/(dashboard)/teacher/online-tests/[testId]/attempts/[attemptId]/page.tsx`
- `src/app/(dashboard)/teacher/online-tests/[testId]/export/page.tsx`

### Student UI Pages

- `src/app/(dashboard)/student/tests/page.tsx`
- `src/app/(dashboard)/student/tests/tests-content.tsx`
- `src/app/(dashboard)/student/tests/loading.tsx`
- `src/app/(dashboard)/student/tests/[testId]/page.tsx`
- `src/app/(dashboard)/student/tests/[testId]/take/page.tsx`
- `src/app/(dashboard)/student/tests/[testId]/result/page.tsx`

### Components

- `src/components/teacher/question-editor-modal.tsx`
- `src/components/teacher/question-list.tsx`
- `src/components/teacher/grading-interface.tsx`
- `src/components/student/test-timer.tsx`
- `src/components/student/question-display.tsx`
- `src/components/student/test-navigation.tsx`

### Validation

- `src/lib/validations/online-tests.ts`

---

## Validation Schemas

```typescript
// src/lib/validations/online-tests.ts
import { z } from "zod";

export const createOnlineTestSchema = z.object({
  assessmentId: z.string().min(1, "Assessment is required"),
  timeLimitMins: z.number().min(1).max(480).optional(),
  instructions: z.string().max(5000).optional(),
  shuffleQuestions: z.boolean().default(false),
  showResults: z.boolean().default(true),
  passingScore: z.number().min(0).max(100).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export const createMCQQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required").max(5000),
  marks: z.number().positive("Marks must be positive"),
  orderIndex: z.number().int().min(0),
  explanation: z.string().max(2000).optional(),
  options: z.array(z.object({
    optionText: z.string().min(1, "Option text is required").max(1000),
    isCorrect: z.boolean(),
    orderIndex: z.number().int().min(0),
  })).min(2, "At least 2 options required").max(6),
}).refine(
  (data) => data.options.filter(o => o.isCorrect).length === 1,
  { message: "Exactly one option must be marked as correct" }
);

export const createShortAnswerQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required").max(5000),
  marks: z.number().positive("Marks must be positive"),
  orderIndex: z.number().int().min(0),
  explanation: z.string().max(2000).optional(),
});

export const saveAnswerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().max(10000).optional(),
  selectedOptionId: z.string().optional(),
});

export const gradeAnswerSchema = z.object({
  marksAwarded: z.number().min(0),
  feedback: z.string().max(2000).optional(),
});
```

---

## Verification Steps

### 1. Database Verification

```bash
npx prisma migrate dev --name add_online_tests
npx prisma studio  # Verify tables created
```

### 2. Teacher Flow Testing

- [ ] Create a test from an assessment
- [ ] Add MCQ questions with multiple options
- [ ] Add short-answer questions
- [ ] Preview the test
- [ ] Publish the test
- [ ] Export/print the test with answer key

### 3. Student Flow Testing

- [ ] View available tests in student portal
- [ ] Start a timed test
- [ ] Answer MCQ and short-answer questions
- [ ] Verify auto-save functionality
- [ ] Submit the test
- [ ] View auto-graded MCQ results

### 4. Grading Flow Testing

- [ ] Teacher views all student attempts
- [ ] Grade short-answer questions with marks and feedback
- [ ] Student sees updated results with feedback

### 5. Integration Testing

- [ ] Verify graded tests appear in student gradebook
- [ ] Verify teacher gradebook shows online test results
- [ ] Verify correct grade calculation (A+, A, B, etc.)

---

## Related Documentation

- [Implementation Guide](../implementation.md) - Overall project implementation
- [Project Plan](../plan.md) - Business and technical plan
- [Prisma Schema](../prisma/schema.prisma) - Database schema

---

*Document Version: 1.0 | January 2025*
