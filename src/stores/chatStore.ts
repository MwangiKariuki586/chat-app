import { create } from 'zustand';
import type { Message, Conversation, MessageReceipt } from '@/types';
import { supabase } from '@/lib/supabase';
import { addToOfflineQueue } from '@/lib/offlineQueue';

interface MessageState {
    // Messages grouped by conversation ID
    messagesByConversation: Record<string, Message[]>;

    // Loading states
    isLoading: boolean;
    isSending: boolean;
    isLoadingMore: boolean;

    // Pagination state per conversation
    paginationState: Record<string, {
        hasMore: boolean;
        oldestMessageId: string | null;
    }>;

    // Actions
    setMessages: (conversationId: string, messages: Message[]) => void;
    addMessage: (message: Message) => void;
    addReceipt: (receipt: MessageReceipt) => void;
    addOptimisticMessage: (conversationId: string, content: string, senderId: string, tempId: string) => void;
    confirmMessage: (tempId: string, confirmedMessage: Message) => void;
    removeMessage: (conversationId: string, messageId: string) => void;
    markAsRead: (conversationId: string) => Promise<void>;
    updateMessageStatus: (conversationId: string, messageId: string, status: { failed?: boolean }) => void;

    // API actions
    fetchMessages: (conversationId: string) => Promise<void>;
    fetchMoreMessages: (conversationId: string) => Promise<void>;
    sendMessage: (conversationId: string, content: string) => Promise<{ error: Error | null; newConversationId?: string }>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
    messagesByConversation: {},
    isLoading: false,
    isSending: false,
    isLoadingMore: false,
    paginationState: {},

