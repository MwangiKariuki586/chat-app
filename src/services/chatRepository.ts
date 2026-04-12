import { supabase } from '@/lib/supabase';
import type {
    Conversation,
    Message,
    MessageReceipt,
    User,
} from '@/types';

export type RepositoryErrorKind = 'auth' | 'transport' | 'domain' | 'unknown';

export interface RepositoryError {
    kind: RepositoryErrorKind;
    message: string;
}

export interface RepositoryResult<T> {
    data: T | null;
    error: RepositoryError | null;
}

const asRepositoryError = (error: unknown): RepositoryError => {
    if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        const normalized = message.toLowerCase();

        if (normalized.includes('not authenticated')) {
            return { kind: 'auth', message };
        }

        if (normalized.includes('fetch') || normalized.includes('network')) {
            return { kind: 'transport', message };
        }

        return { kind: 'domain', message };
    }

    return { kind: 'unknown', message: 'Unknown repository error' };
};

const withSenderAndReceipts = `
    *,
    sender:users!sender_id(id, name, email, avatar_url),
    receipts:message_receipts(*)
`;

class ChatRepository {
    async ensureUserProfile(user: { id: string; email?: string | null; user_metadata?: { name?: string } | null }) {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            return { error: asRepositoryError(error) };
        }

        if (data) {
            return { error: null };
        }

