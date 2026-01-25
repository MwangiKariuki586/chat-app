import { test, expect } from '@playwright/test';

test.describe('Input Validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should not send empty message', async ({ page }) => {
        const conversationItem = page.locator('button.conversation-item').first();

        if (!await conversationItem.isVisible().catch(() => false)) {
            test.skip(true, 'No conversations available');
            return;
        }

        await conversationItem.click();
        await page.waitForTimeout(500);

        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);
        const sendButton = page.locator('.send-button');

        // Send button should be disabled when input is empty
        await expect(sendButton).toBeDisabled();

        // Try typing only whitespace
        await messageInput.fill('   ');
        await expect(sendButton).toBeDisabled();
    });

    test('should show character count near limit', async ({ page }) => {
        const conversationItem = page.locator('button.conversation-item').first();

        if (!await conversationItem.isVisible().catch(() => false)) {
            test.skip(true, 'No conversations available');
            return;
        }

        await conversationItem.click();
        await page.waitForTimeout(500);

        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);

        // Type a very long message (over 90% of limit)
        const longText = 'a'.repeat(3700);
        await messageInput.fill(longText);

        // Character count should be visible
        const charCount = page.locator('.char-count');
        await expect(charCount).toBeVisible();
    });

    test('should have max length on message input', async ({ page }) => {
        const conversationItem = page.locator('button.conversation-item').first();

        if (!await conversationItem.isVisible().catch(() => false)) {
            test.skip(true, 'No conversations available');
            return;
        }

        await conversationItem.click();
        await page.waitForTimeout(500);

        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);

        // Check maxlength attribute exists
        const maxLength = await messageInput.getAttribute('maxlength');
        expect(maxLength).toBe('4000');
    });

    test('should have aria attributes for accessibility', async ({ page }) => {
        const conversationItem = page.locator('button.conversation-item').first();

        if (!await conversationItem.isVisible().catch(() => false)) {
            test.skip(true, 'No conversations available');
            return;
        }

        await conversationItem.click();
        await page.waitForTimeout(500);

        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);

        // Check aria-label
        const ariaLabel = await messageInput.getAttribute('aria-label');
        expect(ariaLabel).toBe('Message input');
    });
});
