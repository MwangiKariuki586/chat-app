import { authSession } from '@/services/authSession';
import { chatRepository } from '@/services/chatRepository';
import { offlineQueueStore } from '@/services/offlineQueueStore';
import { useConversationStore, useMessageStore } from '@/stores';
import type { Conversation, Message, MessageReceipt } from '@/types';
import { runtimeClock, runtimeIds, runtimeConnectivity } from '@/lib/runtime';
import { logWarn } from '@/lib/logger';

const optimisticConversationIdPrefix = 'temp-chat-';

const toPendingMessage = (conversationId: string, senderId: string, content: string, tempId: string): Message => ({
    id: tempId,
    conversation_id: conversationId,
    sender_id: senderId,
    content,
    created_at: runtimeClock.isoNow(),
    receipts: [],
    client_status: 'pending',
    client_temp_id: tempId,
});

export async function loadConversations() {
    const userId = authSession.getCurrentUserId();
    if (!userId) {
        useConversationStore.getState().setListState({
            status: 'error',
            error: 'Not authenticated',
        });
        return;
    }

    const requestId = runtimeIds.requestId('conversations');
    useConversationStore.getState().setListState({
        status: 'loading',
        error: null,
        inFlightRequestId: requestId,
    });

    const result = await chatRepository.fetchConversations(userId);
    const listState = useConversationStore.getState().listState;
    if (listState.inFlightRequestId !== requestId) {
        return;
    }

    if (result.error) {
        useConversationStore.getState().setListState({
            status: 'error',
            error: result.error.message,
            inFlightRequestId: null,
        });
        return;
    }

    useConversationStore.getState().setConversations(result.data || []);
    useConversationStore.getState().setListState({
        status: 'ready',
        error: null,
        lastSyncedAt: runtimeClock.isoNow(),
        inFlightRequestId: null,
    });
}

export async function loadMessages(conversationId: string, options?: { append?: boolean; before?: string | null; since?: string | null }) {
    const userId = authSession.getCurrentUserId();
    if (!userId) {
        return;
    }

    const requestId = runtimeIds.requestId(`messages-${conversationId}`);
    const messageStore = useMessageStore.getState();
    messageStore.ensureConversationState(conversationId);
    messageStore.setConversationLoading(conversationId, {
        status: options?.append ? 'paginating' : options?.since ? 'syncing' : 'loading',
        error: null,
        inFlightRequestId: requestId,
    });

    const result = await chatRepository.fetchMessagesPage(conversationId, userId, {
        before: options?.before || null,
        since: options?.since || null,
    });

    const currentLoadState = useMessageStore.getState().loadStateByConversation[conversationId];
    if (currentLoadState?.inFlightRequestId !== requestId) {
        return;
    }

    if (result.error) {
        useMessageStore.getState().setConversationLoading(conversationId, {
            status: 'error',
            error: result.error.message,
            inFlightRequestId: null,
        });
        return;
    }

    useMessageStore.getState().setConversationPage(conversationId, result.data?.messages || [], {
        append: options?.append,
        hasMore: result.data?.hasMore,
    });
}

export async function syncConversationSinceLastKnown(conversationId: string) {
    const state = useMessageStore.getState().loadStateByConversation[conversationId];
    await loadMessages(conversationId, {
        append: true,
        since: state?.lastSyncedAt || null,
    });
}

export async function markConversationRead(conversationId: string) {
    const userId = authSession.getCurrentUserId();
    if (!userId) {
        return;
    }

    const messageStore = useMessageStore.getState();
    if (messageStore.readInFlight[conversationId]) {
        return;
    }

    const messages = messageStore.messagesByConversation[conversationId] || [];
    const unreadMessageIds = messages
        .filter(
            (message) =>
                message.sender_id !== userId &&
                !message.receipts?.some((receipt) => receipt.user_id === userId && Boolean(receipt.read_at)),
        )
        .map((message) => message.id);

    if (unreadMessageIds.length === 0) {
        return;
    }

    messageStore.setReadInFlight(conversationId, true);
    const result = await chatRepository.markMessagesRead(conversationId, userId, unreadMessageIds);
    messageStore.setReadInFlight(conversationId, false);

    if (result.error) {
        logWarn('messages', 'Failed to mark conversation as read', {
            conversationId,
            error: result.error.message,
        });
        return;
    }

    for (const receipt of result.data || []) {
        useMessageStore.getState().upsertReceipt(receipt);
    }
}

