import { useEffect, useRef, memo } from 'react';
import { useMessageStore } from '@/stores';
import { useRealtimeMessages, useConnectionState, getConnectionStatusDisplay } from '@/hooks';
import { useAuth } from '@/features/auth';
import { MessageInput } from './MessageInput';
import type { Message } from '@/types';
import './ChatWindow.css';

interface ChatWindowProps {
  conversationId: string;
}

// Memoized message bubble to prevent unnecessary re-renders
const MessageBubble = memo(function MessageBubble({ 
  message, 
  isOwn 
}: { 
  message: Message; 
  isOwn: boolean;
}) {
  const isOptimistic = message.id.startsWith('temp-');
  
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
        <div className="message-bubble">
          <p>{message.content}</p>
        </div>
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

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get messages from store
  const { 
    messagesByConversation, 
    isLoading, 
    fetchMessages,
    sendMessage 
  } = useMessageStore();
  
  const messages = messagesByConversation[conversationId] || [];

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
      fetchMessages(conversationId);
    }
  }, [conversationId, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const { error } = await sendMessage(conversationId, content);
    if (error) {
      console.error('Failed to send message:', error);
    }
  };

  const statusDisplay = getConnectionStatusDisplay(status);

  return (
    <div className="chat-window">
      {/* Connection status indicator */}
      <div className="connection-status" style={{ '--status-color': statusDisplay.color } as React.CSSProperties}>
        <span className="status-icon">{statusDisplay.icon}</span>
        <span className="status-text">{statusDisplay.text}</span>
      </div>

      {/* Messages area */}
      <div className="messages-container">
        {isLoading ? (
          <div className="loading-messages">
            <div className="loading-spinner-small"></div>
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <span className="no-messages-icon">💬</span>
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === user?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <MessageInput 
        key={conversationId} // Force re-mount to trigger autoFocus on conversation change
        onSendMessage={handleSendMessage} 
        disabled={!isConnected}
        autoFocus
      />
    </div>
  );
}
