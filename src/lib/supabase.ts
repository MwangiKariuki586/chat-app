import { createClient } from '@supabase/supabase-js';

// These will be replaced with your actual Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Persist session in localStorage
        persistSession: true,
        // Auto-refresh tokens before expiry
        autoRefreshToken: true,
        // Detect session from URL (for OAuth)
        detectSessionInUrl: true,
    },
    realtime: {
        params: {
            // Increase timeout for slower connections
            eventsPerSecond: 10,
        },
    },
});
