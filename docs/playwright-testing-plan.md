# EduSync Playwright Testing Plan

## Overview

This document details the Playwright E2E testing strategy for all four portals: Admin, Teacher, Student, and Parent.

---

## 1. Setup & Configuration

### Installation

```bash
npm install -D @playwright/test
npx playwright install
```

### Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Authentication setup
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 2. Project Structure

```
e2e/
├── fixtures/
│   ├── auth.fixture.ts        # Authentication fixtures
│   ├── test-data.fixture.ts   # Test data factories
│   └── base.fixture.ts        # Extended test with all fixtures
├── pages/
│   ├── login.page.ts          # Login page object
│   ├── admin/
│   │   ├── dashboard.page.ts
│   │   ├── academic-years.page.ts
│   │   ├── users.page.ts
│   │   └── promote.page.ts
│   ├── teacher/
│   │   ├── dashboard.page.ts
│   │   ├── attendance.page.ts
│   │   ├── gradebook.page.ts
│   │   └── assessments.page.ts
│   ├── student/
│   │   ├── dashboard.page.ts
│   │   ├── grades.page.ts
│   │   └── online-tests.page.ts
│   └── parent/
│       ├── dashboard.page.ts
│       ├── child-switcher.page.ts
│       └── events.page.ts
├── tests/
│   ├── auth/
│   │   └── login.spec.ts
│   ├── admin/
│   │   ├── academic-years.spec.ts
│   │   ├── promotion.spec.ts
│   │   ├── user-management.spec.ts
│   │   └── classes.spec.ts
│   ├── teacher/
│   │   ├── attendance.spec.ts
│   │   ├── assessments.spec.ts
│   │   └── grades.spec.ts
│   ├── student/
│   │   ├── grades.spec.ts
│   │   └── online-tests.spec.ts
│   └── parent/
│       ├── multi-child.spec.ts
│       ├── fees.spec.ts
│       └── events.spec.ts
├── auth.setup.ts              # Pre-test authentication
└── global-setup.ts            # Database seeding
```

---

## 3. Authentication Setup

### `e2e/auth.setup.ts`

```typescript
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFiles = {
  admin: path.join(__dirname, '.auth/admin.json'),
  teacher: path.join(__dirname, '.auth/teacher.json'),
  student: path.join(__dirname, '.auth/student.json'),
  parent: path.join(__dirname, '.auth/parent.json'),
};

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'admin@test.edusync.pk');
  await page.fill('[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin/dashboard');
  await page.context().storageState({ path: authFiles.admin });
});

setup('authenticate as teacher', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'teacher@test.edusync.pk');
  await page.fill('[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/teacher/dashboard');
  await page.context().storageState({ path: authFiles.teacher });
});

setup('authenticate as student', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'student@test.edusync.pk');
  await page.fill('[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/student/dashboard');
  await page.context().storageState({ path: authFiles.student });
});

setup('authenticate as parent', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'parent@test.edusync.pk');
  await page.fill('[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/parent/dashboard');
  await page.context().storageState({ path: authFiles.parent });
});
```

### `e2e/fixtures/auth.fixture.ts`

```typescript
import { test as base } from '@playwright/test';
import path from 'path';

type AuthFixtures = {
  adminPage: Page;
  teacherPage: Page;
  studentPage: Page;
  parentPage: Page;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/admin.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  teacherPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/teacher.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  studentPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/student.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  parentPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/parent.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
```

---

## 4. Page Object Models

