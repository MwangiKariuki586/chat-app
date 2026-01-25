/**
 * Rate Limiting Utility
 * 
 * Prevents spam by limiting the number of actions within a time window.
 * Uses a sliding window approach for smooth rate limiting.
 */

interface RateLimitConfig {
    maxActions: number;      // Maximum actions allowed in the window
    windowMs: number;        // Time window in milliseconds
    cooldownMs?: number;     // Cooldown period after limit is hit
}

interface RateLimitState {
    timestamps: number[];
    cooldownUntil: number | null;
}

// Store rate limit state per key
const rateLimitStates = new Map<string, RateLimitState>();

/**
 * Check if an action is allowed within rate limits
 * Returns { allowed: boolean, retryAfter?: number }
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig
): { allowed: boolean; retryAfter?: number; remaining?: number } {
    const now = Date.now();
    const { maxActions, windowMs, cooldownMs = 0 } = config;

    // Get or initialize state
    let state = rateLimitStates.get(key);
    if (!state) {
        state = { timestamps: [], cooldownUntil: null };
        rateLimitStates.set(key, state);
    }

    // Check if in cooldown period
    if (state.cooldownUntil && now < state.cooldownUntil) {
        const retryAfter = Math.ceil((state.cooldownUntil - now) / 1000);
        return { allowed: false, retryAfter, remaining: 0 };
    }

    // Clear cooldown if expired
    if (state.cooldownUntil && now >= state.cooldownUntil) {
        state.cooldownUntil = null;
    }

    // Remove timestamps outside the window
    const windowStart = now - windowMs;
    state.timestamps = state.timestamps.filter((t) => t > windowStart);

    // Check if under limit
    const remaining = maxActions - state.timestamps.length;
    if (state.timestamps.length >= maxActions) {
        // Set cooldown if configured
        if (cooldownMs > 0) {
            state.cooldownUntil = now + cooldownMs;
        }
        const oldestTimestamp = state.timestamps[0] || now;
        const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
        return { allowed: false, retryAfter, remaining: 0 };
    }

    // Action allowed, record timestamp
    state.timestamps.push(now);
    return { allowed: true, remaining: remaining - 1 };
}

/**
 * Reset rate limit state for a key
 */
export function resetRateLimit(key: string): void {
    rateLimitStates.delete(key);
}

/**
 * Clear all rate limit state (for testing)
 */
export function clearAllRateLimits(): void {
    rateLimitStates.clear();
}

// =============================================
// Pre-configured Rate Limiters
// =============================================

const MESSAGE_RATE_LIMIT: RateLimitConfig = {
    maxActions: 10,        // 10 messages
    windowMs: 60 * 1000,   // per minute
    cooldownMs: 5 * 1000,  // 5 second cooldown when exceeded
};

const NEW_CONVERSATION_RATE_LIMIT: RateLimitConfig = {
    maxActions: 5,         // 5 new conversations
    windowMs: 60 * 1000,   // per minute
    cooldownMs: 30 * 1000, // 30 second cooldown when exceeded
};

const SEARCH_RATE_LIMIT: RateLimitConfig = {
    maxActions: 30,        // 30 searches
    windowMs: 60 * 1000,   // per minute
    cooldownMs: 0,         // no cooldown, just wait
};

/**
 * Check if message sending is allowed
 */
export function canSendMessage(userId: string): {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
} {
    return checkRateLimit(`message:${userId}`, MESSAGE_RATE_LIMIT);
}

/**
 * Check if creating a new conversation is allowed
 */
export function canCreateConversation(userId: string): {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
} {
    return checkRateLimit(`conversation:${userId}`, NEW_CONVERSATION_RATE_LIMIT);
}

/**
 * Check if search is allowed
 */
export function canSearch(userId: string): {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
} {
    return checkRateLimit(`search:${userId}`, SEARCH_RATE_LIMIT);
}

// =============================================
// React Hook for Rate Limiting
// =============================================

export interface UseRateLimitResult {
    allowed: boolean;
    remaining: number;
    cooldownSeconds: number;
    checkLimit: () => boolean;
    resetLimit: () => void;
}

