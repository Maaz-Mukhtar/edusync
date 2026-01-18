# Assessment Workflow Restructuring Plan

## Overview
Restructure the assessments system to have a unified `/teacher/assessments` page with 3 tabs:
1. **Assessments** - Create printable tests with MCQ/short-answer questions
2. **Online Tests** - Convert assessments to online tests (shared questions)
3. **Upload Tests** - Upload PDF, images, and Word documents

---

## Key Architecture Changes

### Current → New
- **Questions**: Belong to `OnlineTest` → Belong to `Assessment`
- **OnlineTest**: Contains questions + settings → Just delivery settings (links to Assessment's questions)
- **UI**: Separate pages → Single tabbed page

---

## Phase 1: Database Schema Changes

### File: `prisma/schema.prisma`

#### 1.1 Modify Question Model
```prisma
model Question {
  id           String       @id @default(cuid())
  assessmentId String       // CHANGED: from onlineTestId
  type         QuestionType
  questionText String       @db.Text
  marks        Float
  orderIndex   Int
  explanation  String?      @db.Text
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  assessment Assessment       @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  options    QuestionOption[]
  answers    StudentAnswer[]

  @@index([assessmentId])
}
```

#### 1.2 Add Questions Relation to Assessment
```prisma
model Assessment {
  // ... existing fields ...
  questions  Question[]        // NEW
  files      AssessmentFile[]  // NEW
}
```

#### 1.3 Remove Questions from OnlineTest
```prisma
model OnlineTest {
  // ... existing fields ...
  // REMOVE: questions Question[]
  attempts   TestAttempt[]
}
```

#### 1.4 Add New AssessmentFile Model
```prisma
enum FileType {
  PDF
  IMAGE
  DOCUMENT
}

model AssessmentFile {
  id           String   @id @default(cuid())
  assessmentId String
  fileName     String
  originalName String
  fileType     FileType
  fileSize     Int
  mimeType     String
  storagePath  String
  uploadedAt   DateTime @default(now())

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)

  @@index([assessmentId])
}
```

---

## Phase 2: Data Migration

### Migration Script: `scripts/migrate-questions.ts`
```typescript
// 1. Add assessmentId to Question (nullable)
// 2. For each OnlineTest, get assessmentId and update its questions
// 3. Make assessmentId required, remove onlineTestId
```

### Steps:
1. Run `npx prisma migrate dev --name add_assessment_questions`
2. Run migration script to populate assessmentId
3. Run `npx prisma migrate dev --name finalize_questions` to remove onlineTestId

---

## Phase 3: API Route Changes

### 3.1 New Routes for Assessment Questions

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/teacher/assessments/[id]/questions` | GET | List questions |
| `/api/teacher/assessments/[id]/questions` | POST | Add question |
| `/api/teacher/assessments/[id]/questions/[qId]` | PUT | Update question |
| `/api/teacher/assessments/[id]/questions/[qId]` | DELETE | Delete question |
| `/api/teacher/assessments/[id]/questions/reorder` | POST | Reorder |

### 3.2 New Routes for File Upload

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/teacher/assessments/[id]/files` | GET | List files |
| `/api/teacher/assessments/[id]/files` | POST | Upload file |
| `/api/teacher/assessments/[id]/files/[fileId]` | GET | Download |
| `/api/teacher/assessments/[id]/files/[fileId]` | DELETE | Delete |

### 3.3 Update Student APIs
Update these files to fetch questions from `Assessment` instead of `OnlineTest`:
- `/api/student/tests/[testId]/attempt/route.ts`
- `/api/student/tests/[testId]/result/route.ts`

---

## Phase 4: UI Structure

### 4.1 New Page Structure
```
src/app/(dashboard)/teacher/assessments/
├── page.tsx                    # Server component
├── assessments-page.tsx        # Main tabbed client component
├── loading.tsx
├── components/
│   ├── tabs/
│   │   ├── assessments-tab.tsx     # Tab 1: Create/manage assessments
│   │   ├── online-tests-tab.tsx    # Tab 2: Online test settings
│   │   └── upload-tests-tab.tsx    # Tab 3: File uploads
│   ├── assessment-builder/
│   │   ├── question-editor.tsx     # Shared question editor dialog
│   │   └── question-list.tsx       # Question list display
│   └── file-upload/
│       ├── file-uploader.tsx       # Drag-and-drop upload
│       └── file-list.tsx           # Uploaded files list
└── [id]/
    ├── page.tsx                    # Grading page (keep existing)
    ├── builder/page.tsx            # Question builder
    ├── preview/page.tsx            # Print preview
    └── export/page.tsx             # Export functionality
```

### 4.2 Tab 1: Assessments
- List assessments with question count
- Create assessment → Opens builder
- Builder allows adding MCQ/short-answer questions
- Export/print functionality
- Grade button (opens existing grading page)

### 4.3 Tab 2: Online Tests
- Shows assessments that have questions
- "Make Online" button adds delivery settings:
  - Time limit
  - Shuffle questions
  - Show results
  - Passing score
  - Start/end time
- Publish/close/view attempts

### 4.4 Tab 3: Upload Tests
- Select assessment from dropdown
- Drag-and-drop file upload area
- Accepts: PDF, JPG, PNG, DOC, DOCX (max 10MB)
- List uploaded files with download/delete

---

## Phase 5: File Storage

### Storage Location
- Path: `/uploads/assessments/{assessmentId}/{filename}`
- Served via API route (not public)

### File Limits
- Max size: 10MB
- Allowed types: PDF, JPG, PNG, DOC, DOCX

---

## Implementation Order

### Week 1: Database
1. Update schema (add assessmentId to Question, add AssessmentFile)
2. Create migration
3. Run data migration script
4. Finalize schema (remove onlineTestId)

### Week 2: APIs
1. Create `/api/teacher/assessments/[id]/questions` routes
2. Create `/api/teacher/assessments/[id]/files` routes
3. Update student APIs to use new question location
4. Update online-tests API (remove question handling)

### Week 3: UI
1. Create tabbed page structure
2. Implement Assessments tab with question builder
3. Implement Online Tests tab (simplified)
4. Implement Upload Tests tab

### Week 4: Polish
1. Update existing pages (online-tests routes redirect/remove)
2. Test all flows end-to-end
3. Ensure export/print works
4. Clean up old code

---

## Files to Modify

### Schema & Data
- `prisma/schema.prisma` - Schema changes
- `scripts/migrate-questions.ts` - Migration script (new)

### API Routes (New)
- `src/app/api/teacher/assessments/[id]/questions/route.ts`
- `src/app/api/teacher/assessments/[id]/questions/[questionId]/route.ts`
- `src/app/api/teacher/assessments/[id]/questions/reorder/route.ts`
- `src/app/api/teacher/assessments/[id]/files/route.ts`
- `src/app/api/teacher/assessments/[id]/files/[fileId]/route.ts`

### API Routes (Modify)
- `src/app/api/student/tests/[testId]/attempt/route.ts` - Fetch from Assessment
- `src/app/api/student/tests/[testId]/result/route.ts` - Fetch from Assessment
- `src/app/api/teacher/online-tests/route.ts` - Remove question creation
- `src/app/api/teacher/online-tests/[testId]/questions/*` - Remove or redirect

### UI (New/Modify)
- `src/app/(dashboard)/teacher/assessments/assessments-page.tsx` - New tabbed component
- `src/app/(dashboard)/teacher/assessments/components/tabs/*.tsx` - Tab components
- `src/app/(dashboard)/teacher/assessments/components/assessment-builder/*.tsx` - Builder components
- `src/app/(dashboard)/teacher/assessments/[id]/builder/page.tsx` - Question builder page
- `src/lib/data/teacher.ts` - Update data fetching functions

### UI (Remove/Deprecate)
- `src/app/(dashboard)/teacher/online-tests/` - Most functionality moves to assessments

### Sidebar
- `src/components/layout/sidebar.tsx` - Remove "Online Tests" link from teacher nav

---

## Verification Steps

1. **Schema**: Run `npx prisma migrate dev` - verify tables created
2. **Migration**: Check existing questions have assessmentId populated
3. **Teacher Flow**:
   - Create assessment with questions
   - Export/print assessment
   - Convert to online test
   - Publish and view attempts
4. **Student Flow**: Take online test - verify questions load correctly
5. **Upload Flow**: Upload PDF → verify stored and downloadable
6. **Grading**: Record grades for assessment with questions