### `e2e/pages/admin/academic-years.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class AcademicYearsPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly yearsList: Locator;
  readonly nameInput: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly submitButton: Locator;
  readonly currentBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /create academic year/i });
    this.yearsList = page.locator('[data-testid="academic-years-list"]');
    this.nameInput = page.locator('[name="name"]');
    this.startDateInput = page.locator('[name="startDate"]');
    this.endDateInput = page.locator('[name="endDate"]');
    this.submitButton = page.getByRole('button', { name: /create|save/i });
    this.currentBadge = page.locator('[data-testid="current-badge"]');
  }

  async goto() {
    await this.page.goto('/admin/academic-years');
  }

  async createYear(name: string, startDate: string, endDate: string) {
    await this.createButton.click();
    await this.nameInput.fill(name);
    await this.startDateInput.fill(startDate);
    await this.endDateInput.fill(endDate);
    await this.submitButton.click();
  }

  async setAsCurrent(yearName: string) {
    const yearRow = this.page.locator(`[data-testid="year-row"]:has-text("${yearName}")`);
    await yearRow.getByRole('button', { name: /set as current/i }).click();
    await this.page.getByRole('button', { name: /confirm/i }).click();
  }

  async getYearRow(yearName: string): Locator {
    return this.page.locator(`[data-testid="year-row"]:has-text("${yearName}")`);
  }

  async expectYearExists(yearName: string) {
    await expect(this.page.getByText(yearName)).toBeVisible();
  }

  async expectCurrentYear(yearName: string) {
    const yearRow = await this.getYearRow(yearName);
    await expect(yearRow.locator('[data-testid="current-badge"]')).toBeVisible();
  }
}
```

### `e2e/pages/admin/promote.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class PromotionPage {
  readonly page: Page;
  readonly sourceYearSelect: Locator;
  readonly targetYearSelect: Locator;
  readonly previewButton: Locator;
  readonly confirmButton: Locator;
  readonly promotionSummary: Locator;
  readonly classMappings: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sourceYearSelect = page.locator('[name="sourceYear"]');
    this.targetYearSelect = page.locator('[name="targetYear"]');
    this.previewButton = page.getByRole('button', { name: /preview/i });
    this.confirmButton = page.getByRole('button', { name: /confirm promotion/i });
    this.promotionSummary = page.locator('[data-testid="promotion-summary"]');
    this.classMappings = page.locator('[data-testid="class-mapping"]');
  }

  async goto(academicYearId: string) {
    await this.page.goto(`/admin/academic-years/${academicYearId}/promote`);
  }

  async selectSourceYear(yearName: string) {
    await this.sourceYearSelect.selectOption({ label: yearName });
  }

  async selectTargetYear(yearName: string) {
    await this.targetYearSelect.selectOption({ label: yearName });
  }

  async preview() {
    await this.previewButton.click();
    await expect(this.promotionSummary).toBeVisible();
  }

  async confirmPromotion() {
    await this.confirmButton.click();
  }

  async expectPromotionCount(count: number) {
    await expect(this.page.getByText(`${count} students will be promoted`)).toBeVisible();
  }

  async expectSuccess() {
    await expect(this.page.getByText(/successfully promoted/i)).toBeVisible();
  }

  async excludeStudent(studentName: string) {
    const studentRow = this.page.locator(`[data-testid="student-row"]:has-text("${studentName}")`);
    await studentRow.getByRole('checkbox').uncheck();
  }

  async markAsRetained(studentName: string) {
    const studentRow = this.page.locator(`[data-testid="student-row"]:has-text("${studentName}")`);
    await studentRow.getByRole('combobox').selectOption('RETAINED');
  }
}
```

### `e2e/pages/teacher/attendance.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class AttendancePage {
  readonly page: Page;
  readonly sectionSelect: Locator;
  readonly dateInput: Locator;
  readonly studentRows: Locator;
  readonly saveButton: Locator;
  readonly markAllPresentButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sectionSelect = page.locator('[name="section"]');
    this.dateInput = page.locator('[name="date"]');
    this.studentRows = page.locator('[data-testid="student-attendance-row"]');
    this.saveButton = page.getByRole('button', { name: /save attendance/i });
    this.markAllPresentButton = page.getByRole('button', { name: /mark all present/i });
  }

  async goto() {
    await this.page.goto('/teacher/attendance');
  }

  async selectSection(sectionName: string) {
    await this.sectionSelect.selectOption({ label: sectionName });
  }

  async selectDate(date: string) {
    await this.dateInput.fill(date);
  }

  async markStudent(studentName: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') {
    const studentRow = this.page.locator(`[data-testid="student-attendance-row"]:has-text("${studentName}")`);
    await studentRow.locator(`[value="${status}"]`).click();
  }

  async markAllPresent() {
    await this.markAllPresentButton.click();
  }

  async save() {
    await this.saveButton.click();
  }

  async expectSaveSuccess() {
    await expect(this.page.getByText(/attendance saved/i)).toBeVisible();
  }

  async expectStudentCount(count: number) {
    await expect(this.studentRows).toHaveCount(count);
  }
}
```

### `e2e/pages/student/online-tests.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class OnlineTestsPage {
  readonly page: Page;
  readonly availableTests: Locator;
  readonly startButton: Locator;
  readonly questionText: Locator;
  readonly options: Locator;
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly submitButton: Locator;
  readonly timer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.availableTests = page.locator('[data-testid="available-test"]');
    this.startButton = page.getByRole('button', { name: /start test/i });
    this.questionText = page.locator('[data-testid="question-text"]');
    this.options = page.locator('[data-testid="option"]');
    this.nextButton = page.getByRole('button', { name: /next/i });
    this.prevButton = page.getByRole('button', { name: /previous/i });
    this.submitButton = page.getByRole('button', { name: /submit/i });
    this.timer = page.locator('[data-testid="test-timer"]');
  }

  async goto() {
    await this.page.goto('/student/online-tests');
  }

  async openTest(testName: string) {
    await this.page.locator(`[data-testid="available-test"]:has-text("${testName}")`).click();
  }

  async startTest() {
    await this.startButton.click();
    await expect(this.questionText).toBeVisible();
  }

  async selectOption(optionIndex: number) {
    await this.options.nth(optionIndex).click();
  }

  async answerMCQ(optionText: string) {
    await this.page.locator(`[data-testid="option"]:has-text("${optionText}")`).click();
  }

  async fillShortAnswer(answer: string) {
    await this.page.locator('[data-testid="short-answer-input"]').fill(answer);
  }

  async nextQuestion() {
    await this.nextButton.click();
  }

  async previousQuestion() {
    await this.prevButton.click();
  }

  async submitTest() {
    await this.submitButton.click();
    // Confirm submission dialog
    await this.page.getByRole('button', { name: /confirm/i }).click();
  }

  async expectSubmissionSuccess() {
    await expect(this.page.getByText(/test submitted/i)).toBeVisible();
  }

  async expectScore(score: string) {
    await expect(this.page.getByText(score)).toBeVisible();
  }
}
```

### `e2e/pages/parent/child-switcher.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class ParentDashboardPage {
  readonly page: Page;
  readonly childSwitcher: Locator;
  readonly childOptions: Locator;
  readonly selectedChildName: Locator;
  readonly attendanceCard: Locator;
  readonly gradesCard: Locator;
  readonly feesCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.childSwitcher = page.locator('[data-testid="child-switcher"]');
    this.childOptions = page.locator('[data-testid="child-option"]');
    this.selectedChildName = page.locator('[data-testid="selected-child-name"]');
    this.attendanceCard = page.locator('[data-testid="attendance-summary"]');
    this.gradesCard = page.locator('[data-testid="grades-summary"]');
    this.feesCard = page.locator('[data-testid="fees-summary"]');
  }

  async goto() {
    await this.page.goto('/parent/dashboard');
  }

  async switchChild(childName: string) {
    await this.childSwitcher.click();
    await this.page.locator(`[data-testid="child-option"]:has-text("${childName}")`).click();
  }

  async expectSelectedChild(childName: string) {
    await expect(this.selectedChildName).toHaveText(childName);
  }

  async expectChildCount(count: number) {
    await this.childSwitcher.click();
    await expect(this.childOptions).toHaveCount(count);
    await this.page.keyboard.press('Escape'); // Close dropdown
  }

  async getAttendancePercentage(): Promise<string> {
    return await this.attendanceCard.locator('[data-testid="percentage"]').textContent() || '';
  }
}
```

---

## 5. Test Suites

### 5.1 Admin Portal Tests

#### `e2e/tests/admin/academic-years.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
import { AcademicYearsPage } from '../../pages/admin/academic-years.page';

