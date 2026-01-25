import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// Load .env.e2e if it exists, otherwise fall back to .env
// We definitely want to override any existing process.env vars if they are set in these files for testing
const e2eEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e') });
const envEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Playwright configuration for Chat App E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './e2e',

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,

    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
        ['html', { open: 'never' }],
        ['list'],
    ],

    /* Global timeout for each test */
    timeout: 30000,

    /* Expect timeout */
    expect: {
        timeout: 15000,
    },

    /* Shared settings for all the projects below. */
    use: {
        /* Base URL for the app */
        baseURL: 'http://localhost:5173',

        /* Collect trace when retrying the failed test. */
        trace: 'on-first-retry',

        /* Screenshot on failure */
        screenshot: 'only-on-failure',

        /* Video recording */
        video: 'on-first-retry',
    },

    /* Configure projects for major browsers */
    projects: [
        // Auth setup - runs before other tests
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },

        // Main test project - uses Chromium by default
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        // Firefox tests
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        // Mobile Chrome tests
        {
            name: 'mobile',
            use: {
                ...devices['Pixel 5'],
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
