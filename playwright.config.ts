import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const isProd = process.env.PROD === '1';
const rawBaseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

const schoolSubdomain = process.env.PLAYWRIGHT_SCHOOL_SUBDOMAIN ?? "";

const parsedBase = new URL(rawBaseURL);
if (schoolSubdomain && parsedBase.hostname === "localhost") {
  parsedBase.hostname = `${schoolSubdomain}.localhost`;
}

const baseURL = parsedBase.toString().replace(/\/$/, "");

const parsed = new URL(baseURL);
const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  outputDir: ".playwright/test-results",
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isProd
      ? `npm run start -- -p ${port}`
      : `npm run dev -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
