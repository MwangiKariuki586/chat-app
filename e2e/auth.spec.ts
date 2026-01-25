import { test, expect } from '@playwright/test';

// Reset storage state for this file to ensure tests start unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
    test('should show login page', async ({ browser }) => {
        // Use fresh context without auth
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('/login');

        // Check for login form elements
        await expect(page.getByRole('heading', { name: /welcome back|sign in|log in/i })).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

        await context.close();
    });

    test('should show error for invalid credentials', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('/login');

        // Fill with invalid credentials
        await page.getByLabel(/email/i).fill('invalid@example.com');
        await page.getByLabel(/password/i).fill('wrongpassword');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should show error message - use a broader check on the whole page or alert
        // Wait for potential network timeout or error
        await expect(page.getByText(/invalid|error|incorrect|failed/i).first()).toBeVisible({ timeout: 20000 });

        await context.close();
    });

    test('should have toggle for registration', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('/login');

        // Should have sign up toggle button
        const signUpToggle = page.getByRole('button', { name: /sign up|register|create account/i });
        await expect(signUpToggle).toBeVisible();

        await context.close();
    });

    test('should switch to registration mode', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('/login');

        // Click toggle
        await page.getByRole('button', { name: /sign up|register|create account/i }).click();

        // Check for registration form elements
        await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/password/i).first()).toBeVisible();
        await expect(page.getByLabel(/name/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();

        await context.close();
    });

    test('should logout successfully', async ({ page, context }) => {
        // First login
        await page.goto('/login');
        await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL || 'test@example.com');
        await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD || 'testpassword123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(/\/$/);

        // Wait for chat dashboard to load 
        await page.waitForSelector('.chat-dashboard', { timeout: 10000 });

        // Now perform logout - look for the specific sign-out button
        const logoutButton = page.locator('button.sign-out-btn');

        await expect(logoutButton).toBeVisible({ timeout: 10000 });
        await logoutButton.click();

        // Should redirect to login page
        await expect(page).toHaveURL(/login|signin|auth/i, { timeout: 10000 });

        // Clear the storage for this test
        await context.clearCookies();
    });
});

test.describe('Protected Routes', () => {
    test('should redirect root to login when not authenticated', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('/');

        // Should redirect to login
        await expect(page).toHaveURL(/login/i);

        await context.close();
    });

    test('should stay on root when authenticated', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL || 'test@example.com');
        await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD || 'testpassword123');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Wait for redirect
        await page.waitForURL(/\/$/);

        // Should NOT redirect to login (we're authenticated)
        // Check finding an element present in dashboard
        // On mobile 'no-conversation-selected' is hidden, so we check for the main header
        await expect(page.getByRole('heading', { name: /chat|messages/i }).first()).toBeVisible();
    });
});
