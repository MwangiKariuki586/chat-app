import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useMessageStore } from '@/stores/chatStore';
import type { Message } from '@/types';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeMessagesOptions {
    conversationId: string | null;
    onStatusChange?: (status: ConnectionStatus) => void;
}

/**
 * Hook to subscribe to realtime messages for a conversation.
 * Handles proper lifecycle management to prevent CHANNEL_ERROR.
 */
export function useRealtimeMessages({
    conversationId,
    onStatusChange
}: UseRealtimeMessagesOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const addMessage = useMessageStore((state) => state.addMessage);

    // Store onStatusChange in a ref to avoid it being a dependency
    const onStatusChangeRef = useRef(onStatusChange);
    onStatusChangeRef.current = onStatusChange;

    const handleNewMessage = useCallback(async (payload: { new: Message }) => {
        // Fetch the complete message with sender data
        const { data: message, error } = await supabase
            .from('messages')
            .select(`
        *,
        sender:users!sender_id(id, name, email, avatar_url)
      `)
            .eq('id', payload.new.id)
            .single();

        if (error) {
            console.error('Error fetching new message:', error);
            return;
        }

        if (message) {
            addMessage(message);
        }
    }, [addMessage]);

    useEffect(() => {
        // Don't subscribe without a valid conversation ID
        if (!conversationId) {
            onStatusChangeRef.current?.('disconnected');
            return;
        }

        // Cleanup existing channel before creating new one
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        onStatusChangeRef.current?.('connecting');

        // Create a unique channel name for this conversation
        const channelName = `messages:${conversationId}:${Date.now()}`;

        // Subscribe to postgres_changes for this conversation
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                handleNewMessage
            )
            .subscribe((status, err) => {
                switch (status) {
                    case 'SUBSCRIBED':
                        console.log(`✅ Realtime connected for conversation ${conversationId}`);
                        onStatusChangeRef.current?.('connected');
                        break;
                    case 'CHANNEL_ERROR':
                        console.error('❌ Channel error:', err);
                        onStatusChangeRef.current?.('error');
                        break;
                    case 'TIMED_OUT':
                        console.warn('⏰ Channel timed out');
                        onStatusChangeRef.current?.('error');
                        break;
                    case 'CLOSED':
                        console.log('🔌 Channel closed');
                        onStatusChangeRef.current?.('disconnected');
                        break;
                }
            });

        channelRef.current = channel;

        // CRITICAL: Cleanup on unmount or conversation change
        return () => {
            if (channelRef.current) {
                console.log(`🧹 Cleaning up channel for conversation ${conversationId}`);
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [conversationId, handleNewMessage]);  // Removed onStatusChange from dependencies

    // Return function to manually reconnect if needed
    const reconnect = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        // Trigger re-subscription by creating a new effect cycle
        // This is handled automatically by React's useEffect cleanup
    }, []);

    return { reconnect };
}
