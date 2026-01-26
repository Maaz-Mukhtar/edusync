import { test, expect } from '@playwright/test';

// Configuration
const CREDENTIALS = {
  email: process.env.PLAYWRIGHT_EMAIL || 'admin@sns.edupal.com',
  password: process.env.PLAYWRIGHT_PASSWORD || 'password',
};

const DASHBOARD_PATH = process.env.PLAYWRIGHT_DASHBOARD_PATH || '/admin';

// Pages to test
const PAGES = [
  { name: 'Dashboard', path: DASHBOARD_PATH },
  { name: 'Attendance', path: `${DASHBOARD_PATH}/attendance` },
  { name: 'Students', path: `${DASHBOARD_PATH}/students` },
  { name: 'Classes', path: `${DASHBOARD_PATH}/classes` },
  { name: 'Subjects', path: `${DASHBOARD_PATH}/subjects` },
];

// Number of times to run each navigation for averaging
const ITERATIONS = 3;

interface TimingResult {
  page: string;
  times: number[];
  average: number;
  min: number;
  max: number;
}

// Increase test timeout
test.setTimeout(120000);

test.describe('Page Load Performance Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.waitForLoadState('load');

    // Fill login form using id selectors
    await page.fill('#email', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);

    // Submit and wait for navigation
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`**${DASHBOARD_PATH}**`, { timeout: 30000 });
    await page.waitForLoadState('load');
  });

  test('Measure page navigation times', async ({ page }) => {
    const results: TimingResult[] = [];

    console.log('\n========================================');
    console.log('  PERFORMANCE TEST RESULTS');
    console.log('  Branch: ' + (process.env.GIT_BRANCH || 'unknown'));
    console.log('========================================\n');

    // Test each page
    for (const targetPage of PAGES) {
      const times: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        // Start from dashboard to ensure consistent starting point
        await page.goto(DASHBOARD_PATH);
        await page.waitForLoadState('load');
        await page.waitForSelector('h1', { timeout: 15000 });

        // Measure navigation time
        const startTime = Date.now();

        await page.goto(targetPage.path);

        // Wait for the page to be fully loaded (no loading skeletons)
        await page.waitForLoadState('load');

        // Also wait for any skeleton elements to disappear
        try {
          await page.waitForSelector('[class*="skeleton"]', { state: 'hidden', timeout: 10000 });
        } catch {
          // No skeletons found or already hidden
        }

        // Wait for main content to appear
        await page.waitForSelector('h1', { timeout: 15000 });

        const endTime = Date.now();
        const loadTime = endTime - startTime;

        times.push(loadTime);
        console.log(`  ${targetPage.name} (run ${i + 1}): ${loadTime}ms`);
      }

      const average = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const min = Math.min(...times);
      const max = Math.max(...times);

      results.push({
        page: targetPage.name,
        times,
        average,
        min,
        max,
      });
    }

    // Print summary
    console.log('\n========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log('\n  Page           | Avg (ms) | Min (ms) | Max (ms)');
    console.log('  ---------------|----------|----------|----------');

    let totalAverage = 0;
    for (const result of results) {
      console.log(`  ${result.page.padEnd(14)} | ${String(result.average).padStart(8)} | ${String(result.min).padStart(8)} | ${String(result.max).padStart(8)}`);
      totalAverage += result.average;
    }

    console.log('  ---------------|----------|----------|----------');
    console.log(`  ${'TOTAL'.padEnd(14)} | ${String(totalAverage).padStart(8)} |          |`);
    console.log('\n========================================\n');

    // Write results to JSON file for comparison
    const fs = await import('fs');
    const branchName = process.env.GIT_BRANCH || 'unknown';
    if (branchName !== 'unknown') {
      const resultFile = `tests/results-${branchName.replace(/\//g, '-')}.json`;

      fs.writeFileSync(resultFile, JSON.stringify({
        branch: branchName,
        timestamp: new Date().toISOString(),
        iterations: ITERATIONS,
        results,
        totalAverage,
      }, null, 2));

      console.log(`  Results saved to: ${resultFile}\n`);
    } else {
      console.log(`  Results file skipped (set GIT_BRANCH to save)\n`);
    }

    // Basic assertion to ensure test passes
    expect(totalAverage).toBeLessThan(60000); // Should complete in under 60 seconds total
  });

  test('Sequential navigation flow (Dashboard -> Attendance -> Gradebook -> Assessments)', async ({ page }) => {
    const navigationTimes: { from: string; to: string; time: number }[] = [];

    console.log('\n========================================');
    console.log('  SEQUENTIAL NAVIGATION TEST');
    console.log('========================================\n');

    const flow = [
      { name: 'Dashboard', path: DASHBOARD_PATH },
      { name: 'Attendance', path: `${DASHBOARD_PATH}/attendance` },
      { name: 'Students', path: `${DASHBOARD_PATH}/students` },
      { name: 'Classes', path: `${DASHBOARD_PATH}/classes` },
    ];

    // Start at dashboard
    await page.goto(DASHBOARD_PATH);
    await page.waitForLoadState('load');
    await page.waitForSelector('h1', { timeout: 15000 });

    let previousPage = 'Dashboard';

    for (let i = 1; i < flow.length; i++) {
      const targetPage = flow[i];

      const startTime = Date.now();

      // Click the navigation link
      await page.click(`a[href="${targetPage.path}"]`);

      // Wait for navigation and content
      await page.waitForURL(`**${targetPage.path}**`, { timeout: 15000 });
      await page.waitForLoadState('load');

      // Wait for skeletons to disappear
      try {
        await page.waitForSelector('[class*="skeleton"]', { state: 'hidden', timeout: 10000 });
      } catch {
        // No skeletons or already hidden
      }

      await page.waitForSelector('h1', { timeout: 15000 });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      navigationTimes.push({
        from: previousPage,
        to: targetPage.name,
        time: loadTime,
      });

      console.log(`  ${previousPage} -> ${targetPage.name}: ${loadTime}ms`);
      previousPage = targetPage.name;
    }

    const totalTime = navigationTimes.reduce((sum, n) => sum + n.time, 0);

    console.log('\n  ----------------------------------------');
    console.log(`  Total navigation time: ${totalTime}ms`);
    console.log('========================================\n');

    expect(totalTime).toBeLessThan(30000); // Should complete in under 30 seconds
  });
});