    // Set all messages for a conversation
    setMessages: (conversationId, messages) => {
        set((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: messages,
            },
        }));
    },

    // Add a single message (from realtime)
    addMessage: (message) => {
        set((state) => {
            const conversationId = message.conversation_id;
            const existing = state.messagesByConversation[conversationId] || [];

            // Prevent duplicates
            if (existing.some((m) => m.id === message.id)) {
                return state;
            }

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: [...existing, message],
                },
            };
        });
    },

    // Add a read receipt (from realtime)
    addReceipt: (receipt) => {
        set((state) => {
            // Find which conversation this message belongs to
            let targetConvId: string | null = null;
            for (const [convId, messages] of Object.entries(state.messagesByConversation)) {
                if (messages.some(m => m.id === receipt.message_id)) {
                    targetConvId = convId;
                    break;
                }
            }

            if (!targetConvId) return state;

            const existingMessages = state.messagesByConversation[targetConvId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [targetConvId]: existingMessages.map(m => {
                        if (m.id === receipt.message_id) {
                            return {
                                ...m,
                                receipts: [...(m.receipts || []), receipt]
                            };
                        }
                        return m;
                    })
                }
            };
        });
    },

    // Add optimistic message (shows immediately before server confirms)
    addOptimisticMessage: (conversationId, content, senderId, tempId) => {
        const optimisticMessage: Message = {
            id: tempId,
            conversation_id: conversationId,
            sender_id: senderId,
            content,
            created_at: new Date().toISOString(),
            receipts: [],
        };

        set((state) => {
            const existing = state.messagesByConversation[conversationId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: [...existing, optimisticMessage],
                },
            };
        });
    },

    // Mark messages as read
    markAsRead: async (conversationId) => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        // Get unread messages sent by others
        const messages = get().messagesByConversation[conversationId] || [];
        const unreadMessages = messages.filter(m =>
            m.sender_id !== user.id &&
            !m.receipts?.some(r => r.user_id === user.id && r.read_at)
        );

        if (unreadMessages.length === 0) return;

        try {
            // Upsert receipts
            const receipts = unreadMessages.map(m => ({
                message_id: m.id,
                user_id: user.id,
                read_at: new Date().toISOString(),
            }));

            await supabase.from('message_receipts').upsert(receipts);

            // Update local state
            set((state) => {
                const existing = state.messagesByConversation[conversationId] || [];
                return {
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [conversationId]: existing.map(m => {
                            if (unreadMessages.some(um => um.id === m.id)) {
                                return {
                                    ...m,
                                    receipts: [
                                        ...(m.receipts || []),
                                        { user_id: user.id, read_at: new Date().toISOString() } as any
                                    ]
                                };
                            }
                            return m;
                        })
                    }
                };
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    },

    // Replace optimistic message with confirmed one
    confirmMessage: (tempId, confirmedMessage) => {
        set((state) => {
            const conversationId = confirmedMessage.conversation_id;
            const existing = state.messagesByConversation[conversationId] || [];

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: existing.map((m) =>
                        m.id === tempId ? confirmedMessage : m
                    ),
                },
            };
        });
    },

    // Update message status (e.g. mark as failed)
    updateMessageStatus: (conversationId, messageId, status) => {
        set((state) => {
            const existing = state.messagesByConversation[conversationId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: existing.map((m) =>
                        m.id === messageId ? { ...m, ...status } : m
                    ),
                },
            };
        });
    },

    // Remove a message
    removeMessage: (conversationId, messageId) => {
        set((state) => {
            const existing = state.messagesByConversation[conversationId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: existing.filter((m) => m.id !== messageId),
                },
            };
        });
    },

    // Fetch messages from database (filtered by user's visible_from for fresh start)
    fetchMessages: async (conversationId) => {
        set({ isLoading: true });

        const PAGE_SIZE = 25;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user's visible_from for this conversation
            const { data: participation, error: partError } = await supabase
                .from('conversation_participants')
                .select('visible_from, left_at')
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id)
                .single();

            console.log('📧 fetchMessages - participation data:', participation);
            console.log('📧 fetchMessages - participation error:', partError);

            // Build query - fetch most recent messages first
            let query = supabase
                .from('messages')
                .select(`
                    *,
                    sender:users!sender_id(id, name, email, avatar_url),
                    receipts:message_receipts(*)
                `)
                .eq('conversation_id', conversationId);

            // Filter by visible_from if set (for fresh start after rejoin)
            if (participation?.visible_from) {
                console.log('📧 Filtering messages by visible_from:', participation.visible_from);
                query = query.gte('created_at', participation.visible_from);
            } else {
                console.log('📧 No visible_from filter - showing all messages');
            }

            const { data, error } = await query
                .order('created_at', { ascending: false }) // Most recent first for pagination
                .limit(PAGE_SIZE);

            if (error) throw error;

            // Reverse to show in chronological order (oldest first)
            const messages = (data || []).reverse();
            const hasMore = (data?.length || 0) >= PAGE_SIZE;
            const oldestMessage = messages[0];

            console.log('📧 Fetched messages count:', messages.length, 'hasMore:', hasMore);
            console.log('📧 All fetched messages:', messages);

            set((state) => ({
                isLoading: false,
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: messages,
                },
                paginationState: {
                    ...state.paginationState,
                    [conversationId]: {
                        hasMore,
                        oldestMessageId: oldestMessage?.id || null,
                    },
                },
            }));
        } catch (error) {
            console.error('Error fetching messages:', error);
            set({ isLoading: false });
        }
    },

    // Fetch more (older) messages for pagination
    fetchMoreMessages: async (conversationId) => {
        const currentState = get();
        const pagination = currentState.paginationState[conversationId];

        // Don't fetch if already loading or no more messages
        if (currentState.isLoadingMore || !pagination?.hasMore) {
            return;
        }

        set({ isLoadingMore: true });

        const PAGE_SIZE = 25;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const existingMessages = currentState.messagesByConversation[conversationId] || [];
            const oldestMessage = existingMessages[0];

            if (!oldestMessage) {
                set({ isLoadingMore: false });
                return;
            }

            // Get user's visible_from for this conversation
            const { data: participation } = await supabase
                .from('conversation_participants')
                .select('visible_from')
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id)
                .single();

            // Build query for messages older than the oldest we have
            let query = supabase
                .from('messages')
                .select(`
                    *,
                    sender:users!sender_id(id, name, email, avatar_url),
                    receipts:message_receipts(*)
                `)
                .eq('conversation_id', conversationId)
                .lt('created_at', oldestMessage.created_at); // Older than current oldest

            // Filter by visible_from if set
            if (participation?.visible_from) {
                query = query.gte('created_at', participation.visible_from);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (error) throw error;

            // Reverse to chronological order
            const olderMessages = (data || []).reverse();
            const hasMore = (data?.length || 0) >= PAGE_SIZE;
            const newOldestMessage = olderMessages[0];

            console.log('📧 Fetched more messages:', olderMessages.length, 'hasMore:', hasMore);
            console.log('📧 All fetched MORE messages:', olderMessages);

            set((state) => ({
                isLoadingMore: false,
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: [...olderMessages, ...existingMessages],
                },
                paginationState: {
                    ...state.paginationState,
                    [conversationId]: {
                        hasMore,
                        oldestMessageId: newOldestMessage?.id || oldestMessage.id,
                    },
                },
            }));
        } catch (error) {
            console.error('Error fetching more messages:', error);
            set({ isLoadingMore: false });
        }
    },

    // Send a new message
    sendMessage: async (conversationId, content) => {
        // Use getSession instead of getUser to allow offline sending (getUser verifies with server)
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) return { error: new Error('Not authenticated') };

        // Generate temp ID for optimistic update
        const tempId = `temp-${Date.now()}`;

        // Add optimistic message immediately
        get().addOptimisticMessage(conversationId, content, user.id, tempId);
        set({ isSending: true });

        // Check if we're offline - queue the message for later
        if (!navigator.onLine) {
            console.log('📴 Offline - queueing message for later sync');
            addToOfflineQueue({
                id: tempId,
                conversationId,
                content,
                createdAt: new Date().toISOString(),
            });
            set({ isSending: false });
            // Return success - optimistic message stays visible, will sync when online
            return { error: null };
        }

        // Check for optimistic conversation ID (lazy creation)
        const isOptimisticConversation = conversationId.startsWith('temp-chat-');
        let finalConversationId = conversationId;

        // If it's an optimistic conversation, create it now
        if (isOptimisticConversation) {
            const otherUserId = conversationId.replace('temp-chat-', '');
            // Need the store instance to call createConversation from here? 
            // We can access 'useConversationStore' via import, or just use 'get()' if we merged stores, 
            // but here we are in messageStore. 
            // Hacky but works: import the store object.
            // Better: We see useConversationStore is exported in this file!

            // We can use the exported store hook's getState()
            const { createConversation, removeConversation } = useConversationStore.getState();

            const { data: newConv, error: createError } = await createConversation([otherUserId]);

            if (createError || !newConv) {
                set({ isSending: false });
                get().removeMessage(conversationId, tempId);
                return { error: createError || new Error('Failed to create conversation') };
            }

            finalConversationId = newConv.id;

            // Remove the optimistic conversation from conversation store
            removeConversation(conversationId);

            // Note: We don't need to move the optimistic message to the new ID 
            // because we are about to insert it into DB with finalConversationId.
            // However, the UI is still showing the OLD conversationId until we return.
        }

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: finalConversationId,
                    sender_id: user.id,
                    content,
                })
                .select(`
          *,
          sender:users!sender_id(id, name, email, avatar_url)
        `)
                .single();

            if (error) {
                // Check if this is a network error - queue for offline
                if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('fetch')) {
                    console.log('📴 Network error - queueing message for later sync');
                    addToOfflineQueue({
                        id: tempId,
                        conversationId: finalConversationId,
                        content,
                        createdAt: new Date().toISOString(),
                    });
                    set({ isSending: false });
                    return { error: null }; // Keep optimistic message
                }

                // Real error - mark as failed
                get().updateMessageStatus(conversationId, tempId, { failed: true });
                throw error;
            }

            // Replace optimistic message with confirmed one
            // Note: Realtime will also deliver this, so we prevent duplicates in addMessage
            get().confirmMessage(tempId, data);

            set({ isSending: false });
            return {
                error: null,
                newConversationId: isOptimisticConversation ? finalConversationId : undefined
            };
        } catch (error) {
            set({ isSending: false });

            // Check if network error - queue instead of failing
            if (!navigator.onLine) {
                console.log('📴 Caught offline during send - queueing message');
                addToOfflineQueue({
                    id: tempId,
                    conversationId: finalConversationId,
                    content,
                    createdAt: new Date().toISOString(),
                });
                return { error: null }; // Keep optimistic message
            }

            // Mark as failed if truly failed
            get().updateMessageStatus(conversationId, tempId, { failed: true });
            return { error: error as Error };
        }
    },
}));

