import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { ConversationList } from './ConversationList';
import { ChatWindow } from './ChatWindow';
import { Loader2 } from 'lucide-react';
import './ChatDashboard.css';

export function ChatDashboard() {
  const { user, signOut } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  return (
    <div className="chat-dashboard">
      {/* Full-page loading overlay */}
      {isCreatingChat && (
        <div className="fullpage-loading-overlay">
          <div className="fullpage-loading-content">
            <Loader2 className="fullpage-spinner" size={48} />
            <span>Starting conversation...</span>
          </div>
        </div>
      )}

      <header className="chat-header">
        <h1>💬 Chat</h1>
        <div className="user-info">
          <span className="user-name">{user?.user_metadata?.name || user?.email}</span>
          <button onClick={signOut} className="sign-out-btn">
            Sign Out
          </button>
        </div>
      </header>
      
      <main className="chat-main">
        <ConversationList 
          onSelectConversation={setActiveConversationId}
          activeConversationId={activeConversationId}
          onCreatingChat={setIsCreatingChat}
        />
        
        {activeConversationId ? (
          <ChatWindow conversationId={activeConversationId} />
        ) : (
          <div className="no-conversation-selected">
            <div className="welcome-content">
              <span className="welcome-icon">👋</span>
              <h2>Welcome to Chat!</h2>
              <p>Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

