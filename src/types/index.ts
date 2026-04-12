// User type from our database
export interface User {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    created_at: string;
}

// Conversation (1:1 or group)
export interface Conversation {
    id: string;
    name: string | null;
    is_group: boolean;
    created_at: string;
    updated_at?: string;
    // Joined data
    participants?: ConversationParticipant[];
    last_message?: Message | null;
}

// Links users to conversations
export interface ConversationParticipant {
    id: string;
    conversation_id: string;
    user_id: string;
    joined_at: string;
    left_at?: string | null;      // When user left/deleted conversation (null = active)
    visible_from?: string | null; // Messages before this are hidden (for fresh start)
    // Joined data
    user?: User;
}

// Chat message
export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    client_temp_id?: string | null;
    client_status?: MessageClientStatus;
    error_message?: string | null;
    // Joined data
    sender?: User;
    receipts?: MessageReceipt[];
}

// Read receipts for messages
export interface MessageReceipt {
    id: string;
    message_id: string;
    user_id: string;
    delivered_at: string | null;
    read_at: string | null;
    // Joined data
    user?: User;
}

// Supabase realtime payload types
export interface RealtimePayload<T> {
    commit_timestamp: string;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T;
    old: T | null;
    schema: string;
    table: string;
}

export type MessageClientStatus = 'pending' | 'confirmed' | 'failed';

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'paginating' | 'syncing' | 'stale' | 'error';

export interface ConversationLoadState {
    status: ResourceStatus;
    error: string | null;
    cursor: string | null;
    lastSyncedAt: string | null;
    inFlightRequestId: string | null;
}

// Connection states for realtime
export type ConnectionState =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'
    | 'retrying'
    | 'degraded';

export type AuthStatus = 'booting' | 'authenticated' | 'anonymous' | 'error';

export type ChatRealtimeEvent =
    | { type: 'message_inserted'; message: Message }
    | { type: 'receipt_upserted'; receipt: MessageReceipt }
    | { type: 'conversation_upserted'; conversation: Conversation }
    | { type: 'presence_synced'; userIds: string[] };
