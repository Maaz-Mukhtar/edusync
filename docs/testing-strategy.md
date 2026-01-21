# EduSync Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the EduSync School Management System, with specific focus on the Academic Year Management feature and UI testing for each portal.

---

## 1. Testing Pyramid

```
        /\
       /  \   E2E Tests (Critical User Flows)
      /----\
     /      \  Integration Tests (API, Database)
    /--------\
   /          \ Unit Tests (Functions, Components)
  /______________\
```

### Recommended Distribution:
- **Unit Tests:** 60% - Fast, isolated tests for functions and components
- **Integration Tests:** 25% - API endpoints, database operations
- **E2E Tests:** 15% - Critical user journeys across portals

---

## 2. Testing Tools Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Testing | Vitest / Jest | Fast unit tests |
| Component Testing | React Testing Library | UI component testing |
| API Testing | Vitest + Supertest | API endpoint testing |
| E2E Testing | Playwright | Cross-browser E2E testing |
| Database | Prisma Test Utils | Database seeding/mocking |
| Mocking | MSW (Mock Service Worker) | API mocking |
| Coverage | Istanbul/c8 | Code coverage reports |

---

## 3. Academic Year Feature - Test Plan

### 3.1 Unit Tests

#### API Functions (`src/app/api/academic-years/`)

| Test Case | Description | Priority |
|-----------|-------------|----------|
| `createAcademicYear` | Valid year creation with name, dates | High |
| `createAcademicYear` | Validation: end date before start date | High |
| `createAcademicYear` | Validation: duplicate year name | High |
| `updateAcademicYear` | Update dates and name | Medium |
| `deleteAcademicYear` | Delete year with no enrollments | Medium |
| `deleteAcademicYear` | Prevent delete with active enrollments | High |
| `setCurrentYear` | Set year as current, unset previous | High |
| `setCurrentYear` | Only one current year per school | High |

#### Promotion Logic (`src/app/api/academic-years/[id]/promote/`)

| Test Case | Description | Priority |
|-----------|-------------|----------|
| `promoteStudents` | Basic promotion: Grade 5 → Grade 6 | High |
| `promoteStudents` | Section mapping: 5-A → 6-A | High |
| `promoteStudents` | Status change: ACTIVE → PROMOTED | High |
| `promoteStudents` | Create new ACTIVE enrollment | High |
| `promoteStudents` | Link promotedFromId correctly | High |
| `promoteStudents` | Handle graduating students (Grade 12) | High |
| `promoteStudents` | Exclude RETAINED students | Medium |
| `promoteStudents` | Exclude LEFT students | Medium |
| `promoteStudents` | Rollback on failure | High |

#### Enrollment Functions

| Test Case | Description | Priority |
|-----------|-------------|----------|
| `createEnrollment` | Create enrollment for new student | High |
| `createEnrollment` | Unique constraint: student + year | High |
| `getCurrentEnrollment` | Get active enrollment for student | High |
| `getEnrollmentHistory` | Get all enrollments for student | Medium |
| `updateEnrollmentStatus` | Change status (ACTIVE → LEFT) | Medium |

### 3.2 Integration Tests

#### API Endpoints

```typescript
// Test file: __tests__/api/academic-years.test.ts

describe('GET /api/academic-years', () => {
  it('returns all academic years for school')
  it('returns 401 for unauthenticated request')
  it('filters by school (multi-tenant)')
})

describe('POST /api/academic-years', () => {
  it('creates academic year with valid data')
  it('returns 400 for invalid date range')
  it('returns 409 for duplicate name')
  it('requires admin role')
})

describe('POST /api/academic-years/[id]/set-current', () => {
  it('sets year as current')
  it('unsets previous current year')
  it('returns 404 for non-existent year')
})

describe('POST /api/academic-years/[id]/promote', () => {
  it('promotes all active students')
  it('creates enrollments in target year')
  it('returns promotion summary')
  it('handles partial failures gracefully')
})
```

#### Database Operations

```typescript
describe('StudentEnrollment', () => {
  it('enforces unique [studentId, academicYearId]')
  it('cascades on student delete')
  it('maintains promotion chain integrity')
})
```

### 3.3 E2E Tests (Academic Year)

| Test Scenario | Steps | Expected Result |
|---------------|-------|-----------------|
| Create Academic Year | Admin creates "2025-2026" year | Year appears in list |
| Set Current Year | Admin sets "2025-2026" as current | Badge shows "Current" |
| Promote Students | Admin runs promotion wizard | Students appear in new year |
| View Enrollment History | Admin views student profile | All enrollments visible |