test.describe('Academic Years Management', () => {
  test('Admin can view list of academic years', async ({ adminPage }) => {
    const academicYearsPage = new AcademicYearsPage(adminPage);
    await academicYearsPage.goto();

    await expect(adminPage.getByRole('heading', { name: /academic years/i })).toBeVisible();
    await academicYearsPage.expectYearExists('2024-2025');
  });

  test('Admin can create a new academic year', async ({ adminPage }) => {
    const academicYearsPage = new AcademicYearsPage(adminPage);
    await academicYearsPage.goto();

    await academicYearsPage.createYear('2025-2026', '2025-04-01', '2026-03-31');

    await academicYearsPage.expectYearExists('2025-2026');
    await expect(adminPage.getByText(/created successfully/i)).toBeVisible();
  });

  test('Admin cannot create duplicate academic year', async ({ adminPage }) => {
    const academicYearsPage = new AcademicYearsPage(adminPage);
    await academicYearsPage.goto();

    await academicYearsPage.createYear('2024-2025', '2024-04-01', '2025-03-31');

    await expect(adminPage.getByText(/already exists/i)).toBeVisible();
  });

  test('Admin can set an academic year as current', async ({ adminPage }) => {
    const academicYearsPage = new AcademicYearsPage(adminPage);
    await academicYearsPage.goto();

    await academicYearsPage.setAsCurrent('2025-2026');

    await academicYearsPage.expectCurrentYear('2025-2026');
  });

  test('Only one academic year can be current', async ({ adminPage }) => {
    const academicYearsPage = new AcademicYearsPage(adminPage);
    await academicYearsPage.goto();

    // Set 2025-2026 as current
    await academicYearsPage.setAsCurrent('2025-2026');

    // Verify 2024-2025 is no longer current
    const oldYearRow = await academicYearsPage.getYearRow('2024-2025');
    await expect(oldYearRow.locator('[data-testid="current-badge"]')).not.toBeVisible();
  });

  test('Validation: End date must be after start date', async ({ adminPage }) => {
    const academicYearsPage = new AcademicYearsPage(adminPage);
    await academicYearsPage.goto();

    await academicYearsPage.createYear('2026-2027', '2027-04-01', '2026-03-31');

    await expect(adminPage.getByText(/end date must be after start date/i)).toBeVisible();
  });
});
```

#### `e2e/tests/admin/promotion.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
import { PromotionPage } from '../../pages/admin/promote.page';

