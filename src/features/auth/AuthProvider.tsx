import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Auth context type
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Get initial session with timeout
    const getInitialSession = async () => {
      try {
        // Set a timeout to prevent infinite loading
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Session timeout')), 5000);
        });

        const sessionPromise = supabase.auth.getSession();

        const result = await Promise.race([sessionPromise, timeoutPromise]);

        if (isMounted && result && 'data' in result) {
          setSession(result.data.session);
          setUser(result.data.session?.user ?? null);
        }
      } catch (error) {
        console.warn('Session recovery failed or timed out:', error);
        // Clear any stale session data
        if (isMounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);

        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Create user profile on signup
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            // Check if user profile exists, if not create one
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('id', session.user.id)
              .single();

            if (!existingUser && isMounted) {
              await supabase.from('users').insert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                avatar_url: null,
              });
            }
          } catch (err) {
            console.error('Error creating user profile:', err);
          }
        }

        // Clear any cached data on sign out
        if (event === 'SIGNED_OUT') {
          // Clear localStorage auth data if any stale entries
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('supabase') && key.includes('auth')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => {
            try {
              localStorage.removeItem(key);
            } catch {
              // Ignore errors
            }
          });
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }, // Store name in user metadata
      },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  /* 
    Sign out with a safety timeout.
    If the server doesn't respond within 1s, we force clear the local session anyway 
    to ensure the user isn't stuck in a "logging out" limbo.
  */
  const signOut = useCallback(async () => {
    try {
      // Create a timeout promise that resolves after 1 second
      const timeoutPromise = new Promise<{ error: null }>((resolve) => {
        setTimeout(() => resolve({ error: null }), 1000);
      });

      // Race the actual sign out against the timeout
      await Promise.race([
        supabase.auth.signOut(),
        timeoutPromise
      ]);
      
      console.log('Sign out process completed');
    } catch (err) {
      console.error('Sign out exception:', err);
    } finally {
      // ALWAYS clear local state immediately, regardless of server response
      setUser(null);
      setSession(null);

      // Aggressively clear any auth-related localStorage to prevent zombie sessions
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore errors
        }
      });
    }
  }, []);

  const value = {
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

