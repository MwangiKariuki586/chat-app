import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { messageSchema, validate } from '@/lib/validation';
import { sanitizeMessage } from '@/lib/sanitize';
import { useMessageRateLimit } from '@/hooks';
import './MessageInput.css';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  autoFocus?: boolean;
  userId?: string;
}

const MAX_MESSAGE_LENGTH = 4000;

export function MessageInput({ onSendMessage, disabled, autoFocus = true, userId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Rate limiting
  const { allowed: rateLimitAllowed, cooldownSeconds, checkAndRecord, remaining } = useMessageRateLimit(userId || 'anonymous');

  // Clear error when message changes
  useEffect(() => {
    if (error && message.length > 0) {
      setError(null);
    }
  }, [message, error]);

  // Focus the textarea when autoFocus is true or component mounts
  useEffect(() => {
    if (autoFocus && !disabled && textareaRef.current) {
      // Check if already focused to avoid fighting
      if (document.activeElement === textareaRef.current) return;

      // Small delay to ensure the UI is ready and prevent layout shift issues
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  // Keep focus on window refocus
  useEffect(() => {
      const handleFocus = () => {
          if (!disabled && autoFocus) {
              textareaRef.current?.focus();
          }
      };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
  }, [disabled, autoFocus]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Check rate limit first
    if (!checkAndRecord()) {
      setError(`Too many messages. Please wait ${cooldownSeconds}s before sending again.`);
      return;
    }
    
    // Sanitize and validate the message
    const sanitizedContent = sanitizeMessage(message);
    const validation = validate(messageSchema, { content: sanitizedContent });
    
    if (!validation.success) {
      setError(validation.error);
      return;
    }

    const content = validation.data.content;
    if (!content || isSending || disabled) return;

    setIsSending(true);
    setMessage(''); // Clear immediately for better UX
    
    try {
      await onSendMessage(content);
    } catch (err) {
      // Restore message on error
      setMessage(content);
      setError('Failed to send message. Please try again.');
      console.error('Failed to send message:', err);
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // Enforce max length on input
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value);
    }
  };

  const charCount = message.length;
  const isNearLimit = charCount > MAX_MESSAGE_LENGTH * 0.9;
  const isAtLimit = charCount >= MAX_MESSAGE_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="message-input-container">
      {error && (
        <div className="message-input-error" role="alert">
          {error}
        </div>
      )}
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={!rateLimitAllowed ? `Rate limited (${cooldownSeconds}s)...` : disabled ? 'Connecting...' : 'Type a message...'}
          disabled={disabled || !rateLimitAllowed} /* Don't disable on isSending to allow rapid typing */
          rows={1}
          className={`message-textarea ${error ? 'has-error' : ''}`}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message input"
          aria-invalid={!!error}
        />
        <button 
          type="submit" 
          disabled={!message.trim() || isSending || disabled || isAtLimit || !rateLimitAllowed}
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
      <div className="input-footer">
        <span className="input-hint">Press Enter to send, Shift+Enter for new line</span>
        {isNearLimit && (
          <span className={`char-count ${isAtLimit ? 'at-limit' : ''}`}>
            {charCount}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
        {remaining <= 3 && remaining > 0 && (
          <span className="rate-limit-warning">
            {remaining} messages left
          </span>
        )}
        {!rateLimitAllowed && (
          <span className="rate-limit-cooldown">
            Wait {cooldownSeconds}s
          </span>
        )}
      </div>
    </form>
  );
}
