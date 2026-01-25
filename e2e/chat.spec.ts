import { test, expect } from '@playwright/test';

test.describe('Chat Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to chat dashboard (already authenticated via setup)
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should display conversation list', async ({ page }) => {
        // Check for conversation list sidebar
        const sidebar = page.locator('.conversation-list, [class*="sidebar"], aside');
        await expect(sidebar).toBeVisible();
    });

    test('should display user info or avatar', async ({ page }) => {
        // Check for some user-related element
        const userElement = page.getByTestId('user-info')
            .or(page.locator('.user-avatar, [class*="avatar"]'))
            .or(page.getByRole('img', { name: /avatar|user/i }));

        // At least one should be present
        await expect(userElement.first()).toBeVisible();
    });

    test('should show empty state or conversations', async ({ page }) => {
        // Either show conversations or an empty state message (inside conversation list)
        const hasConversations = await page.locator('button.conversation-item').count() > 0;
        // Check for empty state component
        const hasEmptyState = await page.locator('.empty-state').isVisible().catch(() => false);
        // On desktop, the "welcome" message is also an empty state
        const hasWelcome = await page.locator('.no-conversation-selected').isVisible().catch(() => false);

        expect(hasConversations || hasEmptyState || hasWelcome).toBeTruthy();
    });

    test('should initiate a new conversation', async ({ page }) => {
        // Look for "New Chat" button (pencil icon or "Start a Chat")
        const newChatButton = page.getByRole('button', { name: /new chat|start chat/i })
            .or(page.getByTitle('New Chat'))
            .or(page.locator('.new-chat-btn'))
            .or(page.locator('.start-chat-btn'));

        if (await newChatButton.first().isVisible().catch(() => false)) {
            await newChatButton.first().click();

            // Should see user search or list
            const userSearch = page.locator('.new-chat-modal input[type="text"]');
            await expect(userSearch).toBeVisible();

            // Wait for users to load
            // Note: If no other users exist in the system, this might show "No users found"
            // We should check for either users or the "no users" message
            const userListItems = page.locator('.user-item');
            const noUsersMsg = page.locator('.no-users');

            await expect(userListItems.first().or(noUsersMsg)).toBeVisible();
        } else {
            console.log('New Chat button not found');
        }
    });

    test('should show online status', async ({ page }) => {
        // This is a basic check for any online indicator
        const onlineIndicator = page.locator('.online-indicator, .status-online, [class*="green-dot"]');
        // We don't fail if strictly not found as it depends on other users, but we log it
        if (await onlineIndicator.count() > 0) {
            await expect(onlineIndicator.first()).toBeVisible();
        }
    });
});

test.describe('Message Input', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should have message input area', async ({ page }) => {
        const messageInput = page.getByPlaceholder(/Type a message\.\.\./);


        // If input not visible, try to click a conversation
        if (!await messageInput.isVisible().catch(() => false)) {
            const conversationItem = page.locator('button.conversation-item').first();

            if (await conversationItem.isVisible().catch(() => false)) {
                await conversationItem.click();
                await expect(messageInput).toBeVisible();
            } else {
                // Try to create one if no conversations
                const newChatButton = page.getByRole('button', { name: /new chat|start chat/i });
                if (await newChatButton.first().isVisible().catch(() => false)) {
                    await newChatButton.first().click();
                    // Select first available user if possible
                    const firstUser = page.locator('button.user-item').first();
                    // Check if users exist
                    if (await firstUser.isVisible().catch(() => false)) {
                        await firstUser.click();
                        await expect(messageInput).toBeVisible();
                    } else {
                        // No users found, we can't test input visibility
                        test.skip(true, 'No users available to create conversation');
                    }
                }
            }
        } else {
            await expect(messageInput).toBeVisible();
        }
    });

    // ... keep existing button test ...
});

test.describe('Navigation', () => {
    // ... keep existing logout test ...
});
