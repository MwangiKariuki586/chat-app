import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { usePresence } from '@/hooks';
import { ConversationList } from './ConversationList';
import { ChatWindow } from './ChatWindow';
import './ChatDashboard.css';

export function ChatDashboard() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  
  // Track online presence
  usePresence();

  const handleBack = () => {
    setActiveConversationId(null);
  };

  return (
    <div className="chat-dashboard">
      {/* Header - Only visible on desktop or when list is active on mobile */}
      <header className={`chat-header ${activeConversationId ? 'hidden-on-mobile' : ''}`}>
        <h1>💬 Chat</h1>
        <div className="user-info">
          <span className="user-name">{user?.user_metadata?.name || user?.email}</span>
          <button onClick={signOut} className="sign-out-btn">
            Sign Out
          </button>
        </div>
      </header>
      
      <main className="chat-main">
        <div className={`conversation-list-container ${activeConversationId ? 'hidden-on-mobile' : ''}`}>
          <ConversationList 
            onSelectConversation={setActiveConversationId}
            activeConversationId={activeConversationId}
          />
        </div>
        
        <div className={`chat-window-container ${!activeConversationId ? 'hidden-on-mobile' : ''}`}>
          {activeConversationId ? (
            <ChatWindow 
              conversationId={activeConversationId} 
              onBack={handleBack}
              onConversationIdChanged={setActiveConversationId}
            />
          ) : (
            <div className="no-conversation-selected">
              <div className="welcome-content">
                <span className="welcome-icon">👋</span>
                <h2>Welcome to Chat!</h2>
                <p>Select a conversation or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
