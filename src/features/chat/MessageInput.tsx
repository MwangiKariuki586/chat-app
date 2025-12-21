import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import './MessageInput.css';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function MessageInput({ onSendMessage, disabled, autoFocus = true }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when autoFocus is true or component mounts
  useEffect(() => {
    if (autoFocus && !disabled && textareaRef.current) {
      // Small delay to ensure the UI is ready
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const content = message.trim();
    if (!content || isSending || disabled) return;

    setIsSending(true);
    setMessage(''); // Clear immediately for better UX
    
    try {
      await onSendMessage(content);
    } catch (error) {
      // Restore message on error
      setMessage(content);
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
      // Re-focus after sending
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input-container">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Connecting...' : 'Type a message...'}
          disabled={disabled || isSending}
          rows={1}
          className="message-textarea"
        />
        <button 
          type="submit" 
          disabled={!message.trim() || isSending || disabled}
          className="send-button"
          title="Send message"
        >
          {isSending ? (
            <span className="sending-spinner"></span>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="send-icon">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </button>
      </div>
      <span className="input-hint">Press Enter to send, Shift+Enter for new line</span>
    </form>
  );
}

