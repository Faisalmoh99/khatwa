import { defineConfig, devices } from '@playwright/test';

/**
 * iPhone-sized viewport (390x844) in Arabic RTL, served from the production build.
 * E2E_BASE_URL=https://… runs the suite against a live deploy instead (no local server).
 */
const LIVE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  // Tests tagged @firebase need the internet and write sim data to Firebase. Run with E2E_FIREBASE=1.
  grepInvert: process.env.E2E_FIREBASE ? undefined : /@firebase/,
  grep: process.env.E2E_FIREBASE ? /@firebase/ : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: LIVE ?? 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: LIVE
    ? undefined
    : {
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
