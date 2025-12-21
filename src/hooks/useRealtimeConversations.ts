import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useConversationStore } from '@/stores';
import type { Conversation, Message } from '@/types';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeConversationsOptions {
    userId: string | null;
    activeConversationId?: string | null;
    onStatusChange?: (status: ConnectionStatus) => void;
    onNewMessage?: (message: Message) => void;
}

/**
 * Hook to subscribe to realtime conversation updates.
 * Listens to:
 * - New conversations (INSERT on conversations via participant changes)
 * - New messages (to update last_message and unread counts)
 */
export function useRealtimeConversations({
    userId,
    activeConversationId,
    onStatusChange,
    onNewMessage
}: UseRealtimeConversationsOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const {
        fetchConversations,
        addConversation,
        updateLastMessage,
        incrementUnreadCount,
        resetUnreadCount
    } = useConversationStore();

    // Store callbacks in refs to avoid them being dependencies
    const onStatusChangeRef = useRef(onStatusChange);
    const onNewMessageRef = useRef(onNewMessage);
    onStatusChangeRef.current = onStatusChange;
    onNewMessageRef.current = onNewMessage;

    // Store active conversation and userId in refs so callback always has current value
    const activeConversationIdRef = useRef(activeConversationId);
    activeConversationIdRef.current = activeConversationId;

    const userIdRef = useRef(userId);
    userIdRef.current = userId;

    // Get current conversations from store
    const conversations = useConversationStore((state) => state.conversations);
    const conversationsRef = useRef(conversations);
    conversationsRef.current = conversations;

    // Handle new message - this is where we add conversations for receivers
    const handleNewMessage = useCallback(async (payload: { new: Message }) => {
        const message = payload.new;
        const currentUserId = userIdRef.current;
        const currentActiveConversationId = activeConversationIdRef.current;

        console.log('📩 New message in conversation:', message.conversation_id);
        console.log('   Active conversation:', currentActiveConversationId);
        console.log('   Message from:', message.sender_id, '| Current user:', currentUserId);

        // Check if we already have this conversation in our list
        const existingConversation = conversationsRef.current.find(
            (c) => c.id === message.conversation_id
        );

        // Fetch sender data for display
        const { data: fullMessage, error } = await supabase
            .from('messages')
            .select(`
                *,
                sender:users!sender_id(id, name, email, avatar_url)
            `)
            .eq('id', message.id)
            .single();

        if (error) {
            console.error('Error fetching message details:', error);
            return;
        }

        // If conversation doesn't exist in our list, fetch and add it
        // This handles the case where receiver gets a message in a new conversation
        if (!existingConversation) {
            console.log('🆕 New conversation detected via first message');

            const { data: conversation, error: convError } = await supabase
                .from('conversations')
                .select(`
                    *,
                    participants:conversation_participants(
                        user_id,
                        left_at,
                        visible_from,
                        user:users(id, name, email, avatar_url)
                    )
                `)
                .eq('id', message.conversation_id)
                .single();

            if (convError) {
                console.error('Error fetching conversation:', convError);
            } else if (conversation) {
                // Check if current user has left this conversation
                const myParticipation = conversation.participants?.find(
                    (p: { user_id: string; left_at: string | null }) => p.user_id === currentUserId
                );

                if (myParticipation?.left_at) {
                    console.log('🚫 Ignoring message - user has left this conversation');
                    return;
                }

                // Add conversation with the first message as last_message
                addConversation({
                    ...conversation,
                    last_message: fullMessage,
                } as Conversation);

                // New conversation always gets unread count if not from current user
                if (message.sender_id !== currentUserId) {
                    console.log('🔔 Incrementing unread for NEW conversation');
                    incrementUnreadCount(message.conversation_id);
                }
            }
        } else {
            // Update last message in existing conversation
            updateLastMessage(message.conversation_id, fullMessage);

            // Increment unread count only if:
            // 1. The message is from someone else
            // 2. The conversation is not currently active
            if (message.sender_id !== currentUserId && message.conversation_id !== currentActiveConversationId) {
                console.log('🔔 Incrementing unread count for:', message.conversation_id);
                incrementUnreadCount(message.conversation_id);
            } else {
                console.log('⏭️ Skipping unread increment - active or own message');
            }
        }

        // Notify parent component if callback provided
        onNewMessageRef.current?.(fullMessage);
    }, [addConversation, updateLastMessage, incrementUnreadCount]);

    useEffect(() => {
        if (!userId) {
            onStatusChangeRef.current?.('disconnected');
            return;
        }

        // Cleanup existing channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        onStatusChangeRef.current?.('connecting');

        const channelName = `conversations:${userId}:${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            // Only listen for new messages
            // Conversations are added when the first message is received
            // This provides better UX - receiver only sees conversation after a message
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                handleNewMessage
            )
            .subscribe((status, err) => {
                switch (status) {
                    case 'SUBSCRIBED':
                        console.log('✅ Realtime conversations connected');
                        onStatusChangeRef.current?.('connected');
                        break;
                    case 'CHANNEL_ERROR':
                        console.error('❌ Conversations channel error:', err);
                        onStatusChangeRef.current?.('error');
                        break;
                    case 'TIMED_OUT':
                        console.warn('⏰ Conversations channel timed out');
                        onStatusChangeRef.current?.('error');
                        break;
                    case 'CLOSED':
                        console.log('🔌 Conversations channel closed');
                        onStatusChangeRef.current?.('disconnected');
                        break;
                }
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                console.log('🧹 Cleaning up conversations channel');
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [userId, handleNewMessage]);

    // Reset unread count when active conversation changes
    useEffect(() => {
        if (activeConversationId) {
            resetUnreadCount(activeConversationId);
        }
    }, [activeConversationId, resetUnreadCount]);

    // Manual refresh function
    const refresh = useCallback(() => {
        fetchConversations();
    }, [fetchConversations]);

    return { refresh };
}
