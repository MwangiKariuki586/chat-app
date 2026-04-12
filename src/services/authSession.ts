import type { Session, AuthChangeEvent, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AuthStatus } from '@/types';
import { logError } from '@/lib/logger';

type AuthListener = (state: {
    status: AuthStatus;
    session: Session | null;
    user: User | null;
    event?: AuthChangeEvent;
    error?: string | null;
}) => void;

class AuthSessionService {
    private status: AuthStatus = 'booting';
    private session: Session | null = null;
    private user: User | null = null;
    private error: string | null = null;
    private listeners = new Set<AuthListener>();
    private started = false;
    private unsubscribe: (() => void) | null = null;

    async start() {
        if (this.started) {
            return;
        }

        this.started = true;

        try {
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                this.status = 'error';
                this.error = error.message;
            } else {
                this.session = data.session;
                this.user = data.session?.user ?? null;
                this.status = data.session?.user ? 'authenticated' : 'anonymous';
                this.error = null;
            }
        } catch (error) {
            this.status = 'error';
            this.error = error instanceof Error ? error.message : 'Failed to bootstrap auth session';
            logError('auth', 'Failed to bootstrap auth session', {
                error: this.error,
            });
        }

        this.emit();

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            this.session = session;
            this.user = session?.user ?? null;
            this.status = session?.user ? 'authenticated' : 'anonymous';
            this.error = null;
            this.emit(event);
        });

        this.unsubscribe = () => data.subscription.unsubscribe();
    }

    stop() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.started = false;
    }

    subscribe(listener: AuthListener) {
        this.listeners.add(listener);
        listener({
            status: this.status,
            session: this.session,
            user: this.user,
            error: this.error,
        });

        return () => {
            this.listeners.delete(listener);
        };
    }

    getCurrentUserId() {
        return this.user?.id ?? null;
    }

    getUser() {
        return this.user;
    }

    getSession() {
        return this.session;
    }

    getStatus() {
        return this.status;
    }

    async signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    }

    async signUp(email: string, password: string, name: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        });

        return { data, error };
    }

    async signOut() {
        return supabase.auth.signOut();
    }

    private emit(event?: AuthChangeEvent) {
        for (const listener of this.listeners) {
            listener({
                status: this.status,
                session: this.session,
                user: this.user,
                event,
                error: this.error,
            });
        }
    }
}

export const authSession = new AuthSessionService();
