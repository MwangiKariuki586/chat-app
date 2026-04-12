import { useState, useEffect, useCallback } from 'react';
import { offlineQueueStore } from '@/services/offlineQueueStore';
import { offlineQueueCoordinator } from '@/services/offlineQueueCoordinator';

interface UseOfflineSupportResult {
    isOnline: boolean;
    pendingMessageCount: number;
    isSyncing: boolean;
    syncPendingMessages: () => Promise<void>;
}

export function useOfflineSupport(): UseOfflineSupportResult {
    const [isOnline, setIsOnline] = useState(offlineQueueStore.isOnline());
    const [pendingMessageCount, setPendingMessageCount] = useState(offlineQueueStore.getItems().length);
    const [isSyncing, setIsSyncing] = useState(offlineQueueCoordinator.isSyncing());

    useEffect(() => {
        const unsubscribeQueue = offlineQueueStore.subscribe((items) => {
            setPendingMessageCount(items.length);
            if (offlineQueueStore.isOnline() && items.some((item) => item.status === 'pending')) {
                offlineQueueCoordinator.requestSyncSoon(250);
            }
        });
        const unsubscribeSync = offlineQueueCoordinator.subscribe((syncing) => {
            setIsSyncing(syncing);
        });

        const handleOnline = () => {
            setIsOnline(true);
            void offlineQueueCoordinator.sync();
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        const handleFocus = () => {
            if (offlineQueueStore.isOnline() && offlineQueueStore.getItems().some((item) => item.status === 'pending')) {
                void offlineQueueCoordinator.sync();
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleFocus();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (offlineQueueStore.isOnline() && offlineQueueStore.getItems().length > 0) {
            void offlineQueueCoordinator.sync();
        }

        return () => {
            unsubscribeQueue();
            unsubscribeSync();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const syncPendingMessages = useCallback(async () => {
        await offlineQueueCoordinator.sync();
    }, []);

    return {
        isOnline,
        pendingMessageCount,
        isSyncing,
        syncPendingMessages,
    };
}
