# Plan: Academic Year Management & Student Promotion

**Status: IMPLEMENTED**

## Current State

The schema already has a basic `AcademicYear` model:
```prisma
model AcademicYear {
  id        String   @id @default(cuid())
  schoolId  String
  name      String      // e.g., "2024-2025"
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)

  terms  Term[]
}
```

**What's Missing:**
- No admin UI to create/edit academic years
- No connection between students and academic years
- No promotion logic

---

## Key Design Decisions Needed

### 1. How to Track Student-Year Relationship?

**Option A: Add academicYearId to StudentProfile**
```prisma
model StudentProfile {
  academicYearId String  // Current academic year
  sectionId      String  // Current section
}
```
- Simple
- Loses historical data (can't see "John was in Grade 5-A in 2023-24")

**Option B: Create StudentEnrollment Table (Recommended)**
```prisma
model StudentEnrollment {
  id             String @id
  studentId      String
  academicYearId String
  sectionId      String
  rollNumber     String?
  status         EnrollmentStatus  // ACTIVE, PROMOTED, GRADUATED, LEFT
  promotedFrom   String?  // Previous enrollment ID
}
```
- Preserves complete history
- Can query "show me all Grade 5 students from 2023-24"
- More complex but more powerful

**Question: Do you want to preserve historical enrollment data?**

---

### 2. What Happens During Promotion?

**Scenario:** Academic year 2024-25 ends, 2025-26 begins

| Current Class | Promoted To | Notes |
|---------------|-------------|-------|
| Grade 1 | Grade 2 | Normal promotion |
| Grade 2 | Grade 3 | Normal promotion |
| ... | ... | ... |
| Grade 12 | N/A | Graduated |

**Questions:**
1. **Section Mapping:** Should Grade 1-A students go to Grade 2-A, or be redistributed?
2. **Failed Students:** How to handle? Options:
   - Admin manually moves them
   - Mark as "retained" and keep in same grade
3. **Graduating Students:** Mark as graduated or deactivate?
4. **New Students:** Added separately after promotion

---

### 3. When Does Promotion Happen?

**Option A: Automatic on Academic Year Start**
- System checks if new year's start date has passed
- Automatically promotes all students

**Option B: Manual Trigger by Admin (Recommended)**
- Admin clicks "Start New Academic Year"
- Shows preview of promotions
- Admin confirms and executes
- More control, less risk of accidents

**Option C: Scheduled Job**
- Runs on academic year start date
- Fully automated

**Question: Which approach do you prefer?**

---

### 4. Historical Data Linking

Currently, data is linked directly to students/sections:
- Attendance → StudentProfile + Section
- Grades → StudentProfile + Assessment
- Fees → StudentProfile

**Problem:** If a student moves to a new section in a new year, their old data is still linked to the old section but no year context.

**Options:**
1. **Keep as-is** - Data is already dated, can filter by date
2. **Add academicYearId** to Attendance, Assessment, FeeInvoice
3. **Use enrollment** - Link to StudentEnrollment instead of StudentProfile

For simplicity, Option 1 (keep as-is) should work since dates naturally scope the data.

---

## Proposed Implementation

### Phase 1: Academic Year CRUD

1. **Admin UI:** `/admin/academic-years`
   - List all academic years
   - Create new academic year (name, start date, end date)
   - Edit existing academic year
   - Set current academic year
   - Delete (only if no data linked)

2. **API Endpoints:**
   - `GET /api/academic-years` - List all
   - `POST /api/academic-years` - Create
   - `PUT /api/academic-years/[id]` - Update
   - `DELETE /api/academic-years/[id]` - Delete
   - `POST /api/academic-years/[id]/set-current` - Set as current

### Phase 2: Student Enrollment (if Option B chosen)

1. **Schema Changes:**
```prisma
enum EnrollmentStatus {
  ACTIVE
  PROMOTED
  GRADUATED
  LEFT
  RETAINED
}

model StudentEnrollment {
  id             String           @id @default(cuid())
  studentId      String
  academicYearId String
  sectionId      String
  rollNumber     String?
  status         EnrollmentStatus @default(ACTIVE)
  promotedFromId String?          // Previous enrollment
  createdAt      DateTime         @default(now())

  student        StudentProfile   @relation(fields: [studentId], references: [id])
  academicYear   AcademicYear     @relation(fields: [academicYearId], references: [id])
  section        Section          @relation(fields: [sectionId], references: [id])
  promotedFrom   StudentEnrollment? @relation("PromotionChain", fields: [promotedFromId], references: [id])
  promotedTo     StudentEnrollment? @relation("PromotionChain")

  @@unique([studentId, academicYearId])
  @@index([academicYearId])
  @@index([sectionId])
}
```

2. **Modify StudentProfile:**
   - Remove direct `sectionId`
   - Add helper to get current enrollment

### Phase 3: Promotion System

1. **Admin UI:** "Promote Students" wizard
   - Select source academic year (e.g., 2024-25)
   - Select target academic year (e.g., 2025-26)
   - Show class-by-class promotion mapping
   - Allow exceptions (retain, graduate, skip)
   - Preview before executing
   - Execute promotion

2. **Promotion Logic:**
```typescript
async function promoteStudents(sourceYearId, targetYearId, mappings) {
  // mappings = { "grade1-section-a": "grade2-section-a", ... }

  for (const [sourceSectionId, targetSectionId] of Object.entries(mappings)) {
    const enrollments = await getActiveEnrollments(sourceYearId, sourceSectionId);

    for (const enrollment of enrollments) {
      // Mark old enrollment as PROMOTED
      await updateEnrollment(enrollment.id, { status: 'PROMOTED' });

      // Create new enrollment
      await createEnrollment({
        studentId: enrollment.studentId,
        academicYearId: targetYearId,
        sectionId: targetSectionId,
        status: 'ACTIVE',
        promotedFromId: enrollment.id
      });
    }
  }
}
```

### Phase 4: UI Updates

1. **Student list:** Show current academic year filter
2. **Reports:** Filter by academic year
3. **Dashboard:** Show current academic year context

---

## Simplified Alternative (If History Not Needed)

If you don't need enrollment history, we can skip Phase 2:

1. Keep `sectionId` directly on `StudentProfile`
2. Promotion just updates `sectionId` to the new section
3. Add `academicYearId` to `StudentProfile` for context
4. Old data stays linked to student, filtered by date

This is simpler but you can't easily see "who was in Grade 5 in 2023-24".

---

## Decisions Made

1. **Enrollment history:** Yes - Create StudentEnrollment table
2. **Promotion trigger:** Manual - Admin clicks "Promote Students" button
3. **Section mapping:** Same section by default (A→A), but admin can edit/change
4. **Failed students:** Admin handles manually (excludes from promotion)
5. **Graduating students:** Alumni status - keep accessible but marked as graduated

---

## Files to Create/Modify

### New Files
- `src/app/(dashboard)/admin/academic-years/page.tsx`
- `src/app/(dashboard)/admin/academic-years/new/page.tsx`
- `src/app/(dashboard)/admin/academic-years/[id]/page.tsx`
- `src/app/api/academic-years/route.ts`
- `src/app/api/academic-years/[id]/route.ts`
- `src/app/api/academic-years/[id]/set-current/route.ts`
- `src/app/api/promotions/route.ts` (promotion logic)

### Modified Files
- `prisma/schema.prisma` - Add StudentEnrollment if needed
- `src/components/layout/sidebar.tsx` - Add Academic Years link