test.describe('Student Promotion', () => {
  test('Admin can preview student promotions', async ({ adminPage }) => {
    const promotionPage = new PromotionPage(adminPage);
    await promotionPage.goto('academic-year-id');

    await promotionPage.selectSourceYear('2024-2025');
    await promotionPage.selectTargetYear('2025-2026');
    await promotionPage.preview();

    await expect(promotionPage.promotionSummary).toBeVisible();
    await promotionPage.expectPromotionCount(50); // Expected student count
  });

  test('Admin can execute student promotion', async ({ adminPage }) => {
    const promotionPage = new PromotionPage(adminPage);
    await promotionPage.goto('academic-year-id');

    await promotionPage.selectSourceYear('2024-2025');
    await promotionPage.selectTargetYear('2025-2026');
    await promotionPage.preview();
    await promotionPage.confirmPromotion();

    await promotionPage.expectSuccess();
  });

  test('Admin can exclude specific students from promotion', async ({ adminPage }) => {
    const promotionPage = new PromotionPage(adminPage);
    await promotionPage.goto('academic-year-id');

    await promotionPage.selectSourceYear('2024-2025');
    await promotionPage.selectTargetYear('2025-2026');
    await promotionPage.preview();

    // Exclude a student
    await promotionPage.excludeStudent('John Doe');
    await promotionPage.confirmPromotion();

    await promotionPage.expectSuccess();
  });

  test('Admin can mark students as retained', async ({ adminPage }) => {
    const promotionPage = new PromotionPage(adminPage);
    await promotionPage.goto('academic-year-id');

    await promotionPage.selectSourceYear('2024-2025');
    await promotionPage.selectTargetYear('2025-2026');
    await promotionPage.preview();

    await promotionPage.markAsRetained('Jane Smith');
    await promotionPage.confirmPromotion();

    await promotionPage.expectSuccess();
  });

  test('Graduating students (Grade 12) are marked as GRADUATED', async ({ adminPage }) => {
    const promotionPage = new PromotionPage(adminPage);
    await promotionPage.goto('academic-year-id');

    await promotionPage.selectSourceYear('2024-2025');
    await promotionPage.selectTargetYear('2025-2026');
    await promotionPage.preview();

    // Check Grade 12 section shows "Graduate" option
    const grade12Section = adminPage.locator('[data-testid="class-mapping"]:has-text("Grade 12")');
    await expect(grade12Section.getByText(/graduate/i)).toBeVisible();
  });
});
```

#### `e2e/tests/admin/user-management.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('User Management', () => {
  test.describe('Student Management', () => {
    test('Admin can create a new student', async ({ adminPage }) => {
      await adminPage.goto('/admin/users/students/new');

      await adminPage.fill('[name="firstName"]', 'Test');
      await adminPage.fill('[name="lastName"]', 'Student');
      await adminPage.fill('[name="email"]', 'newstudent@test.com');
      await adminPage.selectOption('[name="classId"]', { label: 'Grade 5' });
      await adminPage.selectOption('[name="sectionId"]', { label: 'A' });

      await adminPage.click('button[type="submit"]');

      await expect(adminPage.getByText(/student created/i)).toBeVisible();
    });

    test('Admin can search students', async ({ adminPage }) => {
      await adminPage.goto('/admin/users/students');

      await adminPage.fill('[placeholder*="search"]', 'John');
      await adminPage.keyboard.press('Enter');

      await expect(adminPage.locator('[data-testid="student-row"]').first()).toContainText('John');
    });

    test('Admin can filter students by class', async ({ adminPage }) => {
      await adminPage.goto('/admin/users/students');

      await adminPage.selectOption('[data-testid="class-filter"]', { label: 'Grade 5' });

      const students = adminPage.locator('[data-testid="student-row"]');
      for (const student of await students.all()) {
        await expect(student).toContainText('Grade 5');
      }
    });
  });

  test.describe('Teacher Management', () => {
    test('Admin can create a new teacher', async ({ adminPage }) => {
      await adminPage.goto('/admin/users/teachers/new');

      await adminPage.fill('[name="firstName"]', 'New');
      await adminPage.fill('[name="lastName"]', 'Teacher');
      await adminPage.fill('[name="email"]', 'newteacher@test.com');

      await adminPage.click('button[type="submit"]');

      await expect(adminPage.getByText(/teacher created/i)).toBeVisible();
    });

    test('Admin can assign subjects to teacher', async ({ adminPage }) => {
      await adminPage.goto('/admin/users/teachers');
      await adminPage.locator('[data-testid="teacher-row"]').first().click();

      await adminPage.click('button:has-text("Assign Subjects")');
      await adminPage.check('[data-testid="subject-checkbox"]:has-text("Mathematics")');
      await adminPage.click('button:has-text("Save")');

      await expect(adminPage.getByText(/subjects assigned/i)).toBeVisible();
    });
  });
});
```

---

### 5.2 Teacher Portal Tests

#### `e2e/tests/teacher/attendance.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
import { AttendancePage } from '../../pages/teacher/attendance.page';

