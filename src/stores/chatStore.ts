import { create } from 'zustand';
import type {
    ConnectionState,
    Conversation,
    ConversationLoadState,
    Message,
    MessageClientStatus,
    MessageReceipt,
} from '@/types';

const defaultLoadState = (): ConversationLoadState => ({
    status: 'idle',
    error: null,
    cursor: null,
    lastSyncedAt: null,
    inFlightRequestId: null,
});

const mergeMessages = (current: Message[], incoming: Message[]) => {
    const byId = new Map<string, Message>();

    for (const message of current) {
        byId.set(message.id, message);
    }

    for (const message of incoming) {
        const existing = byId.get(message.id);
        byId.set(message.id, existing ? { ...existing, ...message } : message);
    }

    return Array.from(byId.values()).sort(
        (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    );
};

const mergeReceipts = (existing: MessageReceipt[] = [], incoming: MessageReceipt[]) => {
    const receipts = new Map<string, MessageReceipt>();

    for (const receipt of existing) {
        receipts.set(`${receipt.message_id}:${receipt.user_id}`, receipt);
    }

    for (const receipt of incoming) {
        receipts.set(`${receipt.message_id}:${receipt.user_id}`, receipt);
    }

    return Array.from(receipts.values());
};

const mergeConversation = (existing: Conversation | undefined, incoming: Conversation) => ({
    ...existing,
    ...incoming,
    participants: incoming.participants || existing?.participants,
    last_message: incoming.last_message ?? existing?.last_message ?? null,
});

interface MessageState {
    messagesByConversation: Record<string, Message[]>;
    loadStateByConversation: Record<string, ConversationLoadState>;
    connectionStateByConversation: Record<string, ConnectionState>;
    dirtyConversations: Record<string, boolean>;
    readInFlight: Record<string, boolean>;

    ensureConversationState: (conversationId: string) => void;
    setConversationLoading: (conversationId: string, patch: Partial<ConversationLoadState>) => void;
    setConversationPage: (conversationId: string, messages: Message[], options?: { append?: boolean; cursor?: string | null; hasMore?: boolean }) => void;
    upsertMessage: (message: Message) => void;
    upsertMessages: (conversationId: string, messages: Message[]) => void;
    upsertReceipt: (receipt: MessageReceipt) => void;
    replaceTempMessage: (conversationId: string, tempId: string, confirmedMessage: Message) => void;
    removeMessage: (conversationId: string, messageId: string) => void;
    setMessageStatus: (conversationId: string, messageId: string, status: MessageClientStatus, errorMessage?: string | null) => void;
    setConversationConnection: (conversationId: string, status: ConnectionState) => void;
    markConversationDirty: (conversationId: string, isDirty?: boolean) => void;
    setReadInFlight: (conversationId: string, inFlight: boolean) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
    messagesByConversation: {},
    loadStateByConversation: {},
    connectionStateByConversation: {},
    dirtyConversations: {},
    readInFlight: {},

    ensureConversationState: (conversationId) => {
        const loadState = get().loadStateByConversation[conversationId];
        if (loadState) {
            return;
        }

        set((state) => ({
            loadStateByConversation: {
                ...state.loadStateByConversation,
                [conversationId]: defaultLoadState(),
            },
            connectionStateByConversation: {
                ...state.connectionStateByConversation,
                [conversationId]: 'disconnected',
            },
        }));
    },

    setConversationLoading: (conversationId, patch) => {
        set((state) => ({
            loadStateByConversation: {
                ...state.loadStateByConversation,
                [conversationId]: {
                    ...(state.loadStateByConversation[conversationId] || defaultLoadState()),
                    ...patch,
                },
            },
        }));
    },

    setConversationPage: (conversationId, messages, options) => {
        set((state) => {
            const existing = state.messagesByConversation[conversationId] || [];
            const merged = options?.append ? mergeMessages(existing, messages) : mergeMessages([], messages);
            const lastMessage = merged[merged.length - 1];

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: merged,
                },
                loadStateByConversation: {
                    ...state.loadStateByConversation,
                    [conversationId]: {
                        ...(state.loadStateByConversation[conversationId] || defaultLoadState()),
                        status: 'ready',
                        error: null,
                        cursor: options?.hasMore ? merged[0]?.created_at || options?.cursor || null : null,
                        lastSyncedAt: lastMessage?.created_at || state.loadStateByConversation[conversationId]?.lastSyncedAt || null,
                        inFlightRequestId: null,
                    },
                },
            };
        });
    },

    upsertMessage: (message) => {
        set((state) => {
            const existing = state.messagesByConversation[message.conversation_id] || [];
            const nextMessages = mergeMessages(existing, [message]);
            const loadState = state.loadStateByConversation[message.conversation_id] || defaultLoadState();

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [message.conversation_id]: nextMessages,
                },
                loadStateByConversation: {
                    ...state.loadStateByConversation,
                    [message.conversation_id]: {
                        ...loadState,
                        lastSyncedAt: message.created_at,
                    },
                },
                dirtyConversations: {
                    ...state.dirtyConversations,
                    [message.conversation_id]: false,
                },
            };
        });
    },

    upsertMessages: (conversationId, messages) => {
        set((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: mergeMessages(state.messagesByConversation[conversationId] || [], messages),
            },
        }));
    },

    upsertReceipt: (receipt) => {
        set((state) => {
            const entries = Object.entries(state.messagesByConversation);
            let targetConversationId: string | null = null;

            for (const [conversationId, messages] of entries) {
                if (messages.some((message) => message.id === receipt.message_id)) {
                    targetConversationId = conversationId;
                    break;
                }
            }

            if (!targetConversationId) {
                return state;
            }

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [targetConversationId]: state.messagesByConversation[targetConversationId].map((message) =>
                        message.id === receipt.message_id
                            ? { ...message, receipts: mergeReceipts(message.receipts, [receipt]) }
                            : message,
                    ),
                },
            };
        });
    },

    replaceTempMessage: (conversationId, tempId, confirmedMessage) => {
        set((state) => {
            const messages = state.messagesByConversation[conversationId] || [];
            const replaced = messages
                .filter((message) => message.id !== confirmedMessage.id)
                .map((message) =>
                    message.id === tempId
                        ? {
                            ...confirmedMessage,
                            client_status: 'confirmed' as const,
                        }
                        : message,
                );

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: mergeMessages([], replaced),
                },
            };
        });
    },

    removeMessage: (conversationId, messageId) => {
        set((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: (state.messagesByConversation[conversationId] || []).filter(
                    (message) => message.id !== messageId,
                ),
            },
        }));
    },

    setMessageStatus: (conversationId, messageId, status, errorMessage = null) => {
        set((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: (state.messagesByConversation[conversationId] || []).map((message) =>
                    message.id === messageId
                        ? {
                            ...message,
                            client_status: status,
                            error_message: errorMessage,
                        }
                        : message,
                ),
            },
        }));
    },

    setConversationConnection: (conversationId, status) => {
        set((state) => ({
            connectionStateByConversation: {
                ...state.connectionStateByConversation,
                [conversationId]: status,
            },
        }));
    },

    markConversationDirty: (conversationId, isDirty = true) => {
        set((state) => ({
            dirtyConversations: {
                ...state.dirtyConversations,
                [conversationId]: isDirty,
            },
        }));
    },

    setReadInFlight: (conversationId, inFlight) => {
        set((state) => ({
            readInFlight: {
                ...state.readInFlight,
                [conversationId]: inFlight,
            },
        }));
    },
}));

