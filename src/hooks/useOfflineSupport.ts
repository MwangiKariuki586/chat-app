import { useState, useEffect, useCallback } from 'react';
import {
    processOfflineQueue,
    hasOfflineMessages,
    getOfflineMessageCount
} from '@/lib/offlineQueue';

interface UseOfflineSupportResult {
    isOnline: boolean;
    pendingMessageCount: number;
    syncPendingMessages: () => Promise<void>;
}

/**
 * Hook for managing offline support and syncing
 * 
 * @example
 * ```tsx
 * const { isOnline, pendingMessageCount, syncPendingMessages } = useOfflineSupport();
 * 
 * useEffect(() => {
 *   if (isOnline && pendingMessageCount > 0) {
 *     syncPendingMessages();
 *   }
 * }, [isOnline]);
 * ```
 */
export function useOfflineSupport(): UseOfflineSupportResult {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingMessageCount, setPendingMessageCount] = useState(0);

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

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline && hasOfflineMessages()) {
            console.log('🌐 Online with pending messages, syncing...');
            processOfflineQueue(
                (messageId) => {
                    console.log(`✅ Synced message: ${messageId}`);
                    setPendingMessageCount((prev) => Math.max(0, prev - 1));
                },
                (messageId, error) => {
                    console.error(`❌ Failed to sync message: ${messageId}`, error);
                }
            );
        }
    }, [isOnline]);

    const syncPendingMessages = useCallback(async () => {
        await processOfflineQueue(
            (messageId) => {
                console.log(`✅ Synced message: ${messageId}`);
                setPendingMessageCount((prev) => Math.max(0, prev - 1));
            },
            (messageId, error) => {
                console.error(`❌ Failed to sync message: ${messageId}`, error);
            }
        );
    }, []);

    return {
        isOnline,
        pendingMessageCount,
        syncPendingMessages,
    };
}