---

## 4. UI Testing Strategy by Portal

### 4.1 Admin Portal Tests

**Location:** `/admin/*`

#### Pages to Test:

| Page | Test Cases | Priority |
|------|------------|----------|
| `/admin/dashboard` | Stats cards load, charts render | High |
| `/admin/users/students` | List students, search, filter by class | High |
| `/admin/users/students/new` | Create student form validation | High |
| `/admin/users/teachers` | List teachers, assign subjects | High |
| `/admin/classes` | CRUD classes and sections | High |
| `/admin/academic-years` | Create, edit, set current year | High |
| `/admin/academic-years/[id]/promote` | Promotion wizard flow | High |
| `/admin/fees` | Fee structure management | Medium |
| `/admin/announcements` | Create announcements | Medium |

#### Test Scenarios:

```typescript
// __tests__/e2e/admin/academic-years.spec.ts

test('Admin can create a new academic year', async ({ page }) => {
  await page.goto('/admin/academic-years');
  await page.click('button:has-text("Create Academic Year")');

  await page.fill('[name="name"]', '2025-2026');
  await page.fill('[name="startDate"]', '2025-04-01');
  await page.fill('[name="endDate"]', '2026-03-31');

  await page.click('button:has-text("Create")');

  await expect(page.locator('text=2025-2026')).toBeVisible();
});

test('Admin can promote students to next year', async ({ page }) => {
  await page.goto('/admin/academic-years/[id]/promote');

  // Select source and target years
  await page.selectOption('[name="sourceYear"]', '2024-2025');
  await page.selectOption('[name="targetYear"]', '2025-2026');

  // Preview promotions
  await page.click('button:has-text("Preview")');
  await expect(page.locator('text=students will be promoted')).toBeVisible();

  // Execute promotion
  await page.click('button:has-text("Confirm Promotion")');
  await expect(page.locator('text=successfully promoted')).toBeVisible();
});

test('Admin can manage user creation', async ({ page }) => {
  await page.goto('/admin/users/students/new');

  // Fill student form
  await page.fill('[name="firstName"]', 'Test');
  await page.fill('[name="lastName"]', 'Student');
  await page.fill('[name="email"]', 'test@example.com');
  await page.selectOption('[name="classId"]', 'Grade 5');
  await page.selectOption('[name="sectionId"]', 'A');

  await page.click('button:has-text("Create Student")');

  await expect(page.locator('text=Student created successfully')).toBeVisible();
});
```

#### Admin Portal Checklist:

- [ ] Dashboard loads with correct statistics
- [ ] All navigation links work
- [ ] CRUD operations for all user types
- [ ] Class/section management
- [ ] Academic year creation and management
- [ ] Student promotion workflow
- [ ] Fee structure configuration
- [ ] Announcement creation
- [ ] CSV import functionality
- [ ] Role-based access enforcement

---

### 4.2 Teacher Portal Tests

**Location:** `/teacher/*`

#### Pages to Test:

| Page | Test Cases | Priority |
|------|------------|----------|
| `/teacher/dashboard` | Classes overview, quick actions | High |
| `/teacher/attendance` | Mark attendance for section | High |
| `/teacher/attendance/history` | View/edit past attendance | Medium |
| `/teacher/gradebook` | View grades by section/subject | High |
| `/teacher/assessments` | Create/manage assessments | High |
| `/teacher/assessments/[id]/grades` | Enter grades for students | High |
| `/teacher/online-tests` | Create online tests | Medium |
| `/teacher/messages` | Parent-teacher communication | Medium |

#### Test Scenarios:

```typescript
// __tests__/e2e/teacher/attendance.spec.ts

test('Teacher can mark attendance', async ({ page }) => {
  await page.goto('/teacher/attendance');

  // Select section
  await page.selectOption('[name="section"]', 'Grade 5-A');
  await page.fill('[name="date"]', '2025-01-15');

  // Mark students
  const students = page.locator('[data-testid="student-row"]');
  await students.first().locator('[value="PRESENT"]').click();

  await page.click('button:has-text("Save Attendance")');

  await expect(page.locator('text=Attendance saved')).toBeVisible();
});

test('Teacher can create assessment', async ({ page }) => {
  await page.goto('/teacher/assessments/new');

  await page.fill('[name="title"]', 'Unit Test 1');
  await page.selectOption('[name="type"]', 'TEST');
  await page.selectOption('[name="section"]', 'Grade 5-A');
  await page.selectOption('[name="subject"]', 'Mathematics');
  await page.fill('[name="totalMarks"]', '100');
  await page.fill('[name="date"]', '2025-01-20');

  await page.click('button:has-text("Create Assessment")');

  await expect(page.locator('text=Assessment created')).toBeVisible();
});

test('Teacher can enter grades', async ({ page }) => {
  await page.goto('/teacher/assessments/[id]/grades');

  const gradeInputs = page.locator('[data-testid="grade-input"]');
  await gradeInputs.first().fill('85');

  await page.click('button:has-text("Save Grades")');

  await expect(page.locator('text=Grades saved')).toBeVisible();
});
```