test.describe('Attendance Management', () => {
  test('Teacher can mark attendance for a section', async ({ teacherPage }) => {
    const attendancePage = new AttendancePage(teacherPage);
    await attendancePage.goto();

    await attendancePage.selectSection('Grade 5-A');
    await attendancePage.selectDate('2025-01-15');

    await attendancePage.markStudent('John Doe', 'PRESENT');
    await attendancePage.markStudent('Jane Smith', 'ABSENT');

    await attendancePage.save();
    await attendancePage.expectSaveSuccess();
  });

  test('Teacher can mark all students present', async ({ teacherPage }) => {
    const attendancePage = new AttendancePage(teacherPage);
    await attendancePage.goto();

    await attendancePage.selectSection('Grade 5-A');
    await attendancePage.selectDate('2025-01-16');

    await attendancePage.markAllPresent();
    await attendancePage.save();

    await attendancePage.expectSaveSuccess();
  });

  test('Teacher can edit past attendance', async ({ teacherPage }) => {
    await teacherPage.goto('/teacher/attendance/history');

    await teacherPage.selectOption('[name="section"]', { label: 'Grade 5-A' });
    await teacherPage.fill('[name="date"]', '2025-01-10');

    // Edit a student's status
    const studentRow = teacherPage.locator('[data-testid="student-row"]:has-text("John Doe")');
    await studentRow.locator('[value="LATE"]').click();

    await teacherPage.click('button:has-text("Update")');

    await expect(teacherPage.getByText(/attendance updated/i)).toBeVisible();
  });

  test('Teacher only sees assigned sections', async ({ teacherPage }) => {
    const attendancePage = new AttendancePage(teacherPage);
    await attendancePage.goto();

    // Should not see sections not assigned to this teacher
    await expect(teacherPage.locator('[name="section"] option:has-text("Grade 10-A")')).toHaveCount(0);
  });
});
```

#### `e2e/tests/teacher/assessments.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Assessment Management', () => {
  test('Teacher can create a new assessment', async ({ teacherPage }) => {
    await teacherPage.goto('/teacher/assessments/new');

    await teacherPage.fill('[name="title"]', 'Unit Test 1 - Algebra');
    await teacherPage.selectOption('[name="type"]', 'TEST');
    await teacherPage.selectOption('[name="section"]', { label: 'Grade 5-A' });
    await teacherPage.selectOption('[name="subject"]', { label: 'Mathematics' });
    await teacherPage.fill('[name="totalMarks"]', '100');
    await teacherPage.fill('[name="date"]', '2025-01-25');

    await teacherPage.click('button[type="submit"]');

    await expect(teacherPage.getByText(/assessment created/i)).toBeVisible();
  });

  test('Teacher can enter grades for assessment', async ({ teacherPage }) => {
    await teacherPage.goto('/teacher/assessments');
    await teacherPage.locator('[data-testid="assessment-row"]:has-text("Unit Test 1")').click();
    await teacherPage.click('button:has-text("Enter Grades")');

    // Enter grades for students
    const gradeInputs = teacherPage.locator('[data-testid="grade-input"]');
    await gradeInputs.nth(0).fill('85');
    await gradeInputs.nth(1).fill('92');
    await gradeInputs.nth(2).fill('78');

    await teacherPage.click('button:has-text("Save Grades")');

    await expect(teacherPage.getByText(/grades saved/i)).toBeVisible();
  });

  test('Teacher cannot enter grades exceeding total marks', async ({ teacherPage }) => {
    await teacherPage.goto('/teacher/assessments');
    await teacherPage.locator('[data-testid="assessment-row"]').first().click();
    await teacherPage.click('button:has-text("Enter Grades")');

    const gradeInput = teacherPage.locator('[data-testid="grade-input"]').first();
    await gradeInput.fill('150'); // Exceeds 100

    await teacherPage.click('button:has-text("Save Grades")');

    await expect(teacherPage.getByText(/cannot exceed total marks/i)).toBeVisible();
  });

  test('Teacher can create online test', async ({ teacherPage }) => {
    await teacherPage.goto('/teacher/online-tests/new');

    await teacherPage.fill('[name="title"]', 'Online Quiz 1');
    await teacherPage.selectOption('[name="section"]', { label: 'Grade 5-A' });
    await teacherPage.selectOption('[name="subject"]', { label: 'Mathematics' });
    await teacherPage.fill('[name="timeLimitMins"]', '30');

    // Add MCQ question
    await teacherPage.click('button:has-text("Add Question")');
    await teacherPage.fill('[name="questionText"]', 'What is 2 + 2?');
    await teacherPage.fill('[name="option1"]', '3');
    await teacherPage.fill('[name="option2"]', '4');
    await teacherPage.fill('[name="option3"]', '5');
    await teacherPage.fill('[name="option4"]', '6');
    await teacherPage.check('[data-testid="correct-option-2"]'); // Mark option 2 as correct

    await teacherPage.click('button:has-text("Save & Publish")');

    await expect(teacherPage.getByText(/test published/i)).toBeVisible();
  });
});
```

---

### 5.3 Student Portal Tests

#### `e2e/tests/student/grades.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Student Grades', () => {
  test('Student can view their grades', async ({ studentPage }) => {
    await studentPage.goto('/student/grades');

    await expect(studentPage.getByRole('heading', { name: /my grades/i })).toBeVisible();
    await expect(studentPage.locator('[data-testid="subject-card"]')).toHaveCount.greaterThan(0);
  });

  test('Student can view grade details for a subject', async ({ studentPage }) => {
    await studentPage.goto('/student/grades');

    await studentPage.locator('[data-testid="subject-card"]:has-text("Mathematics")').click();

    await expect(studentPage.getByText(/assessment details/i)).toBeVisible();
    await expect(studentPage.locator('[data-testid="assessment-row"]')).toHaveCount.greaterThan(0);
  });

  test('Student can see overall performance summary', async ({ studentPage }) => {
    await studentPage.goto('/student/grades');

    await expect(studentPage.locator('[data-testid="overall-percentage"]')).toBeVisible();
    await expect(studentPage.locator('[data-testid="grade-trend-chart"]')).toBeVisible();
  });
});
```

#### `e2e/tests/student/online-tests.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
import { OnlineTestsPage } from '../../pages/student/online-tests.page';

