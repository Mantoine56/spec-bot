import React from 'react';

export interface MessageProps {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'approval';
  content: string;
  timestamp: Date;
  metadata?: {
    phase?: 'requirements' | 'design' | 'tasks';
    isApprovalRequired?: boolean;
    isGenerating?: boolean;
  };
}

/**
 * Message component for displaying chat messages
 * Supports different message types with appropriate styling
 */
const Message: React.FC<MessageProps> = ({ 
  type, 
  content, 
  timestamp, 
  metadata 
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStyles = () => {
    switch (type) {
      case 'user':
        return 'message-user';
      case 'assistant':
        return 'message-assistant';
      case 'system':
        return 'bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-4 py-2 mx-auto max-w-md text-center text-sm';
      case 'approval':
        return 'bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3';
      default:
        return 'message-assistant';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'user':
        return (
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-medium">U</span>
          </div>
        );
      case 'assistant':
        return (
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm">🤖</span>
          </div>
        );
      case 'system':
        return (
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs">ℹ</span>
          </div>
        );
      case 'approval':
        return (
          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs">❓</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (type === 'system') {
    return (
      <div className="flex items-center justify-center my-4">
        <div className={getMessageStyles()}>
          <div className="flex items-center space-x-2">
            {getIcon()}
            <span>{content}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${type === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3 max-w-5xl w-full`}>
        {getIcon()}
        
        <div className={`flex flex-col ${type === 'user' ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
          {/* Message content */}
          <div className={`${getMessageStyles()} w-full`}>
            {metadata?.isGenerating ? (
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span>Generating {metadata.phase}...</span>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words">{content}</div>
            )}
          </div>
          
          {/* Timestamp */}
          <div className="text-xs text-gray-500 mt-1 px-2">
            {formatTime(timestamp)}
            {metadata?.phase && (
              <span className="ml-2 capitalize">• {metadata.phase}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Message; 