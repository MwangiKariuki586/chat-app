import { supabase } from '@/lib/supabase';

interface QueuedMessage {
    id: string;
    conversationId: string;
    content: string;
    createdAt: string;
    retryCount: number;
}

const STORAGE_KEY = 'chat_offline_queue';
const MAX_RETRIES = 3;

/**
 * Get queued messages from localStorage
 */
export function getOfflineQueue(): QueuedMessage[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Save a message to the offline queue
 */
export function addToOfflineQueue(message: Omit<QueuedMessage, 'retryCount'>): void {
    const queue = getOfflineQueue();
    queue.push({ ...message, retryCount: 0 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/**
 * Remove a message from the offline queue
 */
export function removeFromOfflineQueue(messageId: string): void {
    const queue = getOfflineQueue();
    const filtered = queue.filter((m) => m.id !== messageId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Clear the entire offline queue
 */
export function clearOfflineQueue(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Update retry count for a message
 */
export function incrementRetryCount(messageId: string): void {
    const queue = getOfflineQueue();
    const updated = queue.map((m) =>
        m.id === messageId ? { ...m, retryCount: m.retryCount + 1 } : m
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Process the offline queue when coming back online
 */
export async function processOfflineQueue(
    onMessageSent?: (messageId: string) => void,
    onMessageFailed?: (messageId: string, error: Error) => void
): Promise<void> {
    const queue = getOfflineQueue();

    if (queue.length === 0) {
        console.log('📤 Offline queue is empty');
        return;
    }

    console.log(`📤 Processing ${queue.length} queued messages...`);

    for (const message of queue) {
        if (message.retryCount >= MAX_RETRIES) {
            console.warn(`📤 Message ${message.id} exceeded max retries, removing`);
            removeFromOfflineQueue(message.id);
            onMessageFailed?.(message.id, new Error('Max retries exceeded'));
            continue;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.warn('📤 Not authenticated, stopping queue processing');
                break;
            }

            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: message.conversationId,
                    sender_id: user.id,
                    content: message.content,
                });

            if (error) {
                throw error;
            }

            console.log(`📤 Successfully sent queued message: ${message.id}`);
            removeFromOfflineQueue(message.id);
            onMessageSent?.(message.id);
        } catch (error) {
            console.error(`📤 Failed to send queued message: ${message.id}`, error);
            incrementRetryCount(message.id);
            onMessageFailed?.(message.id, error as Error);
        }
    }
}

/**
 * Check if there are pending messages in the queue
 */
export function hasOfflineMessages(): boolean {
    return getOfflineQueue().length > 0;
}

/**
 * Get the count of pending messages
 */
export function getOfflineMessageCount(): number {
    return getOfflineQueue().length;
}