#### Teacher Portal Checklist:

- [ ] Dashboard shows assigned classes/sections
- [ ] Attendance marking for current date
- [ ] Historical attendance viewing/editing
- [ ] Assessment creation with all types
- [ ] Grade entry with validation
- [ ] Online test creation and management
- [ ] View student performance analytics
- [ ] Parent messaging functionality
- [ ] Only sees assigned sections/subjects

---

### 4.3 Student Portal Tests

**Location:** `/student/*`

#### Pages to Test:

| Page | Test Cases | Priority |
|------|------------|----------|
| `/student/dashboard` | Overview, upcoming deadlines | High |
| `/student/timetable` | Weekly timetable view | High |
| `/student/attendance` | Personal attendance history | Medium |
| `/student/grades` | View grades and results | High |
| `/student/online-tests` | Available tests, take tests | High |
| `/student/online-tests/[id]` | Test taking interface | High |
| `/student/fees` | Fee status and history | Medium |

#### Test Scenarios:

```typescript
// __tests__/e2e/student/grades.spec.ts

test('Student can view grades', async ({ page }) => {
  await page.goto('/student/grades');

  // Check subject grades are visible
  await expect(page.locator('text=Mathematics')).toBeVisible();
  await expect(page.locator('[data-testid="grade-card"]')).toHaveCount.greaterThan(0);
});

test('Student can take online test', async ({ page }) => {
  await page.goto('/student/online-tests');

  // Click on available test
  await page.click('text=Unit Test 1');

  // Start test
  await page.click('button:has-text("Start Test")');

  // Answer MCQ question
  await page.click('[data-testid="option-a"]');
  await page.click('button:has-text("Next")');

  // Submit test
  await page.click('button:has-text("Submit Test")');

  await expect(page.locator('text=Test submitted')).toBeVisible();
});

test('Student can view attendance percentage', async ({ page }) => {
  await page.goto('/student/attendance');

  await expect(page.locator('[data-testid="attendance-percentage"]')).toBeVisible();
  await expect(page.locator('[data-testid="attendance-calendar"]')).toBeVisible();
});
```

#### Student Portal Checklist:

- [ ] Dashboard shows relevant information
- [ ] Timetable displays correctly
- [ ] Attendance history with calendar view
- [ ] Grades show per subject with details
- [ ] Online test list and availability
- [ ] Test-taking flow works completely
- [ ] Fee invoices visible
- [ ] Announcements visible
- [ ] Can only see own data

---

### 4.4 Parent Portal Tests

**Location:** `/parent/*`

#### Pages to Test:

| Page | Test Cases | Priority |
|------|------------|----------|
| `/parent/dashboard` | Child overview, alerts | High |
| `/parent/children` | Child switcher (multi-child) | High |
| `/parent/attendance` | Child's attendance | Medium |
| `/parent/grades` | Child's grades | High |
| `/parent/fees` | Fee payment, history | High |
| `/parent/events` | Event approvals | Medium |
| `/parent/messages` | Teacher communication | Medium |

#### Test Scenarios:

```typescript
// __tests__/e2e/parent/multi-child.spec.ts

test('Parent can switch between children', async ({ page }) => {
  await page.goto('/parent/dashboard');

  // Child switcher visible
  await expect(page.locator('[data-testid="child-switcher"]')).toBeVisible();

  // Switch to second child
  await page.click('[data-testid="child-switcher"]');
  await page.click('text=Sarah');

  // Dashboard updates for selected child
  await expect(page.locator('text=Sarah')).toBeVisible();
});

test('Parent can view child grades', async ({ page }) => {
  await page.goto('/parent/grades');

  await expect(page.locator('[data-testid="subject-grades"]')).toBeVisible();
  await expect(page.locator('text=Mathematics')).toBeVisible();
});

test('Parent can approve event participation', async ({ page }) => {
  await page.goto('/parent/events');

  // Find pending approval
  const event = page.locator('[data-testid="event-card"]:has-text("School Trip")');
  await event.locator('button:has-text("Approve")').click();

  await expect(event.locator('text=Approved')).toBeVisible();
});

test('Parent can message teacher', async ({ page }) => {
  await page.goto('/parent/messages');

  await page.click('button:has-text("New Message")');
  await page.selectOption('[name="teacher"]', 'Mr. Ahmed');
  await page.fill('[name="message"]', 'Query about homework');
  await page.click('button:has-text("Send")');

  await expect(page.locator('text=Message sent')).toBeVisible();
});
```

