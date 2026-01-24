import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import { usePresenceStore } from '@/stores/presenceStore';

export function usePresence() {
    const { user } = useAuth();
    const setOnlineUsers = usePresenceStore((state) => state.setOnlineUsers);

    useEffect(() => {
        if (!user) return;

        // Create a channel for tracking presence
        const channel = supabase.channel('global_presence', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const userIds = new Set<string>();

                Object.values(newState).forEach((presences: any) => {
                    presences.forEach((presence: any) => {
                        if (presence.user_id) {
                            userIds.add(presence.user_id);
                        }
                    });
                });

                setOnlineUsers(Array.from(userIds));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    }, [user, setOnlineUsers]);
}
