import { useState, useCallback } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseConnectionStateOptions {
    onStatusChange?: (status: ConnectionStatus) => void;
}

export function useConnectionState(options: UseConnectionStateOptions = {}) {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');

    const handleStatusChange = useCallback((nextStatus: ConnectionStatus) => {
        setStatus(nextStatus);
        options.onStatusChange?.(nextStatus);
    }, [options]);

    const reset = useCallback(() => {
        setStatus('disconnected');
    }, []);

    return {
        status,
        isConnected: status === 'connected',
        isConnecting: status === 'connecting',
        hasError: status === 'error',
        canRetry: true,
        handleStatusChange,
        reset,
    };
}

export function getConnectionStatusDisplay(status: ConnectionStatus) {
    switch (status) {
        case 'connected':
            return { text: 'Connected', color: '#10b981', icon: 'Connected' };
        case 'connecting':
            return { text: 'Connecting...', color: '#f59e0b', icon: 'Connecting' };
        case 'disconnected':
            return { text: 'Disconnected', color: '#6b7280', icon: 'Offline' };
        case 'error':
            return { text: 'Connection Error', color: '#ef4444', icon: 'Error' };
    }
}