// =============================================
// Conversation Store
// =============================================

interface ConversationState {
    conversations: Conversation[];
    activeConversationId: string | null;
    isLoading: boolean;
    unreadCounts: Record<string, number>; // Conversation ID -> unread count

    setConversations: (conversations: Conversation[]) => void;
    setActiveConversation: (id: string | null) => void;
    fetchConversations: (userId?: string) => Promise<void>;
    createConversation: (participantIds: string[], name?: string) => Promise<{ data: Conversation | null; error: Error | null }>;
    getOrCreateDirectConversation: (otherUserId: string) => Promise<{ data: Conversation | null; error: Error | null }>;
    deleteConversation: (conversationId: string) => Promise<{ error: Error | null }>;

    // Realtime actions
    addConversation: (conversation: Conversation) => void;
    removeConversation: (conversationId: string) => void;
    updateLastMessage: (conversationId: string, message: Message) => void;
    incrementUnreadCount: (conversationId: string) => void;
    resetUnreadCount: (conversationId: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
    conversations: [],
    activeConversationId: null,
    isLoading: false,
    unreadCounts: {},

    setConversations: (conversations) => set({ conversations }),

    setActiveConversation: (id) => set({ activeConversationId: id }),

    // Add a new conversation (from realtime)
    addConversation: (conversation) => {
        set((state) => {
            // Prevent duplicates
            if (state.conversations.some((c) => c.id === conversation.id)) {
                return state;
            }
            // Add to the beginning of the list
            return {
                conversations: [conversation, ...state.conversations],
            };
        });
    },

    // Remove a conversation from local state
    removeConversation: (conversationId) => {
        set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== conversationId),
            // Also clear unread count
            unreadCounts: Object.fromEntries(
                Object.entries(state.unreadCounts).filter(([id]) => id !== conversationId)
            ),
            // Clear active conversation if it was deleted
            activeConversationId: state.activeConversationId === conversationId
                ? null
                : state.activeConversationId,
        }));
    },

    // Update last message for a conversation
    updateLastMessage: (conversationId, message) => {
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv.id === conversationId
                    ? { ...conv, last_message: message, updated_at: message.created_at }
                    : conv
            ).sort((a, b) => {
                // Sort by updated_at descending (most recent first)
                const aTime = a.last_message?.created_at || a.created_at;
                const bTime = b.last_message?.created_at || b.created_at;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            }),
        }));
    },

    // Increment unread count for a conversation
    incrementUnreadCount: (conversationId) => {
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [conversationId]: (state.unreadCounts[conversationId] || 0) + 1,
            },
        }));
    },

    // Reset unread count when conversation is opened
    resetUnreadCount: (conversationId) => {
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [conversationId]: 0,
            },
        }));
    },

    // Delete/Leave a conversation (soft delete via left_at timestamp)
    // The conversation remains for other participants, and user can rejoin later
    deleteConversation: async (conversationId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Set left_at timestamp (soft delete)
            // This hides the conversation from this user's list
            const { error } = await supabase
                .from('conversation_participants')
                .update({ left_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id);

            if (error) throw error;

            // Remove from local state
            get().removeConversation(conversationId);

            return { error: null };
        } catch (error) {
            console.error('Error leaving conversation:', error);
            return { error: error as Error };
        }
    },


    // Fetch all conversations for current user (where they haven't left)
    fetchConversations: async (userId?: string) => {
        set({ isLoading: true });

        try {
            let currentUserId = userId;

            if (!currentUserId) {
                // Use getSession instead of getUser for header-based auth check (faster/no network call usually)
                // RLS on the backend will enforce security anyway
                const { data: { session } } = await supabase.auth.getSession();
                currentUserId = session?.user?.id;
            }

            if (!currentUserId) throw new Error('Not authenticated');

            // First get conversation IDs where user is an ACTIVE participant (left_at is null)
            const { data: activeParticipations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', currentUserId)
                .is('left_at', null);

            if (partError) throw partError;

            const activeConvIds = activeParticipations?.map(p => p.conversation_id) || [];

            if (activeConvIds.length === 0) {
                set({ conversations: [], isLoading: false });
                return;
            }

            // Get conversations with participants
            const { data: conversations, error } = await supabase
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
                .in('id', activeConvIds)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            // Fetch last message for each conversation
            const conversationsWithLastMessage = await Promise.all(
                (conversations || []).map(async (conv) => {
                    const { data: messages } = await supabase
                        .from('messages')
                        .select(`
                            *,
                            sender:users!sender_id(id, name, email, avatar_url)
                        `)
                        .eq('conversation_id', conv.id)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    return {
                        ...conv,
                        last_message: messages?.[0] || null,
                    };
                })
            );

            set({ conversations: conversationsWithLastMessage, isLoading: false });
        } catch (error) {
            console.error('Error fetching conversations:', error);
            set({ isLoading: false });
        }
    },


    // Create a new conversation
    createConversation: async (participantIds, name) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Generate UUID client-side to avoid any SELECT after INSERT
            const conversationId = crypto.randomUUID();

            // Step 1: Create conversation WITHOUT any .select()
            const { error: convError } = await supabase
                .from('conversations')
                .insert({
                    id: conversationId,
                    name: name || null,
                    is_group: participantIds.length > 1,
                });

            if (convError) throw convError;

            // Step 2: Add all participants (including current user) IMMEDIATELY
            const allParticipants = [...new Set([user.id, ...participantIds])];
            const { error: partError } = await supabase
                .from('conversation_participants')
                .insert(
                    allParticipants.map((userId) => ({
                        conversation_id: conversationId,
                        user_id: userId,
                    }))
                );

            if (partError) throw partError;

            // Step 3: Fetch the full conversation with participants (single query)
            const { data: conversation, error: fetchError } = await supabase
                .from('conversations')
                .select(`
                    *,
                    participants:conversation_participants(
                        user_id,
                        user:users(id, name, email, avatar_url)
                    )
                `)
                .eq('id', conversationId)
                .single();

            if (fetchError) throw fetchError;

            // Add to local state directly instead of refetching all
            if (conversation) {
                get().addConversation(conversation as Conversation);
            }

            return { data: conversation, error: null };
        } catch (error) {
            return { data: null, error: error as Error };
        }
    },

    // Get or create a 1:1 conversation with another user
    getOrCreateDirectConversation: async (otherUserId) => {
        console.log('getOrCreateDirectConversation called with:', otherUserId);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('Current auth user:', user?.id);
            if (!user) throw new Error('Not authenticated');

            // First check local state - but ONLY if user is active (not left)
            const localConversations = get().conversations;
            const localExisting = localConversations.find((conv) => {
                if (conv.is_group) return false;
                const participants = conv.participants || [];
                const participantIds = participants.map(p => p.user_id);

                // Check if both users are in the conversation
                if (!(participantIds.length === 2 &&
                    participantIds.includes(user.id) &&
                    participantIds.includes(otherUserId))) {
                    return false;
                }

                // Check if current user has NOT left (left_at should be null/undefined)
                const myParticipation = participants.find(p => p.user_id === user.id);
                if (myParticipation?.left_at) {
                    console.log('Found conversation but user has left_at set, skipping local state');
                    return false;
                }

                return true;
            });

            if (localExisting) {
                console.log('Found existing active conversation in local state:', localExisting.id);
                return { data: localExisting, error: null };
            }

            // Check if we have a participation record (active OR left) with other user
            const { data: myParticipations } = await supabase
                .from('conversation_participants')
                .select('conversation_id, left_at')
                .eq('user_id', user.id);

            if (myParticipations && myParticipations.length > 0) {
                const myConvIds = myParticipations.map(p => p.conversation_id);

                // Check if other user is in any of these conversations (active only)
                const { data: sharedConvs } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .eq('user_id', otherUserId)
                    .is('left_at', null)  // Other user must be active
                    .in('conversation_id', myConvIds);

                if (sharedConvs && sharedConvs.length > 0) {
                    // Found shared conversation(s), check each one
                    for (const shared of sharedConvs) {
                        const { data: conv } = await supabase
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
                            .eq('id', shared.conversation_id)
                            .eq('is_group', false)
                            .single();

                        if (conv) {
                            // Check if we had left this conversation
                            const myParticipation = myParticipations.find(
                                p => p.conversation_id === conv.id
                            );

                            if (myParticipation?.left_at) {
                                // We left this conversation - REJOIN with fresh start
                                console.log('Rejoining conversation:', conv.id);
                                const now = new Date().toISOString();

                                const { error: rejoinError } = await supabase
                                    .from('conversation_participants')
                                    .update({
                                        left_at: null,      // Clear left status
                                        visible_from: now   // Fresh start - only see messages from now
                                    })
                                    .eq('conversation_id', conv.id)
                                    .eq('user_id', user.id);

                                if (rejoinError) throw rejoinError;

                                // Refetch the conversation with updated data
                                const { data: updatedConv } = await supabase
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
                                    .eq('id', conv.id)
                                    .single();

                                if (updatedConv) {
                                    get().addConversation(updatedConv as Conversation);
                                    return { data: updatedConv, error: null };
                                }
                            }

                            // We're already active in this conversation
                            console.log('Found existing active conversation:', conv.id);
                            get().addConversation(conv as Conversation);
                            return { data: conv, error: null };
                        }
                    }
                }
            }

            console.log('No existing conversation, creating OPTIMISTIC one...');

            // Create optimistic conversation object
            const optimisticId = `temp-chat-${otherUserId}`;

            // Need to fetch other user details to build the optimistic user object
            const { data: otherUser } = await supabase
                .from('users')
                .select('*')
                .eq('id', otherUserId)
                .single();

            // construct optimistic conversation
            const optimisticConv: Conversation = {
                id: optimisticId,
                name: null,
                is_group: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                participants: [
                    {
                        id: 'temp-part-1',
                        conversation_id: optimisticId,
                        user_id: user.id,
                        joined_at: new Date().toISOString(),
                        user: user as any // simplified
                    },
                    {
                        id: 'temp-part-2',
                        conversation_id: optimisticId,
                        user_id: otherUserId,
                        joined_at: new Date().toISOString(),
                        user: otherUser as any
                    }
                ]
            };

            // Add to store
            get().addConversation(optimisticConv);

            return { data: optimisticConv, error: null };
        } catch (error) {
            console.error('getOrCreateDirectConversation error:', error);
            return { data: null, error: error as Error };
        }
    },
}));
