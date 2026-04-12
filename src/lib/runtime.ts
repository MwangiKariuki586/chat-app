export interface Clock {
    now(): Date;
    isoNow(): string;
}

export interface IdGenerator {
    tempMessageId(): string;
    requestId(prefix: string): string;
    toastId(): string;
}

export interface Connectivity {
    isOnline(): boolean;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 10);

export const runtimeClock: Clock = {
    now: () => new Date(),
    isoNow: () => new Date().toISOString(),
};

export const runtimeIds: IdGenerator = {
    tempMessageId: () => `temp-${crypto.randomUUID()}`,
    requestId: (prefix) => `${prefix}-${crypto.randomUUID()}`,
    toastId: () => `toast-${crypto.randomUUID()}`,
};

export const runtimeConnectivity: Connectivity = {
    isOnline: () => navigator.onLine,
};

export const createBackoffDelay = (attempt: number, baseDelayMs: number) => {
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(baseDelayMs * Math.pow(2, attempt), 15000) + jitter;
};

export const createStableKey = (...parts: Array<string | null | undefined>) =>
    parts.filter(Boolean).join(':') || randomSuffix();