interface ConversationState {
    conversations: Conversation[];
    activeConversationId: string | null;
    unreadCounts: Record<string, number>;
    listState: ConversationLoadState;

    setConversations: (conversations: Conversation[]) => void;
    upsertConversation: (conversation: Conversation) => void;
    removeConversation: (conversationId: string) => void;
    updateLastMessage: (conversationId: string, message: Message) => void;
    incrementUnreadCount: (conversationId: string) => void;
    resetUnreadCount: (conversationId: string) => void;
    setActiveConversation: (id: string | null) => void;
    setListState: (patch: Partial<ConversationLoadState>) => void;
}

const sortConversations = (conversations: Conversation[]) =>
    [...conversations].sort((left, right) => {
        const leftTime = left.last_message?.created_at || left.updated_at || left.created_at;
        const rightTime = right.last_message?.created_at || right.updated_at || right.created_at;
        return new Date(rightTime).getTime() - new Date(leftTime).getTime();
    });

export const useConversationStore = create<ConversationState>((set) => ({
    conversations: [],
    activeConversationId: null,
    unreadCounts: {},
    listState: defaultLoadState(),

    setConversations: (conversations) =>
        set(() => ({
            conversations: sortConversations(conversations),
            listState: {
                ...defaultLoadState(),
                status: 'ready',
                lastSyncedAt: new Date().toISOString(),
            },
        })),

    upsertConversation: (conversation) => {
        set((state) => {
            const existing = state.conversations.find((item) => item.id === conversation.id);
            const next = existing
                ? state.conversations.map((item) => (item.id === conversation.id ? mergeConversation(item, conversation) : item))
                : [conversation, ...state.conversations];

            return {
                conversations: sortConversations(next),
            };
        });
    },

    removeConversation: (conversationId) => {
        set((state) => ({
            conversations: state.conversations.filter((conversation) => conversation.id !== conversationId),
            unreadCounts: Object.fromEntries(
                Object.entries(state.unreadCounts).filter(([id]) => id !== conversationId),
            ),
            activeConversationId: state.activeConversationId === conversationId ? null : state.activeConversationId,
        }));
    },

    updateLastMessage: (conversationId, message) => {
        set((state) => ({
            conversations: sortConversations(
                state.conversations.map((conversation) =>
                    conversation.id === conversationId
                        ? {
                            ...conversation,
                            last_message: message,
                            updated_at: message.created_at,
                        }
                        : conversation,
                ),
            ),
        }));
    },

    incrementUnreadCount: (conversationId) => {
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [conversationId]: (state.unreadCounts[conversationId] || 0) + 1,
            },
        }));
    },

    resetUnreadCount: (conversationId) => {
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [conversationId]: 0,
            },
        }));
    },

    setActiveConversation: (id) => set({ activeConversationId: id }),

    setListState: (patch) => {
        set((state) => ({
            listState: {
                ...state.listState,
                ...patch,
            },
        }));
    },
}));
