import { useEffect, useEffectEvent } from 'react';
import { realtimeManager } from '@/services/realtimeManager';
import { receiveRealtimeMessage, receiveRealtimeReceipt, syncConversationSinceLastKnown } from '@/services/chatController';
import { useMessageStore } from '@/stores';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeMessagesOptions {
    conversationId: string | null;
    onStatusChange?: (status: ConnectionStatus) => void;
}

const mapStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'retrying' | 'degraded' | 'error'): ConnectionStatus =>
    status === 'retrying' ? 'connecting' : status === 'degraded' ? 'error' : status;

export function useRealtimeMessages({ conversationId, onStatusChange }: UseRealtimeMessagesOptions) {
    const emitStatus = useEffectEvent((status: ConnectionStatus) => {
        onStatusChange?.(status);
    });

    useEffect(() => {
        if (!conversationId) {
            emitStatus('disconnected');
            return;
        }

        useMessageStore.getState().setConversationConnection(conversationId, 'connecting');

        return realtimeManager.subscribeToConversationMessages({
            conversationId,
            onMessage: (message) => {
                receiveRealtimeMessage(message);
            },
            onReceipt: (receipt) => {
                receiveRealtimeReceipt(receipt);
            },
            onReconnect: async () => {
                await syncConversationSinceLastKnown(conversationId);
            },
            onStatus: (status) => {
                useMessageStore.getState().setConversationConnection(conversationId, status);
                emitStatus(mapStatus(status));
            },
        });
    }, [conversationId]);

    return {};
}
