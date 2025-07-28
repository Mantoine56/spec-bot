import React, { useState, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Message input component with auto-resize textarea and send functionality
 * Supports keyboard shortcuts and proper UX patterns
 */
const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "Describe your feature idea...",
  autoFocus = false
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send message on Enter (but not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  return (
    <div className="bg-white">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        {/* Message textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none border-2 border-gray-200 rounded-xl px-4 py-3 pr-14 focus:outline-none focus:ring-0 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 transition-colors duration-200 text-gray-900 placeholder-gray-500"
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />
          
          {/* Character count (when approaching limit) */}
          {message.length > 800 && (
            <div className="absolute bottom-3 right-14 text-xs text-gray-400 bg-white px-1">
              {message.length}/1000
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl p-3 transition-all duration-200 flex-shrink-0 shadow-sm hover:shadow-md disabled:shadow-none group"
          title={disabled ? 'Please wait...' : 'Send message (Enter)'}
        >
          {disabled ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 transform transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </form>

      {/* Help text */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-4 text-xs text-gray-400">
          <span className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">Enter</kbd>
            <span>to send</span>
          </span>
          <span className="flex items-center space-x-1">
            <div className="flex items-center space-x-0.5">
              <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">Shift</kbd>
              <span className="text-gray-300">+</span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">Enter</kbd>
            </div>
            <span>for new line</span>
          </span>
        </div>
        {disabled && (
          <div className="flex items-center space-x-1 text-xs text-blue-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageInput; 