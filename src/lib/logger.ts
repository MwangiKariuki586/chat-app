const isDebugEnabled = import.meta.env.DEV;

type LogLevel = 'info' | 'warn' | 'error';

export function log(scope: string, message: string, metadata?: Record<string, unknown>) {
    if (!isDebugEnabled) {
        return;
    }

    const payload = metadata ? [message, metadata] : [message];
    console.info(`[${scope}]`, ...payload);
}

export function logWarn(scope: string, message: string, metadata?: Record<string, unknown>) {
    if (!isDebugEnabled) {
        return;
    }

    const payload = metadata ? [message, metadata] : [message];
    console.warn(`[${scope}]`, ...payload);
}

export function logError(scope: string, message: string, metadata?: Record<string, unknown>) {
    const payload = metadata ? [message, metadata] : [message];
    console.error(`[${scope}]`, ...payload);
}

export type { LogLevel };