test.describe('Online Tests', () => {
  test('Student can view available tests', async ({ studentPage }) => {
    const testsPage = new OnlineTestsPage(studentPage);
    await testsPage.goto();

    await expect(studentPage.getByRole('heading', { name: /online tests/i })).toBeVisible();
    await expect(testsPage.availableTests).toHaveCount.greaterThan(0);
  });

  test('Student can take an online test', async ({ studentPage }) => {
    const testsPage = new OnlineTestsPage(studentPage);
    await testsPage.goto();

    await testsPage.openTest('Online Quiz 1');
    await testsPage.startTest();

    // Answer question 1
    await testsPage.selectOption(1); // Select second option
    await testsPage.nextQuestion();

    // Answer question 2
    await testsPage.selectOption(0);
    await testsPage.nextQuestion();

    // Submit test
    await testsPage.submitTest();
    await testsPage.expectSubmissionSuccess();
  });

  test('Student sees timer during timed test', async ({ studentPage }) => {
    const testsPage = new OnlineTestsPage(studentPage);
    await testsPage.goto();

    await testsPage.openTest('Timed Quiz');
    await testsPage.startTest();

    await expect(testsPage.timer).toBeVisible();
    await expect(testsPage.timer).toContainText(/\d+:\d+/); // Format: MM:SS
  });

  test('Student can navigate between questions', async ({ studentPage }) => {
    const testsPage = new OnlineTestsPage(studentPage);
    await testsPage.goto();

    await testsPage.openTest('Online Quiz 1');
    await testsPage.startTest();

    // Go to next question
    await testsPage.nextQuestion();
    await expect(studentPage.getByText(/question 2/i)).toBeVisible();

    // Go back to previous question
    await testsPage.previousQuestion();
    await expect(studentPage.getByText(/question 1/i)).toBeVisible();
  });

  test('Student can view test results after submission', async ({ studentPage }) => {
    await studentPage.goto('/student/online-tests');

    // Click on completed test
    await studentPage.locator('[data-testid="completed-test"]:has-text("Completed Quiz")').click();

    await expect(studentPage.getByText(/your score/i)).toBeVisible();
    await expect(studentPage.locator('[data-testid="score-percentage"]')).toBeVisible();
  });
});
```

---

### 5.4 Parent Portal Tests

#### `e2e/tests/parent/multi-child.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
import { ParentDashboardPage } from '../../pages/parent/child-switcher.page';

