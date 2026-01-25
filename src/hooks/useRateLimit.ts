import { useState, useCallback, useEffect, useRef } from 'react';
import { checkRateLimit, resetRateLimit } from '@/lib/rateLimit';

interface UseRateLimitOptions {
    key: string;
    maxActions: number;
    windowMs: number;
    cooldownMs?: number;
}

interface UseRateLimitResult {
    allowed: boolean;
    remaining: number;
    cooldownSeconds: number;
    checkAndRecord: () => boolean;
    reset: () => void;
}


export function useRateLimit(options: UseRateLimitOptions): UseRateLimitResult {
    const { key, maxActions, windowMs, cooldownMs = 0 } = options;

    const [state, setState] = useState({
        allowed: true,
        remaining: maxActions,
        cooldownSeconds: 0,
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Countdown timer for cooldown
    useEffect(() => {
        if (state.cooldownSeconds > 0) {
            intervalRef.current = setInterval(() => {
                setState((prev) => {
                    const newCooldown = prev.cooldownSeconds - 1;
                    if (newCooldown <= 0) {
                        // Cooldown finished, reset allowed state
                        return {
                            allowed: true,
                            remaining: maxActions,
                            cooldownSeconds: 0,
                        };
                    }
                    return {
                        ...prev,
                        cooldownSeconds: newCooldown,
                    };
                });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [state.cooldownSeconds, maxActions]);

    const checkAndRecord = useCallback(() => {
        const result = checkRateLimit(key, { maxActions, windowMs, cooldownMs });

        setState({
            allowed: result.allowed,
            remaining: result.remaining ?? 0,
            cooldownSeconds: result.retryAfter ?? 0,
        });

        return result.allowed;
    }, [key, maxActions, windowMs, cooldownMs]);

    const reset = useCallback(() => {
        resetRateLimit(key);
        setState({
            allowed: true,
            remaining: maxActions,
            cooldownSeconds: 0,
        });
    }, [key, maxActions]);

    return {
        ...state,
        checkAndRecord,
        reset,
    };
}

// Pre-configured hooks for common use cases

/**
 * Rate limit for sending messages (10 per minute)
 */
export function useMessageRateLimit(userId: string) {
    return useRateLimit({
        key: `message:${userId}`,
        maxActions: 10,
        windowMs: 60 * 1000,
        cooldownMs: 5 * 1000,
    });
}

/**
 * Rate limit for creating conversations (5 per minute)
 */
export function useConversationRateLimit(userId: string) {
    return useRateLimit({
        key: `conversation:${userId}`,
        maxActions: 5,
        windowMs: 60 * 1000,
        cooldownMs: 30 * 1000,
    });
}

/**
 * Rate limit for search (30 per minute)
 */
export function useSearchRateLimit(userId: string) {
    return useRateLimit({
        key: `search:${userId}`,
        maxActions: 30,
        windowMs: 60 * 1000,
        cooldownMs: 0,
    });
}