#### Parent Portal Checklist:

- [ ] Dashboard shows child overview
- [ ] Child switcher works correctly
- [ ] Can view attendance for selected child
- [ ] Can view grades for selected child
- [ ] Fee invoices visible with payment history
- [ ] Event approval workflow
- [ ] Can message teachers
- [ ] Announcements visible
- [ ] Can only see own children's data

---

## 5. Cross-Cutting Test Concerns

### 5.1 Authentication Tests

```typescript
describe('Authentication', () => {
  test('Login with valid credentials')
  test('Login with invalid credentials shows error')
  test('Logout clears session')
  test('Session expiry redirects to login')
  test('Role-based redirects work correctly')
});
```

### 5.2 Authorization Tests

| Scenario | Test |
|----------|------|
| Admin accessing teacher pages | Should be allowed |
| Teacher accessing admin pages | Should be denied |
| Student accessing other student data | Should be denied |
| Parent accessing non-child data | Should be denied |

### 5.3 Multi-Tenancy Tests

```typescript
describe('Multi-tenancy', () => {
  test('User from School A cannot see School B data')
  test('API enforces schoolId filtering')
  test('Subdomain routing works correctly')
});
```

### 5.4 Responsive Design Tests

| Viewport | Width | Tests |
|----------|-------|-------|
| Mobile | 375px | Sidebar collapse, touch targets |
| Tablet | 768px | Layout adjustments |
| Desktop | 1280px | Full layout |

---

## 6. Test Data Strategy

### 6.1 Seed Data Requirements

```typescript
// prisma/seed-test.ts

const testData = {
  schools: [
    { name: 'Test School', subdomain: 'test' }
  ],
  academicYears: [
    { name: '2024-2025', isCurrent: true },
    { name: '2025-2026', isCurrent: false }
  ],
  classes: [
    { name: 'Grade 5', sections: ['A', 'B'] },
    { name: 'Grade 6', sections: ['A', 'B'] }
  ],
  users: {
    admin: { email: 'admin@test.com', role: 'ADMIN' },
    teacher: { email: 'teacher@test.com', role: 'TEACHER' },
    student: { email: 'student@test.com', role: 'STUDENT' },
    parent: { email: 'parent@test.com', role: 'PARENT' }
  }
};
```

### 6.2 Database Isolation

- Each test suite uses isolated database (test schema)
- Tests clean up after themselves
- Use transactions for rollback

---

## 7. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
```

---

## 8. Test Coverage Goals

| Area | Target Coverage |
|------|-----------------|
| API Routes | 90% |
| Business Logic | 85% |
| UI Components | 70% |
| E2E Critical Paths | 100% |

---

## 9. Implementation Priority

### Phase 1 (Immediate)
1. Set up testing infrastructure (Vitest, Playwright)
2. Academic Year API unit tests
3. Promotion logic tests
4. Admin portal E2E tests for academic year

### Phase 2 (Week 1-2)
1. Teacher portal attendance/grades tests
2. Student portal tests
3. Parent portal tests
4. Authentication/authorization tests

### Phase 3 (Week 2-3)
1. Multi-tenancy tests
2. Performance tests
3. Accessibility tests
4. Mobile responsive tests

---

## 10. Questions for Discussion

1. **Testing Framework Preference:**
   - Vitest (faster, Vite-native) vs Jest (more established)?

2. **E2E Test Environment:**
   - Dedicated test database or mock all API calls?

3. **Coverage Thresholds:**
   - Should we enforce minimum coverage in CI?

4. **Visual Regression Testing:**
   - Should we add visual snapshot testing for UI?

5. **Performance Testing:**
   - Do we need load testing for promotion operations?

6. **Test Data:**
   - Use factory functions or static seed files?

---

*Document Version: 1.0*
*Created: January 2025*
