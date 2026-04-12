import { authSession } from '@/services/authSession';
import { chatRepository } from '@/services/chatRepository';
import { offlineQueueStore } from '@/services/offlineQueueStore';
import { useMessageStore, useConversationStore } from '@/stores';
import { beginDirectConversationByUserId } from '@/services/chatController';
import { logWarn } from '@/lib/logger';

const MAX_RETRIES = 3;
type SyncListener = (isSyncing: boolean) => void;

class OfflineQueueCoordinator {
    private syncPromise: Promise<void> | null = null;
    private listeners = new Set<SyncListener>();
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    subscribe(listener: SyncListener) {
        this.listeners.add(listener);
        listener(Boolean(this.syncPromise));

        return () => {
            this.listeners.delete(listener);
        };
    }

    isSyncing() {
        return Boolean(this.syncPromise);
    }

    async sync() {
        this.clearRetryTimer();

        if (this.syncPromise) {
            return this.syncPromise;
        }

        this.emit(true);
        this.syncPromise = this.runSync().finally(() => {
            this.syncPromise = null;
            this.emit(false);
        });

        return this.syncPromise;
    }

    private async runSync() {
        const userId = authSession.getCurrentUserId();
        if (!userId || !offlineQueueStore.isOnline()) {
            return;
        }

        for (const item of offlineQueueStore.getItems()) {
            if (item.retryCount >= MAX_RETRIES) {
                useMessageStore.getState().setMessageStatus(item.conversationId, item.id, 'failed', 'Max retries exceeded');
                offlineQueueStore.remove(item.id);
                continue;
            }

            offlineQueueStore.update(item.id, (current) => ({
                ...current,
                status: 'syncing',
            }));

            let conversationId = item.conversationId;

            if (conversationId.startsWith('temp-chat-')) {
                const otherUserId = conversationId.replace('temp-chat-', '');
                const resolved = await beginDirectConversationByUserId(otherUserId);
                if (!resolved.data) {
                    offlineQueueStore.update(item.id, (current) => ({
                        ...current,
                        retryCount: current.retryCount + 1,
                        status: 'pending',
                    }));
                    continue;
                }

                useConversationStore.getState().removeConversation(conversationId);
                conversationId = resolved.data.id;
            }

            const result = await chatRepository.sendMessage({
                conversationId,
                senderId: userId,
                content: item.content,
            });

            if (result.error || !result.data) {
                offlineQueueStore.update(item.id, (current) => ({
                    ...current,
                    retryCount: current.retryCount + 1,
                    status: current.retryCount + 1 >= MAX_RETRIES ? 'failed' : 'pending',
                }));

                if (item.retryCount + 1 >= MAX_RETRIES) {
                    useMessageStore.getState().setMessageStatus(conversationId, item.id, 'failed', result.error?.message || 'Failed to sync message');
                    offlineQueueStore.remove(item.id);
                }

                continue;
            }

            useMessageStore.getState().replaceTempMessage(conversationId, item.id, result.data);
            useConversationStore.getState().updateLastMessage(conversationId, result.data);
            offlineQueueStore.remove(item.id);
        }

        this.scheduleRetryIfNeeded();
    }

    reset() {
        if (this.syncPromise) {
            logWarn('offline-queue', 'Resetting queue sync while a sync was in flight');
        }
        this.syncPromise = null;
        this.clearRetryTimer();
        this.emit(false);
    }

    requestSyncSoon(delayMs = 1000) {
        if (this.syncPromise || this.retryTimer || !offlineQueueStore.isOnline() || !authSession.getCurrentUserId()) {
            return;
        }

        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.sync();
        }, delayMs);
    }

    private scheduleRetryIfNeeded() {
        const hasPending = offlineQueueStore
            .getItems()
            .some((item) => item.status === 'pending' && item.retryCount < MAX_RETRIES);

        if (!hasPending || !offlineQueueStore.isOnline() || !authSession.getCurrentUserId()) {
            return;
        }

        this.requestSyncSoon(2000);
    }

    private clearRetryTimer() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }

    private emit(isSyncing: boolean) {
        for (const listener of this.listeners) {
            listener(isSyncing);
        }
    }
}

export const offlineQueueCoordinator = new OfflineQueueCoordinator();
