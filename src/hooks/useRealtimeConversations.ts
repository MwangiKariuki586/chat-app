import { useEffect, useEffectEvent } from 'react';
import { realtimeManager } from '@/services/realtimeManager';
import { chatRepository } from '@/services/chatRepository';
import { receiveRealtimeConversation, receiveRealtimeMessage, loadConversations } from '@/services/chatController';
import { useConversationStore } from '@/stores';
import type { Message } from '@/types';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeConversationsOptions {
    userId: string | null;
    activeConversationId?: string | null;
    onStatusChange?: (status: ConnectionStatus) => void;
    onNewMessage?: (message: Message) => void;
}

const mapStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'retrying' | 'degraded' | 'error'): ConnectionStatus =>
    status === 'retrying' ? 'connecting' : status === 'degraded' ? 'error' : status;

export function useRealtimeConversations({
    userId,
    activeConversationId,
    onStatusChange,
    onNewMessage,
}: UseRealtimeConversationsOptions) {
    const getActiveConversationId = useEffectEvent(() => activeConversationId);
    const emitNewMessage = useEffectEvent((message: Message) => {
        onNewMessage?.(message);
    });
    const emitStatus = useEffectEvent((status: ConnectionStatus) => {
        onStatusChange?.(status);
    });

    useEffect(() => {
        if (!userId) {
            emitStatus('disconnected');
            return;
        }

        return realtimeManager.subscribeToConversationList({
            userId,
            onMessage: async (message) => {
                receiveRealtimeMessage(message);

                const conversationStore = useConversationStore.getState();
                const existing = conversationStore.conversations.find((conversation) => conversation.id === message.conversation_id);

                if (!existing) {
                    const fetchedConversation = await chatRepository.fetchConversationById(message.conversation_id);
                    if (fetchedConversation.data) {
                        receiveRealtimeConversation({
                            ...fetchedConversation.data,
                            last_message: message,
                        });
                    }
                }

                if (message.sender_id !== userId && message.conversation_id !== getActiveConversationId()) {
                    useConversationStore.getState().incrementUnreadCount(message.conversation_id);
                }

                emitNewMessage(message);
            },
            onReconnect: async () => {
                await loadConversations();
            },
            onStatus: (status) => {
                emitStatus(mapStatus(status));
            },
        });
    }, [userId]);

    return {
        refresh: loadConversations,
    };
}
