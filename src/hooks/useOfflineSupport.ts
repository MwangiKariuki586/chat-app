import { useState, useEffect, useCallback } from 'react';
import {
    processOfflineQueue,
    hasOfflineMessages,
    getOfflineMessageCount
} from '@/lib/offlineQueue';
import { useMessageStore } from '@/stores';
import { useToast } from '@/components/Toast';

interface UseOfflineSupportResult {
    isOnline: boolean;
    pendingMessageCount: number;
    syncPendingMessages: () => Promise<void>;
}

export function useOfflineSupport(): UseOfflineSupportResult {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingMessageCount, setPendingMessageCount] = useState(0);
    const { confirmMessage, removeMessage } = useMessageStore();
    const { showToast } = useToast();

    // Update online status and poll for queue changes
    useEffect(() => {
        const handleOnline = () => {
            console.log('🌐 Back online!');
            setIsOnline(true);
        };

        const handleOffline = () => {
            console.log('🌐 Gone offline!');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initial queue count
        setPendingMessageCount(getOfflineMessageCount());

        // Poll for queue changes every second (for when messages are added while offline)
        const pollInterval = setInterval(() => {
            const count = getOfflineMessageCount();
            setPendingMessageCount(count);
        }, 1000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(pollInterval);
        };
    }, []);

    const handleSyncSuccess = useCallback((messageId: string, data: any) => {
        console.log(`✅ Synced message: ${messageId}`);
        confirmMessage(messageId, data);
        setPendingMessageCount((prev) => Math.max(0, prev - 1));
    }, [confirmMessage]);

    const handleSyncFailure = useCallback((messageId: string, error: Error) => {
        console.error(`❌ Failed to sync message: ${messageId}`, error);
        if (error.message === 'Max retries exceeded') {
            showToast('A message failed to send after multiple attempts and was removed.', 'error');
            // Optimistically remove the failed message from UI as well or mark it failed
            // For now, we'll just remove it to keep the UI clean
            // removeMessage(unknown_conversation_id, messageId); 
            // Note: We'd need the move conversationId into the failure callback for perfect cleanup
        }
    }, [showToast]);

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline && hasOfflineMessages()) {
            console.log('🌐 Online with pending messages, syncing...');
            processOfflineQueue(handleSyncSuccess, handleSyncFailure);
        }
    }, [isOnline, handleSyncSuccess, handleSyncFailure]);

    const syncPendingMessages = useCallback(async () => {
        await processOfflineQueue(handleSyncSuccess, handleSyncFailure);
    }, [handleSyncSuccess, handleSyncFailure]);

    return {
        isOnline,
        pendingMessageCount,
        syncPendingMessages,
    };
}
