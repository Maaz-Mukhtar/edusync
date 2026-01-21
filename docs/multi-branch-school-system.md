# Plan: Multi-Branch School System

## Overview
Implement a multi-branch architecture for schools where:
- Schools have configurable base grades (e.g., Grade 1-12)
- Branches can be created with specific grade ranges from the base grades
- Each branch gets an auto-created branch admin account
- Dashboard supports aggregated view (all branches) and branch-specific filtering
- Students belong to ONE branch; Teachers can work across MULTIPLE branches
- School admins see all branches; Branch admins see only their branch
- Main branch auto-created when school is created

---

## Database Schema Changes

### New Models

```prisma
model Branch {
  id          String   @id @default(cuid())
  name        String   // e.g., "Main Campus", "Junior Wing"
  code        String   // e.g., "MAIN", "JR"
  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id])
  isMain      Boolean  @default(false) // True for auto-created main branch

  // Grade range for this branch
  gradeStart  Int      // e.g., 1
  gradeEnd    Int      // e.g., 5

  classes     Class[]
  users       User[]   @relation("BranchUsers") // Students, branch admins
  teachers    TeacherBranchAssignment[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([schoolId, code])
  @@index([schoolId])
}

model Grade {
  id           String   @id @default(cuid())
  schoolId     String
  school       School   @relation(fields: [schoolId], references: [id])

  gradeNumber  Int      // 1, 2, 3... (ordering key)
  name         String   // Display name: "Grade 1", "O-Levels I", etc.

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([schoolId, gradeNumber])
  @@index([schoolId])
}

model TeacherBranchAssignment {
  id          String   @id @default(cuid())
  teacherId   String
  teacher     User     @relation(fields: [teacherId], references: [id])
  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id])

  createdAt   DateTime @default(now())

  @@unique([teacherId, branchId])
  @@index([teacherId])
  @@index([branchId])
}
```

### Modified Models

```prisma
model School {
  // Existing fields...

  // NEW: Grade range configuration
  gradeStart    Int      @default(1)   // e.g., 1
  gradeEnd      Int      @default(12)  // e.g., 12

  branches      Branch[]
  grades        Grade[]
}

model Class {
  // Existing fields...

  // NEW: Branch association
  branchId      String?
  branch        Branch?  @relation(fields: [branchId], references: [id])

  // NEW: Grade reference for ordering/filtering
  gradeNumber   Int?
}

model User {
  // Existing fields...

  // NEW: Branch for students and branch admins
  branchId              String?
  branch                Branch?  @relation("BranchUsers", fields: [branchId], references: [id])

  // NEW: Multi-branch support for teachers
  teacherBranches       TeacherBranchAssignment[]
}

enum UserRole {
  SUPER_ADMIN    // Platform admin (multi-school)
  ADMIN          // School admin (all branches)
  BRANCH_ADMIN   // Branch admin (single branch)
  TEACHER        // Can be in multiple branches
  STUDENT        // Single branch
  PARENT         // No branch assignment
}
```

---

## Implementation Phases

### Phase 1: Schema & Migration
1. Add new models to `prisma/schema.prisma`
2. Create migration
3. Create seed script to:
   - Add `gradeStart`/`gradeEnd` to existing schools (default 1-12)
   - Create Grade records for existing schools
   - Create main branch for existing schools
   - Migrate existing classes to main branch

### Phase 2: Grade Management API & UI
1. **API: `/api/grades`**
   - GET: List grades for school (ordered by gradeNumber)
   - PATCH: Update grade name (bulk update supported)

2. **API: `/api/schools/[id]/settings`**
   - GET: School settings including grade range
   - PATCH: Update grade range (creates/removes Grade records)

3. **UI: School Settings Page** (`/admin/settings`)
   - Configure base grade range (Grade 1-12, etc.)
   - Edit grade names (inline editing table)

### Phase 3: Branch Management API & UI
1. **API: `/api/branches`**
   - GET: List branches (filterable by schoolId)
   - POST: Create branch
     - Validate grade range within school's base grades
     - Auto-create branch admin user
     - Return admin credentials in response
   - PATCH `[id]`: Update branch name/code
   - DELETE `[id]`: Soft delete (prevent if has active students)