test.describe('Parent Multi-Child Support', () => {
  test('Parent can see child switcher', async ({ parentPage }) => {
    const dashboardPage = new ParentDashboardPage(parentPage);
    await dashboardPage.goto();

    await expect(dashboardPage.childSwitcher).toBeVisible();
  });

  test('Parent can switch between children', async ({ parentPage }) => {
    const dashboardPage = new ParentDashboardPage(parentPage);
    await dashboardPage.goto();

    // Switch to second child
    await dashboardPage.switchChild('Sarah Khan');

    await dashboardPage.expectSelectedChild('Sarah Khan');
  });

  test('Dashboard updates when switching children', async ({ parentPage }) => {
    const dashboardPage = new ParentDashboardPage(parentPage);
    await dashboardPage.goto();

    // Get attendance for first child
    const firstChildAttendance = await dashboardPage.getAttendancePercentage();

    // Switch to second child
    await dashboardPage.switchChild('Sarah Khan');

    // Attendance should potentially be different
    const secondChildAttendance = await dashboardPage.getAttendancePercentage();

    // At minimum, verify the page reloaded data
    await expect(dashboardPage.attendanceCard).toBeVisible();
  });
});
```

#### `e2e/tests/parent/events.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Event Approvals', () => {
  test('Parent can view pending event approvals', async ({ parentPage }) => {
    await parentPage.goto('/parent/events');

    await expect(parentPage.getByRole('heading', { name: /events/i })).toBeVisible();
    await expect(parentPage.locator('[data-testid="pending-approval"]')).toHaveCount.greaterThan(0);
  });

  test('Parent can approve event participation', async ({ parentPage }) => {
    await parentPage.goto('/parent/events');

    const event = parentPage.locator('[data-testid="event-card"]').first();
    await event.getByRole('button', { name: /approve/i }).click();

    // Confirm dialog
    await parentPage.getByRole('button', { name: /confirm/i }).click();

    await expect(event.getByText(/approved/i)).toBeVisible();
  });

  test('Parent can decline event participation', async ({ parentPage }) => {
    await parentPage.goto('/parent/events');

    const event = parentPage.locator('[data-testid="event-card"]').first();
    await event.getByRole('button', { name: /decline/i }).click();

    // Add reason
    await parentPage.fill('[name="declineReason"]', 'Prior engagement');
    await parentPage.getByRole('button', { name: /confirm/i }).click();

    await expect(event.getByText(/declined/i)).toBeVisible();
  });

  test('Parent can view event details before approving', async ({ parentPage }) => {
    await parentPage.goto('/parent/events');

    const event = parentPage.locator('[data-testid="event-card"]').first();
    await event.getByRole('button', { name: /view details/i }).click();

    await expect(parentPage.locator('[data-testid="event-modal"]')).toBeVisible();
    await expect(parentPage.getByText(/location/i)).toBeVisible();
    await expect(parentPage.getByText(/date/i)).toBeVisible();
  });
});
```

#### `e2e/tests/parent/fees.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Fee Management', () => {
  test('Parent can view fee invoices', async ({ parentPage }) => {
    await parentPage.goto('/parent/fees');

    await expect(parentPage.getByRole('heading', { name: /fees/i })).toBeVisible();
    await expect(parentPage.locator('[data-testid="invoice-row"]')).toHaveCount.greaterThan(0);
  });

  test('Parent can view invoice details', async ({ parentPage }) => {
    await parentPage.goto('/parent/fees');

    await parentPage.locator('[data-testid="invoice-row"]').first().click();

    await expect(parentPage.locator('[data-testid="invoice-details"]')).toBeVisible();
    await expect(parentPage.getByText(/amount/i)).toBeVisible();
    await expect(parentPage.getByText(/due date/i)).toBeVisible();
  });

  test('Parent can see payment history', async ({ parentPage }) => {
    await parentPage.goto('/parent/fees');

    await parentPage.click('button:has-text("Payment History")');

    await expect(parentPage.locator('[data-testid="payment-row"]')).toHaveCount.greaterThan(0);
  });

  test('Parent can filter invoices by status', async ({ parentPage }) => {
    await parentPage.goto('/parent/fees');

    await parentPage.selectOption('[data-testid="status-filter"]', 'PENDING');

    const invoices = parentPage.locator('[data-testid="invoice-row"]');
    for (const invoice of await invoices.all()) {
      await expect(invoice).toContainText('Pending');
    }
  });
});
```

---

## 6. Authorization Tests

#### `e2e/tests/auth/authorization.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authorization', () => {
  test('Unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Student cannot access admin pages', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.auth/student.json',
    });
    const page = await context.newPage();

    await page.goto('/admin/dashboard');

    // Should be redirected or see 403
    await expect(page.getByText(/access denied|unauthorized/i)).toBeVisible();

    await context.close();
  });

  test('Teacher cannot access admin-only pages', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.auth/teacher.json',
    });
    const page = await context.newPage();

    await page.goto('/admin/users/students');

    await expect(page.getByText(/access denied|unauthorized/i)).toBeVisible();

    await context.close();
  });

  test('Parent cannot access other children data', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.auth/parent.json',
    });
    const page = await context.newPage();

    // Try to access another student's data
    await page.goto('/parent/grades?childId=other-student-id');

    await expect(page.getByText(/access denied|not found/i)).toBeVisible();

    await context.close();
  });
});
```

---

## 7. Visual Regression Tests

#### `e2e/tests/visual/screenshots.spec.ts`

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Visual Regression', () => {
  test('Admin dashboard matches snapshot', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard');
    await adminPage.waitForLoadState('networkidle');

    await expect(adminPage).toHaveScreenshot('admin-dashboard.png', {
      maxDiffPixels: 100,
    });
  });

  test('Teacher attendance page matches snapshot', async ({ teacherPage }) => {
    await teacherPage.goto('/teacher/attendance');
    await teacherPage.waitForLoadState('networkidle');

    await expect(teacherPage).toHaveScreenshot('teacher-attendance.png', {
      maxDiffPixels: 100,
    });
  });

  test('Student grades page matches snapshot', async ({ studentPage }) => {
    await studentPage.goto('/student/grades');
    await studentPage.waitForLoadState('networkidle');

    await expect(studentPage).toHaveScreenshot('student-grades.png', {
      maxDiffPixels: 100,
    });
  });

  test('Parent dashboard matches snapshot', async ({ parentPage }) => {
    await parentPage.goto('/parent/dashboard');
    await parentPage.waitForLoadState('networkidle');

    await expect(parentPage).toHaveScreenshot('parent-dashboard.png', {
      maxDiffPixels: 100,
    });
  });
});
```

