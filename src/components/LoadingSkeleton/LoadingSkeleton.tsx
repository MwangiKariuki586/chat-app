import './LoadingSkeleton.css';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ 
  variant = 'text', 
  width, 
  height, 
  className = '' 
}: SkeletonProps) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div 
      className={`skeleton skeleton-${variant} ${className}`}
      style={style}
      aria-label="Loading..."
    />
  );
}

export function ConversationListSkeleton() {
  return (
    <div className="conversation-list-skeleton">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="conversation-item-skeleton">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="conversation-details-skeleton">
            <Skeleton width="60%" height={16} />
            <Skeleton width="80%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="messages-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`message-skeleton ${i % 2 === 0 ? 'own' : 'other'}`}>
          {i % 2 !== 0 && <Skeleton variant="circular" width={32} height={32} />}
          <div className="message-content-skeleton">
            <Skeleton width={i % 3 === 0 ? '80%' : '60%'} height={40} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserListSkeleton() {
  return (
    <div className="user-list-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="user-item-skeleton">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="user-info-skeleton">
            <Skeleton width="70%" height={14} />
            <Skeleton width="90%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
