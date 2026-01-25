import { useOfflineSupport } from '@/hooks/useOfflineSupport';
import './OfflineIndicator.css';

export function OfflineIndicator() {
  const { isOnline, pendingMessageCount } = useOfflineSupport();

  // Don't show anything if online and no pending messages
  if (isOnline && pendingMessageCount === 0) {
    return null;
  }

  return (
    <div className={`offline-indicator ${isOnline ? 'syncing' : 'offline'}`}>
      <span className="offline-icon">
        {isOnline ? '🔄' : '📴'}
      </span>
      <span className="offline-text">
        {isOnline 
          ? `Syncing ${pendingMessageCount} message${pendingMessageCount > 1 ? 's' : ''}...`
          : 'You are offline. Messages will be sent when you reconnect.'
        }
      </span>
    </div>
  );
}
