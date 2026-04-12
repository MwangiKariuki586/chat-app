import { useEffect, useState } from 'react';
import { useConversationStore } from '@/stores';
import { useAuth } from '@/features/auth';
import { useRealtimeConversations } from '@/hooks';
import { useToast } from '@/components/Toast';
import { ConversationListSkeleton } from '@/components/LoadingSkeleton';
import { chatRepository } from '@/services/chatRepository';
import { beginDirectConversationByUserId, leaveConversation, loadConversations } from '@/services/chatController';
import { Trash2 } from 'lucide-react';
import type { User } from '@/types';
import './ConversationList.css';

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  activeConversationId: string | null;
}

export function ConversationList({ 
  onSelectConversation, 
  activeConversationId,
}: ConversationListProps) {
  const { user } = useAuth();
  const { 
    conversations, 
    listState,
    unreadCounts,
    resetUnreadCount 
  } = useConversationStore();
  const [users, setUsers] = useState<User[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subscribe to realtime conversation updates
  useRealtimeConversations({
    userId: user?.id || null,
    activeConversationId,
  });

  useEffect(() => {
    if (user?.id) {
      void loadConversations();
    }
  }, [user?.id]);

  // Reset unread count when conversation is selected
  useEffect(() => {
    if (activeConversationId) {
      resetUnreadCount(activeConversationId);
    }
  }, [activeConversationId, resetUnreadCount]);

  // Fetch users for new chat dialog
  const fetchUsers = async () => {
    const result = await chatRepository.fetchUsers(20);
    if (result.data) {
      setUsers(result.data.filter((candidate) => candidate.id !== user?.id));
    }
  };

  const handleNewChat = () => {
    setShowNewChat(true);
    void fetchUsers();
  };

  const handleSelectUser = async (otherUser: User) => {
    setShowNewChat(false); // Close modal immediately for better UX

    const { data } = await beginDirectConversationByUserId(otherUser.id);
    if (data) {
      onSelectConversation(data.id);
    }
    
    setSearchQuery('');
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation(); // Prevent selecting the conversation
    setDeleteConfirm(conversationId);
  };

  const { showSuccess, showError } = useToast();

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    
    setIsDeleting(true);
    const { error } = await leaveConversation(deleteConfirm);
    
    if (error) {
      console.error('Failed to leave conversation:', error);
      showError('Failed to leave conversation');
    } else {
      showSuccess('Left conversation');
    }
    
    setIsDeleting(false);
    setDeleteConfirm(null);
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };


  const getConversationName = (conv: typeof conversations[0]) => {
    if (conv.name) return conv.name;
    if (!conv.participants) return 'Unknown';
    
    // For 1:1 chats, show the other person's name
    const otherParticipant = conv.participants.find(
      (p) => p.user_id !== user?.id
    );
    return otherParticipant?.user?.name || 'Unknown User';
  };

  const getAvatar = (conv: typeof conversations[0]) => {
    if (conv.is_group) return '👥';
    const otherParticipant = conv.participants?.find(
      (p) => p.user_id !== user?.id
    );
    return otherParticipant?.user?.avatar_url || '👤';
  };

  const getLastMessagePreview = (conv: typeof conversations[0]) => {
    if (!conv.last_message) return 'No messages yet';
    
    const sender = conv.last_message.sender;
    const isMine = conv.last_message.sender_id === user?.id;
    const prefix = isMine ? 'You: ' : (sender?.name ? `${sender.name.split(' ')[0]}: ` : '');
    const content = conv.last_message.content;
    
    // Truncate long messages
    const maxLength = 30;
    const truncated = content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content;
    
    return prefix + truncated;
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = listState.status === 'loading';

  return (
    <aside className="conversation-list">
      <div className="conversation-header">
        <h2>Messages</h2>
        <button onClick={handleNewChat} className="new-chat-btn" title="New Chat">
          ✏️
        </button>
      </div>

      {showNewChat && (
        <div className="new-chat-modal">
          <div className="new-chat-header">
            <h3>Start New Chat</h3>
            <button onClick={() => setShowNewChat(false)} className="close-btn">
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="user-search"
            autoFocus
          />
          <div className="user-list">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className="user-item"
              >
                <span className="user-avatar">
                  {u.avatar_url || '👤'}
                </span>
                <div className="user-info">
                  <span className="user-name">{u.name}</span>
                  <span className="user-email">{u.email}</span>
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <p className="no-users">No users found</p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <ConversationListSkeleton />
      ) : conversations.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">💬</span>
          <p>No conversations yet</p>
          <button onClick={handleNewChat} className="start-chat-btn">
            Start a Chat
          </button>
        </div>
      ) : (
        <ul className="conversations">
          {conversations
            .filter(conv => !conv.id.startsWith('temp-chat-')) // Hide empty draft conversations
            .map((conv) => {
            const unreadCount = unreadCounts[conv.id] || 0;
            const hasUnread = unreadCount > 0;
            
            return (
              <li key={conv.id} className="conversation-wrapper">
                <button
                  onClick={() => onSelectConversation(conv.id)}
                  className={`conversation-item ${
                    activeConversationId === conv.id ? 'active' : ''
                  } ${hasUnread ? 'has-unread' : ''}`}
                >
                  <span className="conversation-avatar">{getAvatar(conv)}</span>
                  <div className="conversation-details">
                    <div className="conversation-top-row">
                      <span className="conversation-name">
                        {getConversationName(conv)}
                      </span>
                      <span className="conversation-time">
                        {formatTime(conv.last_message?.created_at || conv.updated_at)}
                      </span>
                    </div>
                    <div className="conversation-bottom-row">
                      <span className={`conversation-preview ${hasUnread ? 'unread' : ''}`}>
                        {getLastMessagePreview(conv)}
                      </span>
                      {hasUnread && (
                        <span className="unread-badge">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => handleDeleteClick(e, conv.id)}
                  className="delete-conversation-btn"
                  title="Delete conversation"
                >
                  <Trash2 size={18} strokeWidth={2.5} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="delete-modal-overlay" onClick={handleCancelDelete}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon">👋</div>
            <h3>Leave Conversation?</h3>
            <p>This will remove the conversation from your chat list. Other participants will still have access to it.</p>
            <div className="delete-modal-actions">
              <button 
                onClick={handleCancelDelete} 
                className="cancel-delete-btn"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete} 
                className="confirm-delete-btn"
                disabled={isDeleting}
              >
                {isDeleting ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}


