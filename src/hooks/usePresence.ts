import { useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { usePresenceStore } from '@/stores/presenceStore';
import { realtimeManager } from '@/services/realtimeManager';

export function usePresence() {
    const { user } = useAuth();
    const setOnlineUsers = usePresenceStore((state) => state.setOnlineUsers);

    useEffect(() => {
        if (!user) {
            setOnlineUsers([]);
            return;
        }

        return realtimeManager.subscribeToPresence({
            userId: user.id,
            onPresenceSync: (userIds) => {
                setOnlineUsers(userIds);
            },
        });
    }, [setOnlineUsers, user]);
}