export async function beginDirectConversationByUserId(otherUserId: string) {
    const userId = authSession.getCurrentUserId();
    if (!userId) {
        return { data: null, error: new Error('Not authenticated') };
    }

    const result = await chatRepository.getOrCreateDirectConversation(userId, otherUserId);
    if (result.error || !result.data) {
        return { data: null, error: new Error(result.error?.message || 'Failed to start conversation') };
    }

    useConversationStore.getState().upsertConversation(result.data);
    return { data: result.data, error: null };
}

export async function leaveConversation(conversationId: string) {
    const userId = authSession.getCurrentUserId();
    if (!userId) {
        return { error: new Error('Not authenticated') };
    }

    const result = await chatRepository.leaveConversation(conversationId, userId);
    if (result.error) {
        return { error: new Error(result.error.message) };
    }

    useConversationStore.getState().removeConversation(conversationId);
    return { error: null };
}

async function resolveConversationId(conversationId: string) {
    if (!conversationId.startsWith(optimisticConversationIdPrefix)) {
        return { data: conversationId, error: null };
    }

    const otherUserId = conversationId.slice(optimisticConversationIdPrefix.length);
    const result = await beginDirectConversationByUserId(otherUserId);
    if (result.error || !result.data) {
        return { data: null, error: result.error || new Error('Failed to resolve conversation') };
    }

    useConversationStore.getState().removeConversation(conversationId);
    return { data: result.data.id, error: null };
}

export async function sendMessage(conversationId: string, content: string) {
    const userId = authSession.getCurrentUserId();
    if (!userId) {
        return { error: new Error('Not authenticated'), newConversationId: undefined as string | undefined };
    }

    const tempId = runtimeIds.tempMessageId();
    useMessageStore.getState().upsertMessage(toPendingMessage(conversationId, userId, content, tempId));

    if (!runtimeConnectivity.isOnline()) {
        offlineQueueStore.enqueue({
            id: tempId,
            conversationId,
            content,
            createdAt: runtimeClock.isoNow(),
        });

        return { error: null, newConversationId: undefined as string | undefined };
    }

    const resolvedConversation = await resolveConversationId(conversationId);
    if (resolvedConversation.error || !resolvedConversation.data) {
        useMessageStore.getState().setMessageStatus(conversationId, tempId, 'failed', resolvedConversation.error?.message || null);
        return { error: resolvedConversation.error || new Error('Failed to resolve conversation'), newConversationId: undefined as string | undefined };
    }

    const finalConversationId = resolvedConversation.data;
    if (finalConversationId !== conversationId) {
        useMessageStore.getState().removeMessage(conversationId, tempId);
        useMessageStore.getState().upsertMessage(toPendingMessage(finalConversationId, userId, content, tempId));
    }

    const result = await chatRepository.sendMessage({
        conversationId: finalConversationId,
        senderId: userId,
        content,
    });

    if (result.error || !result.data) {
        if (result.error?.kind === 'transport') {
            offlineQueueStore.enqueue({
                id: tempId,
                conversationId: finalConversationId,
                content,
                createdAt: runtimeClock.isoNow(),
            });
            return {
                error: null,
                newConversationId: finalConversationId !== conversationId ? finalConversationId : undefined,
            };
        }

        useMessageStore.getState().setMessageStatus(
            finalConversationId,
            tempId,
            'failed',
            result.error?.message || 'Failed to send message',
        );
        return { error: new Error(result.error?.message || 'Failed to send message'), newConversationId: undefined as string | undefined };
    }

    useMessageStore.getState().replaceTempMessage(finalConversationId, tempId, result.data);
    useConversationStore.getState().updateLastMessage(finalConversationId, result.data);

    return {
        error: null,
        newConversationId: finalConversationId !== conversationId ? finalConversationId : undefined,
    };
}

export function receiveRealtimeMessage(message: Message) {
    useMessageStore.getState().upsertMessage({
        ...message,
        client_status: message.client_status || 'confirmed',
    });
    useConversationStore.getState().updateLastMessage(message.conversation_id, message);
}

export function receiveRealtimeReceipt(receipt: MessageReceipt) {
    useMessageStore.getState().upsertReceipt(receipt);
}

export function receiveRealtimeConversation(conversation: Conversation) {
    useConversationStore.getState().upsertConversation(conversation);
}