2. **UI: Branches Page** (`/admin/branches`)
   - List all branches with stats (students, teachers, classes)
   - Create branch modal with:
     - Name, Code
     - Grade range selector (dropdown with school's grades)
   - Show auto-generated admin credentials after creation
   - Edit/Delete branch actions

3. **UI: Branch Detail Page** (`/admin/branches/[id]`)
   - Branch info and stats
   - Assigned teachers list
   - Classes list (by grade)

### Phase 4: Dashboard Branch Filtering
1. **Add branch selector to admin dashboard**
   - Dropdown in header: "All Branches" | "Main Campus" | "Junior Wing"
   - Store selection in URL query param or session

2. **Modify `getDashboardStats()` function**
   - Accept optional `branchId` parameter
   - Filter all queries by branch when specified:
     - Students: filter by `branchId`
     - Teachers: filter by `TeacherBranchAssignment`
     - Classes: filter by `branchId`
     - Fees: filter by student's branch

3. **Update dashboard widgets**
   - Show branch name in title when filtered
   - Add "View All" link when filtered

### Phase 5: Auth & Access Control
1. **Update JWT session**
   ```typescript
   // In auth.config.ts
   interface SessionUser {
     id: string
     role: UserRole
     schoolId: string
     branchId?: string  // For BRANCH_ADMIN, STUDENT
   }
   ```

2. **Update middleware/route protection**
   - BRANCH_ADMIN: Filter all data by their branchId
   - Add `requireBranchAccess()` helper

3. **Update existing pages/APIs**
   - Add branchId filtering where applicable
   - Teachers: Use TeacherBranchAssignment for filtering

### Phase 6: User Management Updates
1. **Student creation/edit**
   - Add branch selector (required for students)
   - Show only grades available in selected branch

2. **Teacher creation/edit**
   - Add multi-branch selector
   - Create TeacherBranchAssignment records

3. **Branch Admin creation**
   - Auto-created with branch
   - Can manually add more branch admins

### Phase 7: Class Management Updates
1. **Class creation/edit**
   - Add branch selector
   - Filter grade options by branch's grade range
   - Associate class with branch

2. **Section management**
   - Inherit branch from parent class

---

## File Changes Summary

### New Files
```
src/app/api/branches/route.ts              # Branch CRUD
src/app/api/branches/[id]/route.ts         # Single branch operations
src/app/api/grades/route.ts                # Grade management
src/app/(dashboard)/admin/branches/page.tsx          # Branch list
src/app/(dashboard)/admin/branches/new/page.tsx      # Create branch
src/app/(dashboard)/admin/branches/[id]/page.tsx     # Branch details
src/app/(dashboard)/admin/settings/grades/page.tsx   # Grade config
src/components/branch-selector.tsx          # Reusable branch dropdown
src/lib/branch-utils.ts                     # Branch-related helpers
```

### Modified Files
```
prisma/schema.prisma                        # New models, modified models
src/lib/auth.config.ts                      # Add branchId to session
src/app/(dashboard)/admin/page.tsx          # Branch filter on dashboard
src/lib/dashboard.ts                        # branchId param for stats
src/app/(dashboard)/admin/users/new/page.tsx         # Branch selector
src/app/(dashboard)/admin/classes/page.tsx           # Branch filter
src/components/layout/sidebar.tsx           # Add Branches nav item
```

---

## UI Mockups

### Branch Selector (Dashboard Header)
```
+---------------------------------------------+
| Dashboard          [All Branches v]  [User] |
+---------------------------------------------+
|                    o All Branches           |
|                    o Main Campus            |
|                    o Junior Wing            |
|                    o Senior Wing            |
+---------------------------------------------+
```

### Create Branch Modal
```
+---------------------------------------------+
| Create New Branch                       [X] |
+---------------------------------------------+
| Branch Name: [Junior Wing____________]      |
| Branch Code: [JR____]                       |
|                                             |
| Grade Range:                                |
| From: [Grade 1 v]  To: [Grade 5 v]          |
|                                             |
| [x] Create admin account for this branch    |
|                                             |
|              [Cancel]  [Create Branch]      |
+---------------------------------------------+
```

### Admin Credentials Dialog (after creation)
```
+---------------------------------------------+
| Branch Admin Created                    [X] |
+---------------------------------------------+
| Branch "Junior Wing" created successfully!  |
|                                             |
| Admin Account Details:                      |
| Email: jr.admin@school.edu                  |
| Password: Temp@12345                        |
|                                             |
| Warning: Save these credentials - shown     |
| only once                                   |
|                                             |
|                            [Copy] [Done]    |
+---------------------------------------------+
```

---

## Auto-Create Main Branch Logic

When a new school is created:
```typescript
// In school creation API or seed
async function createSchoolWithMainBranch(data: SchoolCreateInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Create school
    const school = await tx.school.create({
      data: {
        ...data,
        gradeStart: data.gradeStart ?? 1,
        gradeEnd: data.gradeEnd ?? 12,
      }
    });

    // 2. Create grade records
    const grades = [];
    for (let i = school.gradeStart; i <= school.gradeEnd; i++) {
      grades.push({
        schoolId: school.id,
        gradeNumber: i,
        name: `Grade ${i}`
      });
    }
    await tx.grade.createMany({ data: grades });

    // 3. Create main branch (full grade range)
    await tx.branch.create({
      data: {
        schoolId: school.id,
        name: "Main Campus",
        code: "MAIN",
        isMain: true,
        gradeStart: school.gradeStart,
        gradeEnd: school.gradeEnd
      }
    });

    return school;
  });
}
```

---

## Migration Script for Existing Data

```typescript
// scripts/migrate-to-branches.ts
async function migrateExistingSchools() {
  const schools = await prisma.school.findMany();

  for (const school of schools) {
    await prisma.$transaction(async (tx) => {
      // 1. Set default grade range
      await tx.school.update({
        where: { id: school.id },
        data: { gradeStart: 1, gradeEnd: 12 }
      });

      // 2. Create grades
      for (let i = 1; i <= 12; i++) {
        await tx.grade.upsert({
          where: { schoolId_gradeNumber: { schoolId: school.id, gradeNumber: i } },
          create: { schoolId: school.id, gradeNumber: i, name: `Grade ${i}` },
          update: {}
        });
      }

      // 3. Create main branch
      const branch = await tx.branch.create({
        data: {
          schoolId: school.id,
          name: "Main Campus",
          code: "MAIN",
          isMain: true,
          gradeStart: 1,
          gradeEnd: 12
        }
      });

      // 4. Assign existing classes to main branch
      await tx.class.updateMany({
        where: { schoolId: school.id },
        data: { branchId: branch.id }
      });

      // 5. Assign existing students to main branch
      await tx.user.updateMany({
        where: { schoolId: school.id, role: 'STUDENT' },
        data: { branchId: branch.id }
      });

      // 6. Create teacher assignments for main branch
      const teachers = await tx.user.findMany({
        where: { schoolId: school.id, role: 'TEACHER' }
      });
      for (const teacher of teachers) {
        await tx.teacherBranchAssignment.create({
          data: { teacherId: teacher.id, branchId: branch.id }
        });
      }
    });
  }
}
```

---

## Verification Steps

1. **Schema Migration**
   - Run `prisma migrate dev`
   - Verify new tables created
   - Run migration script for existing data

2. **Grade Management**
   - Edit grade names in settings
   - Verify changes persist

3. **Branch Creation**
   - Create new branch with grade range
   - Verify admin credentials displayed
   - Login as branch admin and confirm limited access

4. **Dashboard Filtering**
   - Select different branches
   - Verify stats update correctly
   - Test "All Branches" aggregation

5. **User Management**
   - Create student in specific branch
   - Assign teacher to multiple branches
   - Verify filtering works correctly

6. **Access Control**
   - Login as school admin - see all branches
   - Login as branch admin - see only their branch
   - Verify API endpoints enforce branch access