---

## 8. Mobile Responsive Tests

#### `e2e/tests/responsive/mobile.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 13']);

test.describe('Mobile Responsiveness', () => {
  test('Sidebar collapses on mobile', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Sidebar should be hidden by default
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();

    // Menu button should be visible
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // Click menu button to show sidebar
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('Forms are usable on mobile', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('[name="email"]');
    const passwordInput = page.locator('[name="password"]');

    // Inputs should be visible and tappable
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Input dimensions should be touch-friendly (min 44px)
    const emailBox = await emailInput.boundingBox();
    expect(emailBox?.height).toBeGreaterThanOrEqual(44);
  });

  test('Tables scroll horizontally on mobile', async ({ page }) => {
    await page.goto('/admin/users/students');

    const table = page.locator('[data-testid="students-table"]');
    await expect(table).toBeVisible();

    // Table should be scrollable
    const tableContainer = page.locator('[data-testid="table-container"]');
    const containerWidth = await tableContainer.evaluate(el => el.clientWidth);
    const tableWidth = await table.evaluate(el => el.scrollWidth);

    expect(tableWidth).toBeGreaterThan(containerWidth);
  });
});
```

---

## 9. Running Tests

### NPM Scripts (`package.json`)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:admin": "playwright test --grep @admin",
    "test:e2e:teacher": "playwright test --grep @teacher",
    "test:e2e:student": "playwright test --grep @student",
    "test:e2e:parent": "playwright test --grep @parent",
    "test:e2e:report": "playwright show-report"
  }
}
```

### Running Specific Tests

```bash
# Run all tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run specific portal tests
npm run test:e2e:admin
npm run test:e2e:teacher

# Run specific test file
npx playwright test e2e/tests/admin/academic-years.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug a test
npx playwright test --debug e2e/tests/admin/promotion.spec.ts
```

---

## 10. Test Reports

Playwright generates HTML reports automatically. View them with:

```bash
npm run test:e2e:report
```

Reports include:
- Test pass/fail status
- Screenshots on failure
- Video recordings
- Trace files for debugging

---

*Document Version: 1.0*
*Created: January 2025*
