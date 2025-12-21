import { useState, useEffect, useCallback, useRef } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseConnectionStateOptions {
    maxRetries?: number;
    retryDelayMs?: number;
    onMaxRetriesReached?: () => void;
}

/**
 * Hook to manage connection state with automatic retry logic
 */
export function useConnectionState(options: UseConnectionStateOptions = {}) {
    const {
        maxRetries = 3,
        retryDelayMs = 2000,
        onMaxRetriesReached
    } = options;

    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [retryCount, setRetryCount] = useState(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clear any pending retry timeouts
    const clearRetryTimeout = useCallback(() => {
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
    }, []);

    // Handle status changes from the realtime hook
    const handleStatusChange = useCallback((newStatus: ConnectionStatus) => {
        setStatus(newStatus);

        if (newStatus === 'connected') {
            // Reset retry count on successful connection
            setRetryCount(0);
            clearRetryTimeout();
        } else if (newStatus === 'error') {
            // Attempt retry with exponential backoff
            setRetryCount((prev) => {
                const nextCount = prev + 1;

                if (nextCount >= maxRetries) {
                    onMaxRetriesReached?.();
                    return nextCount;
                }

                // Schedule retry with exponential backoff
                const delay = retryDelayMs * Math.pow(2, prev);
                console.log(`🔄 Retrying connection in ${delay}ms (attempt ${nextCount}/${maxRetries})`);

                retryTimeoutRef.current = setTimeout(() => {
                    setStatus('connecting');
                }, delay);

                return nextCount;
            });
        }
    }, [maxRetries, retryDelayMs, onMaxRetriesReached, clearRetryTimeout]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearRetryTimeout();
        };
    }, [clearRetryTimeout]);

    // Reset connection state
    const reset = useCallback(() => {
        setStatus('disconnected');
        setRetryCount(0);
        clearRetryTimeout();
    }, [clearRetryTimeout]);

    return {
        status,
        retryCount,
        isConnected: status === 'connected',
        isConnecting: status === 'connecting',
        hasError: status === 'error',
        canRetry: retryCount < maxRetries,
        handleStatusChange,
        reset,
    };
}

/**
 * Get display text and color for connection status
 */
export function getConnectionStatusDisplay(status: ConnectionStatus) {
    switch (status) {
        case 'connected':
            return { text: 'Connected', color: '#10b981', icon: '🟢' };
        case 'connecting':
            return { text: 'Connecting...', color: '#f59e0b', icon: '🟡' };
        case 'disconnected':
            return { text: 'Disconnected', color: '#6b7280', icon: '⚪' };
        case 'error':
            return { text: 'Connection Error', color: '#ef4444', icon: '🔴' };
    }
}
