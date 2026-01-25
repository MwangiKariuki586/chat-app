import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

/**
 * Authentication setup - runs before all tests
 * This logs in once and saves the authentication state for reuse
 */
setup('authenticate', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Wait for the login form to be visible (heading 'Welcome Back' or 'Create Account')
    // Depending on default state, it's usually 'Welcome Back'
    // But let's be robust
    await expect(page.getByRole('heading', { name: /welcome back|sign in|log in/i })).toBeVisible();

    // Fill in test credentials
    // Note: These should be test account credentials from your Supabase test environment
    const testEmail = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_PASSWORD || 'testpassword123';

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);

    // Click sign in button
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation to chat dashboard (ROOT)
    // Use regex to match root
    await page.waitForURL(/\/$/);

    // Verify we're logged in by checking for dashboard elements
    // Sidebar or conversation list
    await expect(page.locator('.conversation-list, [class*="sidebar"], aside').first()).toBeVisible();

    // Save authentication state
    await page.context().storageState({ path: authFile });
});
