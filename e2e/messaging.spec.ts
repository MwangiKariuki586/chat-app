import { test, expect } from '@playwright/test';

test.describe('Messaging Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should send a message', async ({ page }) => {
        // Select a conversation first
        const conversationItem = page.locator('button.conversation-item').first();

        if (await conversationItem.isVisible().catch(() => false)) {
            await conversationItem.click();
            await page.waitForTimeout(500); // Wait for chat to load
        }

        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);


        if (!await messageInput.isVisible().catch(() => false)) {
            // No input visible, try to select a conversation
            const conversationItem = page.locator('button.conversation-item').first();

            if (await conversationItem.isVisible().catch(() => false)) {
                await conversationItem.click();
            } else {
                // Try to create a new chat
                const newChatButton = page.getByRole('button', { name: /new chat|start chat/i })
                    .or(page.getByTitle('New Chat'))
                    .or(page.locator('.new-chat-btn'))
                    .or(page.locator('.start-chat-btn'));

                if (await newChatButton.first().isVisible().catch(() => false)) {
                    await newChatButton.first().click();
                    const firstUser = page.locator('.user-item').first();
                    if (await firstUser.isVisible().catch(() => false)) {
                        await firstUser.click();
                    } else {
                        test.skip(true, 'No users available to chat with');
                        return;
                    }
                } else {
                    test.skip(true, 'No conversation available and cannot create new one');
                    return;
                }
            }
        }

        // Generate unique message to verify it appears
        const testMessage = `E2E Test Message ${Date.now()}`;

        // Type and send message
        await messageInput.fill(testMessage);

        // Send via Enter key
        await messageInput.press('Enter');

        // Wait for message to appear in the chat
        await expect(page.getByText(testMessage)).toBeVisible();
    });

    test('should show message in conversation', async ({ page }) => {
        const conversationItem = page.locator('button.conversation-item').first();

        if (!await conversationItem.isVisible().catch(() => false)) {
            test.skip(true, 'No conversations available');
            return;
        }

        await conversationItem.click();

        // Should show message area
        const messageArea = page.locator('.messages, [class*="message-list"], [class*="chat-window"]');
        await expect(messageArea).toBeVisible();
    });

    test('should support Shift+Enter for new lines', async ({ page }) => {
        const conversationItem = page.locator('button.conversation-item').first();

        if (await conversationItem.isVisible().catch(() => false)) {
            await conversationItem.click();
        }

        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);


        if (!await messageInput.isVisible().catch(() => false)) {
            test.skip(true, 'No message input available');
            return;
        }

        // Type first line
        await messageInput.fill('Line 1');

        // Press Shift+Enter for new line
        await messageInput.press('Shift+Enter');

        // Type second line
        await messageInput.type('Line 2');

        // Verify textarea has newline
        const value = await messageInput.inputValue();
        expect(value).toContain('\n');
        expect(value).toContain('Line 1');
        expect(value).toContain('Line 2');
    });

    test('should clear input after sending', async ({ page }) => {
        const conversationItem = page.locator('button.conversation-item').first();

        if (await conversationItem.isVisible().catch(() => false)) {
            await conversationItem.click();
        }

        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);


        if (!await messageInput.isVisible().catch(() => false)) {
            test.skip(true, 'No message input available');
            return;
        }

        // Type and send
        await messageInput.fill('Test message to clear');
        await messageInput.press('Enter');

        // Input should be cleared
        await expect(messageInput).toHaveValue('', { timeout: 10000 });
    });
});

test.describe('Conversation Selection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should highlight selected conversation', async ({ page }) => {
        const conversations = page.locator('button.conversation-item');
        const count = await conversations.count();

        if (count === 0) {
            test.skip(true, 'No conversations available');
            return;
        }

        // Click first conversation
        await conversations.first().click();

        // Should have active/selected class
        await expect(conversations.first()).toHaveClass(/active|selected/i);
    });

    test('should switch between conversations', async ({ page }) => {
        const conversations = page.locator('button.conversation-item');
        const count = await conversations.count();

        if (count < 2) {
            test.skip(true, 'Need at least 2 conversations to test switching');
            return;
        }

        // Click first conversation
        await conversations.first().click();
        await page.waitForTimeout(500);

        // Click second conversation
        await conversations.nth(1).click();

        // Second should now be active
        await expect(conversations.nth(1)).toHaveClass(/active|selected/i);
    });
});
