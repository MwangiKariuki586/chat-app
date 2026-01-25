import { useEffect, useRef, memo, useState } from 'react';
import { useMessageStore, useConversationStore, usePresenceStore } from '@/stores';
import { useRealtimeMessages, useConnectionState, getConnectionStatusDisplay } from '@/hooks';
import { useAuth } from '@/features/auth';
import { MessagesSkeleton } from '@/components/LoadingSkeleton';
import { MessageInput } from './MessageInput';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import type { Message } from '@/types';
import './ChatWindow.css';

interface ChatWindowProps {
  conversationId: string;
  onBack?: () => void;
  onConversationIdChanged?: (newId: string) => void;
}

// Memoized message bubble to prevent unnecessary re-renders
const MessageBubble = memo(function MessageBubble({ 
  message, 
  isOwn 
}: { 
  message: Message; 
  isOwn: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isOptimistic = message.id.startsWith('temp-');
  const isRead = message.receipts?.some(r => r.read_at && r.user_id !== message.sender_id);
  const isFailed = (message as any).failed;
  
  // Truncate logic
  const MAX_CHARS = 300;
  const isLongMessage = message.content.length > MAX_CHARS || (message.content.match(/\n/g) || []).length > 4;
  const shouldTruncate = isLongMessage && !isExpanded;

  const getStatusColor = () => {
    if (isFailed) return 'red';
    if (isOptimistic) return 'yellow';
    if (isRead) return 'blue';
    return 'green';
  };

  return (
    <div className={`message ${isOwn ? 'own' : 'other'} ${isOptimistic ? 'sending' : ''}`}>
      {!isOwn && (
        <div className="message-avatar">
          {message.sender?.avatar_url || '👤'}
        </div>
      )}
      <div className="message-content">
        {!isOwn && (
          <span className="message-sender">{message.sender?.name || 'Unknown'}</span>
        )}
        <div className={`message-bubble ${shouldTruncate ? 'truncated' : ''}`}>
          <p className="message-text">
            {shouldTruncate ? `${message.content.slice(0, MAX_CHARS)}...` : message.content}
          </p>
          {isLongMessage && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="see-more-btn"
            >
              {isExpanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
        {isOwn && (
          <div className={`message-status-dot ${getStatusColor()}`} 
               title={getStatusColor().toUpperCase()} />
        )}
        <span className="message-time">
          {isOptimistic ? 'Sending...' : formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
});

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper to group messages by date
function groupMessagesByDate(messages: Message[]) {
  const groups: Record<string, Message[]> = {};
  
  messages.forEach(message => {
    const date = new Date(message.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateKey = date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    }
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
  });
  
  return groups;
}

export function ChatWindow({ conversationId, onBack, onConversationIdChanged }: ChatWindowProps) {
  const { user } = useAuth();
  // ... rest of component

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get messages from store
  const { 
    messagesByConversation, 
    isLoading, 
    isLoadingMore,
    paginationState,
    fetchMessages,
    fetchMoreMessages,
    sendMessage,
    markAsRead
  } = useMessageStore();
  
  const messages = messagesByConversation[conversationId] || [];
  const pagination = paginationState[conversationId];

  // Mark as read when conversation opens or messages change
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markAsRead(conversationId);
    }
  }, [conversationId, messages.length, markAsRead]);

  // Connection state management
  const { 
    status, 
    handleStatusChange, 
    isConnected 
  } = useConnectionState({
    maxRetries: 3,
    onMaxRetriesReached: () => {
      console.error('Max retries reached, please refresh the page');
    },
  });

  // Subscribe to realtime messages
  useRealtimeMessages({
    conversationId,
    onStatusChange: handleStatusChange,
  });

  // Fetch initial messages
  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId).then(() => {
        markAsRead(conversationId);
      });
    }
  }, [conversationId, fetchMessages, markAsRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const { error, newConversationId } = await sendMessage(conversationId, content);
    if (error) {
      console.error('Failed to send message:', error);
    } else if (newConversationId && newConversationId !== conversationId) {
      // Swapped from optimistic to real conversation
      onConversationIdChanged?.(newConversationId);
    }
  };

  // Get conversation details to display in header
  const { conversations } = useConversationStore();
  const conversation = conversations.find(c => c.id === conversationId);
  
   // Presence logic
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const otherParticipant = conversation?.participants?.find(
      (p: any) => p.user_id !== user?.id
  );
  
  // Check if the other user is online
  const isOnline = otherParticipant ? onlineUsers.has(otherParticipant.user_id) : false;

  const getConversationName = () => {
    if (!conversation) return 'Chat';
    if (conversation.name) return conversation.name;
    if (conversation.is_group) return 'Group Chat';
    
    return otherParticipant?.user?.name || 'Unknown User';
  };

  const getAvatar = () => {
    if (!conversation) return '👤';
    if (conversation.is_group) return '👥';
    return otherParticipant?.user?.avatar_url || '👤';
  };

  const getStatusText = () => {
    if (status !== 'connected') return 'Connecting...';
    if (conversation?.is_group) return `${conversation.participants?.length || 0} members`;
    return isOnline ? 'Online' : '';
  };

  const statusDisplay = getConnectionStatusDisplay(status);

  return (
    <div className="chat-window">
      {/* Mobile-friendly Header */}
      <div className="chat-window-header">
        <div className="header-left">
          {onBack && (
            <button onClick={onBack} className="back-button" title="Back to list">
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="header-avatar">
            {getAvatar()}
          </div>
          <div className="header-info">
            <h3 className="header-title">{getConversationName()}</h3>
            {getStatusText() && (
              <span className="header-status" style={{ color: isOnline ? '#4ade80' : undefined }}>
                {getStatusText()}
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          <button className="menu-button">
            <MoreVertical size={24} />
          </button>
        </div>
      </div>

      {/* Connection status indicator (minimized or integrated) - Only show on error or disconnected if not handled by header */}
      {status !== 'connected' && (
        <div className="connection-status" style={{ '--status-color': statusDisplay.color } as React.CSSProperties}>
          <span className="status-icon">{statusDisplay.icon}</span>
          <span className="status-text">{statusDisplay.text}</span>
        </div>
      )}

      {/* Messages area */}
      <div className="messages-container">
        {isLoading ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <span className="no-messages-icon">💬</span>
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="messages-list">
            {/* Load more button at top */}
            {pagination?.hasMore && (
              <div className="load-more-container">
                <button 
                  className="load-more-btn"
                  onClick={() => fetchMoreMessages(conversationId)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <span className="loading-spinner-small"></span>
                      Loading...
                    </>
                  ) : (
                    'Load older messages'
                  )}
                </button>
              </div>
            )}
            
            {/* Group messages by date */}
            {Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
              <div key={date} className="date-group">
                <div className="date-separator">
                  <span>{date}</span>
                </div>
                {msgs.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.sender_id === user?.id}
                  />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <MessageInput 
        key={conversationId} // Force re-mount to trigger autoFocus on conversation change
        onSendMessage={handleSendMessage} 
        autoFocus
        userId={user?.id}
      />
    </div>
  );
}