        const { error: insertError } = await supabase.from('users').insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            avatar_url: null,
        });

        return {
            error: insertError ? asRepositoryError(insertError) : null,
        };
    }

    async fetchUsers(limit = 20): Promise<RepositoryResult<User[]>> {
        try {
            const { data, error } = await supabase.from('users').select('*').limit(limit);
            if (error) {
                throw error;
            }

            return { data: data || [], error: null };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async fetchConversationParticipation(conversationId: string, userId: string) {
        try {
            const { data, error } = await supabase
                .from('conversation_participants')
                .select('visible_from, left_at')
                .eq('conversation_id', conversationId)
                .eq('user_id', userId)
                .single();

            if (error) {
                throw error;
            }

            return { data, error: null };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async fetchMessagesPage(
        conversationId: string,
        userId: string,
        options?: { before?: string | null; pageSize?: number; since?: string | null },
    ): Promise<RepositoryResult<{ messages: Message[]; hasMore: boolean }>> {
        const pageSize = options?.pageSize ?? 25;

        try {
            const participation = await this.fetchConversationParticipation(conversationId, userId);
            if (participation.error) {
                throw new Error(participation.error.message);
            }

            let query = supabase
                .from('messages')
                .select(withSenderAndReceipts)
                .eq('conversation_id', conversationId);

            if (participation.data?.visible_from) {
                query = query.gte('created_at', participation.data.visible_from);
            }

            if (options?.before) {
                query = query.lt('created_at', options.before);
            }

            if (options?.since) {
                query = query.gt('created_at', options.since);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(pageSize);

            if (error) {
                throw error;
            }

            const messages = (data || []).reverse();
            return {
                data: {
                    messages,
                    hasMore: (data?.length || 0) >= pageSize,
                },
                error: null,
            };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async fetchConversationById(conversationId: string): Promise<RepositoryResult<Conversation>> {
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    participants:conversation_participants(
                        id,
                        user_id,
                        conversation_id,
                        joined_at,
                        left_at,
                        visible_from,
                        user:users(id, name, email, avatar_url, created_at)
                    )
                `)
                .eq('id', conversationId)
                .single();

            if (error) {
                throw error;
            }

            return { data: data as Conversation, error: null };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async fetchConversations(userId: string): Promise<RepositoryResult<Conversation[]>> {
        try {
            const { data: activeParticipations, error: participationError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', userId)
                .is('left_at', null);

            if (participationError) {
                throw participationError;
            }

            const ids = activeParticipations?.map((item) => item.conversation_id) || [];
            if (ids.length === 0) {
                return { data: [], error: null };
            }

            const { data: conversations, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    participants:conversation_participants(
                        id,
                        user_id,
                        conversation_id,
                        joined_at,
                        left_at,
                        visible_from,
                        user:users(id, name, email, avatar_url, created_at)
                    )
                `)
                .in('id', ids)
                .order('updated_at', { ascending: false });

            if (error) {
                throw error;
            }

            const latestMessageBatch = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:users!sender_id(id, name, email, avatar_url)
                `)
                .in('conversation_id', ids)
                .order('created_at', { ascending: false });

            if (latestMessageBatch.error) {
                throw latestMessageBatch.error;
            }

            const latestByConversation = new Map<string, Message>();
            for (const message of latestMessageBatch.data || []) {
                if (!latestByConversation.has(message.conversation_id)) {
                    latestByConversation.set(message.conversation_id, message as Message);
                }
            }

            return {
                data: (conversations || []).map((conversation) => ({
                    ...conversation,
                    last_message: latestByConversation.get(conversation.id) || null,
                })) as Conversation[],
                error: null,
            };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async createConversation(ownerId: string, participantIds: string[], name?: string | null): Promise<RepositoryResult<Conversation>> {
        try {
            const conversationId = crypto.randomUUID();
            const participants = [...new Set([ownerId, ...participantIds])];

            const { error: conversationError } = await supabase.from('conversations').insert({
                id: conversationId,
                name: name || null,
                is_group: participants.length > 2,
            });

            if (conversationError) {
                throw conversationError;
            }

            const { error: participantError } = await supabase
                .from('conversation_participants')
                .insert(
                    participants.map((userId) => ({
                        conversation_id: conversationId,
                        user_id: userId,
                    })),
                );

            if (participantError) {
                throw participantError;
            }

            return this.fetchConversationById(conversationId);
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async getOrCreateDirectConversation(currentUserId: string, otherUserId: string): Promise<RepositoryResult<Conversation>> {
        try {
            const { data: myParticipations, error: mineError } = await supabase
                .from('conversation_participants')
                .select('conversation_id, left_at')
                .eq('user_id', currentUserId);

            if (mineError) {
                throw mineError;
            }

            const myConversationIds = myParticipations?.map((item) => item.conversation_id) || [];
            if (myConversationIds.length > 0) {
                const { data: sharedConversations, error: sharedError } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .eq('user_id', otherUserId)
                    .is('left_at', null)
                    .in('conversation_id', myConversationIds);

                if (sharedError) {
                    throw sharedError;
                }

                for (const shared of sharedConversations || []) {
                    const fetched = await this.fetchConversationById(shared.conversation_id);
                    if (!fetched.data || fetched.data.is_group) {
                        continue;
                    }

                    const myParticipation = fetched.data.participants?.find((participant) => participant.user_id === currentUserId);
                    if (myParticipation?.left_at) {
                        const rejoin = await this.rejoinConversation(shared.conversation_id, currentUserId);
                        if (rejoin.data) {
                            return rejoin;
                        }
                    }

                    return fetched;
                }
            }

            return this.createConversation(currentUserId, [otherUserId], null);
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async rejoinConversation(conversationId: string, userId: string): Promise<RepositoryResult<Conversation>> {
        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('conversation_participants')
                .update({
                    left_at: null,
                    visible_from: now,
                })
                .eq('conversation_id', conversationId)
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            return this.fetchConversationById(conversationId);
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async leaveConversation(conversationId: string, userId: string): Promise<RepositoryResult<null>> {
        try {
            const { error } = await supabase
                .from('conversation_participants')
                .update({ left_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            return { data: null, error: null };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async sendMessage(input: {
        conversationId: string;
        senderId: string;
        content: string;
    }): Promise<RepositoryResult<Message>> {
        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: input.conversationId,
                    sender_id: input.senderId,
                    content: input.content,
                })
                .select(`
                    *,
                    sender:users!sender_id(id, name, email, avatar_url)
                `)
                .single();

            if (error) {
                throw error;
            }

            return {
                data: {
                    ...(data as Message),
                    client_status: 'confirmed',
                },
                error: null,
            };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }

    async markMessagesRead(_conversationId: string, userId: string, messageIds: string[]): Promise<RepositoryResult<MessageReceipt[]>> {
        if (messageIds.length === 0) {
            return { data: [], error: null };
        }

        try {
            const now = new Date().toISOString();
            const payload = messageIds.map((messageId) => ({
                message_id: messageId,
                user_id: userId,
                read_at: now,
            }));

            const { data, error } = await supabase
                .from('message_receipts')
                .upsert(payload, {
                    onConflict: 'message_id,user_id',
                })
                .select('*');

            if (error) {
                throw error;
            }

            return { data: (data || []) as MessageReceipt[], error: null };
        } catch (error) {
            return { data: null, error: asRepositoryError(error) };
        }
    }
}

export const chatRepository = new ChatRepository();
