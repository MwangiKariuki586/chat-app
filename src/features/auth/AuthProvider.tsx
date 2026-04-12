/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { authSession } from '@/services/authSession';
import { chatRepository } from '@/services/chatRepository';
import { realtimeManager } from '@/services/realtimeManager';
import { offlineQueueCoordinator } from '@/services/offlineQueueCoordinator';
import { offlineQueueStore } from '@/services/offlineQueueStore';
import type { AuthStatus } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('booting');
  const ensuredProfileRef = useRef<string | null>(null);

  useEffect(() => {
    void authSession.start();

    return authSession.subscribe(({ status, session, user }) => {
      setStatus(status);
      setSession(session);
      setUser(user);

      if (status === 'anonymous') {
        realtimeManager.disconnectAll();
        offlineQueueCoordinator.reset();
        ensuredProfileRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !user || ensuredProfileRef.current === user.id) {
      return;
    }

    ensuredProfileRef.current = user.id;
    void chatRepository.ensureUserProfile(user);
  }, [status, user]);

  useEffect(() => {
    if (status === 'authenticated' && offlineQueueStore.isOnline() && offlineQueueStore.getItems().length > 0) {
      offlineQueueCoordinator.requestSyncSoon(0);
    }
  }, [status]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await authSession.signUp(email, password, name);
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await authSession.signIn(email, password);
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    realtimeManager.disconnectAll();
    offlineQueueCoordinator.reset();
    await authSession.signOut();
  }, []);

  const value = {
    user,
    session,
    status,
    isLoading: status === 'booting',
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
