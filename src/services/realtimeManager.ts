import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createBackoffDelay, createStableKey, runtimeClock } from '@/lib/runtime';
import { log, logWarn } from '@/lib/logger';
import type { ConnectionState, MessageReceipt, Message } from '@/types';

type StatusListener = (status: ConnectionState) => void;

interface ManagedSubscription {
    key: string;
    scope: 'conversation-list' | 'messages' | 'presence';
    channel: RealtimeChannel | null;
    attempt: number;
    stopped: boolean;
    retryTimer: ReturnType<typeof setTimeout> | null;
    createChannel: () => RealtimeChannel;
    onReconnect?: () => void | Promise<void>;
    statusListener?: StatusListener;
}

class RealtimeManager {
    private subscriptions = new Map<string, ManagedSubscription>();

    subscribeToConversationMessages(input: {
        conversationId: string;
        onMessage: (message: Message) => void;
        onReceipt: (receipt: MessageReceipt) => void;
        onReconnect?: () => void | Promise<void>;
        onStatus?: StatusListener;
    }) {
        const key = createStableKey('messages', input.conversationId);
        return this.createManagedSubscription({
            key,
            scope: 'messages',
            onReconnect: input.onReconnect,
            statusListener: input.onStatus,
            createChannel: () =>
                supabase
                    .channel(key)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'messages',
                            filter: `conversation_id=eq.${input.conversationId}`,
                        },
                        (payload) => input.onMessage(payload.new as Message),
                    )
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'message_receipts',
                        },
                        (payload) => input.onReceipt(payload.new as MessageReceipt),
                    ),
        });
    }

    subscribeToConversationList(input: {
        userId: string;
        onMessage: (message: Message) => void;
        onStatus?: StatusListener;
        onReconnect?: () => void | Promise<void>;
    }) {
        const key = createStableKey('conversation-list', input.userId);
        return this.createManagedSubscription({
            key,
            scope: 'conversation-list',
            onReconnect: input.onReconnect,
            statusListener: input.onStatus,
            createChannel: () =>
                supabase
                    .channel(key)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'messages',
                        },
                        (payload) => input.onMessage(payload.new as Message),
                    ),
        });
    }

    subscribeToPresence(input: {
        userId: string;
        onPresenceSync: (userIds: string[]) => void;
        onStatus?: StatusListener;
    }) {
        const key = createStableKey('presence', input.userId);
        return this.createManagedSubscription({
            key,
            scope: 'presence',
            statusListener: input.onStatus,
            createChannel: () => {
                const channel = supabase.channel(key, {
                    config: {
                        presence: {
                            key: input.userId,
                        },
                    },
                });

                return channel.on('presence', { event: 'sync' }, () => {
                    const presenceState = channel.presenceState();
                    const userIds = new Set<string>();

                    Object.values(presenceState).forEach((presences) => {
                        (presences as Array<{ user_id?: string }>).forEach((presence) => {
                            if (presence.user_id) {
                                userIds.add(presence.user_id);
                            }
                        });
                    });

                    input.onPresenceSync(Array.from(userIds));
                });
            },
            onReconnect: async () => {
                const subscription = this.subscriptions.get(key);
                if (subscription?.channel) {
                    await subscription.channel.track({
                        user_id: input.userId,
                        online_at: runtimeClock.isoNow(),
                    });
                }
            },
        });
    }

    disconnect(key: string) {
        const subscription = this.subscriptions.get(key);
        if (!subscription) {
            return;
        }

        subscription.stopped = true;
        if (subscription.retryTimer) {
            clearTimeout(subscription.retryTimer);
        }
        subscription.channel?.unsubscribe();
        this.subscriptions.delete(key);
    }

    disconnectAll() {
        for (const key of this.subscriptions.keys()) {
            this.disconnect(key);
        }
    }

    private createManagedSubscription(input: Omit<ManagedSubscription, 'channel' | 'attempt' | 'stopped' | 'retryTimer'>) {
        this.disconnect(input.key);

        const subscription: ManagedSubscription = {
            ...input,
            channel: null,
            attempt: 0,
            stopped: false,
            retryTimer: null,
        };

        this.subscriptions.set(input.key, subscription);
        this.startSubscription(subscription);

        return () => {
            this.disconnect(input.key);
        };
    }

    private startSubscription(subscription: ManagedSubscription) {
        if (subscription.stopped) {
            return;
        }

        subscription.statusListener?.(subscription.attempt === 0 ? 'connecting' : 'retrying');
        const channel = subscription.createChannel();
        subscription.channel = channel;

        channel.subscribe(async (status, error) => {
            if (subscription.stopped) {
                return;
            }

            if (status === 'SUBSCRIBED') {
                subscription.attempt = 0;
                subscription.statusListener?.('connected');
                log('realtime', 'subscription active', {
                    key: subscription.key,
                    scope: subscription.scope,
                });

                if (subscription.onReconnect) {
                    await subscription.onReconnect();
                }
                return;
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                if (error) {
                    logWarn('realtime', 'subscription degraded', {
                        key: subscription.key,
                        scope: subscription.scope,
                        status,
                        error,
                    });
                }
                subscription.statusListener?.(status === 'CLOSED' ? 'disconnected' : 'degraded');
                this.scheduleRetry(subscription);
            }
        });
    }

    private scheduleRetry(subscription: ManagedSubscription) {
        if (subscription.stopped) {
            return;
        }

        subscription.channel?.unsubscribe();
        subscription.channel = null;

        if (subscription.retryTimer) {
            clearTimeout(subscription.retryTimer);
        }

        const attempt = subscription.attempt;
        const delay = createBackoffDelay(attempt, 1000);
        subscription.attempt += 1;
        subscription.retryTimer = setTimeout(() => {
            this.startSubscription(subscription);
        }, delay);
    }
}

export const realtimeManager = new RealtimeManager();
