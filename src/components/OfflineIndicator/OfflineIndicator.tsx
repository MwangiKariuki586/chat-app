import { useOfflineSupport } from '@/hooks/useOfflineSupport';
import './OfflineIndicator.css';

export function OfflineIndicator() {
  const { isOnline, pendingMessageCount, isSyncing } = useOfflineSupport();

  const shouldShowOffline = !isOnline;
  const shouldShowSyncing = isOnline && isSyncing && pendingMessageCount > 0;

  if (!shouldShowOffline && !shouldShowSyncing) {
    return null;
  }

  return (
    <div className={`offline-indicator ${shouldShowSyncing ? 'syncing' : 'offline'}`}>
      <span className="offline-icon">
        {shouldShowSyncing ? 'Sync' : 'Offline'}
      </span>
      <span className="offline-text">
        {shouldShowSyncing
          ? `Syncing ${pendingMessageCount} message${pendingMessageCount > 1 ? 's' : ''}...`
          : 'You are offline. Messages will be sent when you reconnect.'
        }
      </span>
    </div>
  );
}
