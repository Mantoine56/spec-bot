import React, { useState, useEffect, useRef } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import { workflowApi, ApiError } from '../services/api';
import type { MessageProps } from './Message';
import type { SpecState } from '../services/api';

/**
 * Main chat interface component
 * Manages conversation flow, workflow state, and user interactions
 */
const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [workflowState, setWorkflowState] = useState<SpecState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check for existing workflow on component mount
  useEffect(() => {
    checkExistingWorkflow();
  }, []);

  /**
   * Check if there's an existing workflow in progress
   */
  const checkExistingWorkflow = async () => {
    try {
      const state = await workflowApi.getStatus();
      if (state && state.status !== 'idle') {
        setWorkflowState(state);
        loadWorkflowMessages(state);
      } else {
        // No existing workflow, show welcome message
        addMessage({
          id: 'welcome',
          type: 'assistant',
          content: 'Hi! I\'m Spec Bot, your AI-powered specification generator. I can help you create comprehensive requirements, design documents, and task lists for your features.\n\nTo get started, describe the feature you\'d like me to analyze.',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // No workflow exists, this is normal
        addMessage({
          id: 'welcome-fallback',
          type: 'assistant',
          content: 'Hi! I\'m Spec Bot, your AI-powered specification generator. I can help you create comprehensive requirements, design documents, and task lists for your features.\n\nTo get started, describe the feature you\'d like me to analyze.',
          timestamp: new Date(),
        });
      } else {
        setError('Failed to connect to backend. Please ensure the server is running.');
      }
    }
  };

  /**
   * Load messages based on current workflow state
   */
  const loadWorkflowMessages = (state: SpecState) => {
    const msgs: MessageProps[] = [];

    // Add initial user input
    if (state.user_input) {
      msgs.push({
        id: 'initial-input',
        type: 'user',
        content: state.user_input,
        timestamp: new Date(state.created_at),
      });
    }

    // Add system status message
    const statusMessage = getStatusMessage(state.status);
    if (statusMessage) {
      msgs.push({
        id: 'status',
        type: 'system',
        content: statusMessage,
        timestamp: new Date(),
      });
    }

    // Add generated content if available
    if (state.requirements?.content) {
      msgs.push({
        id: 'requirements',
        type: 'assistant',
        content: `**Requirements Generated:**\n\n${state.requirements.content}`,
        timestamp: new Date(state.updated_at),
        metadata: { phase: 'requirements' }
      });
    }

    if (state.design?.content) {
      msgs.push({
        id: 'design',
        type: 'assistant',
        content: `**Design Generated:**\n\n${state.design.content}`,
        timestamp: new Date(state.updated_at),
        metadata: { phase: 'design' }
      });
    }

    if (state.tasks?.content) {
      msgs.push({
        id: 'tasks',
        type: 'assistant',
        content: `**Tasks Generated:**\n\n${state.tasks.content}`,
        timestamp: new Date(state.updated_at),
        metadata: { phase: 'tasks' }
      });
    }

    setMessages(msgs);
  };

  /**
   * Get human-readable status message
   */
  const getStatusMessage = (status: SpecState['status']): string | null => {
    switch (status) {
      case 'generating_requirements':
        return 'Generating requirements document...';
      case 'awaiting_requirements_approval':
        return 'Requirements ready for review. Please approve or provide feedback.';
      case 'generating_design':
        return 'Generating design document...';
      case 'awaiting_design_approval':
        return 'Design ready for review. Please approve or provide feedback.';
      case 'generating_tasks':
        return 'Generating task list...';
      case 'awaiting_tasks_approval':
        return 'Tasks ready for review. Please approve or provide feedback.';
      case 'generating_final_documents':
        return 'Finalizing documents...';
      case 'completed':
        return 'Specification generation completed! All documents have been saved.';
      case 'error':
        return 'An error occurred during generation. Please try again.';
      default:
        return null;
    }
  };

  /**
   * Add a new message to the conversation
   */
  const addMessage = (message: Omit<MessageProps, 'id'> & { id?: string }) => {
    const newMessage: MessageProps = {
      id: message.id || Date.now().toString(),
      ...message,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  /**
   * Handle sending a new message
   */
  const handleSendMessage = async (content: string) => {
    // Clear any existing errors
    setError(null);
    
    // Add user message
    addMessage({
      type: 'user',
      content,
      timestamp: new Date(),
    });

    setIsLoading(true);

    try {
      if (!workflowState || workflowState.status === 'idle' || workflowState.status === 'completed') {
        // Start new workflow
        await startNewWorkflow(content);
      } else {
        // Handle approval or feedback
        await handleWorkflowFeedback(content);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      const errorMessage = error instanceof ApiError 
        ? `Error: ${error.message}`
        : 'An unexpected error occurred. Please try again.';
      
      addMessage({
        type: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
      });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start a new specification workflow
   */
  const startNewWorkflow = async (userInput: string) => {
    addMessage({
      type: 'system',
      content: 'Starting new specification workflow...',
      timestamp: new Date(),
    });

    const state = await workflowApi.startWorkflow({
      feature_name: extractFeatureName(userInput),
      user_input: userInput,
      llm_provider: 'openai', // Default to OpenAI
    });

    setWorkflowState(state);
    
    // Start polling for updates
    pollWorkflowStatus();
  };

  /**
   * Handle workflow feedback (approval/rejection)
   */
  const handleWorkflowFeedback = async (feedback: string) => {
    if (!workflowState) return;

    // Determine current phase and whether this is approval or feedback
    const currentPhase = getCurrentPhase(workflowState.status);
    const isApproval = feedback.toLowerCase().includes('approve') || 
                      feedback.toLowerCase().includes('looks good') ||
                      feedback.toLowerCase().includes('yes');

    if (currentPhase) {
      const state = await workflowApi.submitApproval({
        phase: currentPhase,
        approved: isApproval,
        feedback: isApproval ? undefined : feedback,
      });

      setWorkflowState(state);
      pollWorkflowStatus();
    }
  };

  /**
   * Get current workflow phase based on status
   */
  const getCurrentPhase = (status: SpecState['status']): 'requirements' | 'design' | 'tasks' | null => {
    if (status.includes('requirements')) return 'requirements';
    if (status.includes('design')) return 'design';
    if (status.includes('tasks')) return 'tasks';
    return null;
  };

  /**
   * Extract feature name from user input (simple heuristic)
   */
  const extractFeatureName = (input: string): string => {
    // Simple extraction - take first few words or look for key phrases
    const words = input.trim().split(' ');
    if (words.length <= 3) {
      return words.join('_').toLowerCase();
    }
    
    // Look for patterns like "build a", "create a", "implement"
    const patterns = [
      /(?:build|create|implement|develop|design)\s+(?:a\s+|an\s+)?(.+?)(?:\s+(?:that|which|for)|\.|$)/i,
      /(.+?)(?:\s+system|\s+feature|\s+app|\s+application)/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\s+/g, '_').toLowerCase();
      }
    }
    
    // Fallback: use first 3 words
    return words.slice(0, 3).join('_').toLowerCase();
  };

  /**
   * Poll workflow status for real-time updates
   */
  const pollWorkflowStatus = () => {
    const poll = async () => {
      try {
        const state = await workflowApi.getStatus();
        setWorkflowState(state);
        
        // Update status message
        const statusMessage = getStatusMessage(state.status);
        if (statusMessage) {
          const lastMessage = messages[messages.length - 1];
          if (!lastMessage || lastMessage.type !== 'system' || lastMessage.content !== statusMessage) {
            addMessage({
              type: 'system',
              content: statusMessage,
              timestamp: new Date(),
            });
          }
        }
        
        // Continue polling if workflow is still active
        if (!['completed', 'error', 'idle'].includes(state.status)) {
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    poll();
  };

  /**
   * Reset the workflow
   */
  const handleReset = async () => {
    try {
      await workflowApi.resetWorkflow();
      setMessages([]);
      setWorkflowState(null);
      setError(null);
      
      addMessage({
        id: 'reset',
        type: 'system',
        content: 'Workflow reset. You can start a new specification.',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Reset error:', error);
      setError('Failed to reset workflow');
    }
  };

  const needsApproval = workflowState?.status.includes('awaiting') || false;
  const isGenerating = workflowState?.status.includes('generating') || false;

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <Message key={message.id} {...message} />
        ))}
        
        {/* Loading indicator */}
        {(isLoading || isGenerating) && (
          <Message
            id="loading"
            type="assistant"
            content="Thinking..."
            timestamp={new Date()}
            metadata={{
              isGenerating: true,
              phase: getCurrentPhase(workflowState?.status || 'idle') || undefined
            }}
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Action bar for workflow controls */}
      {workflowState && workflowState.status !== 'idle' && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Feature: <span className="font-medium">{workflowState.feature_name}</span>
              <span className="ml-4">Status: <span className="font-medium capitalize">{workflowState.status.replace(/_/g, ' ')}</span></span>
            </div>
            <button
              onClick={handleReset}
              className="btn-outline text-sm"
            >
              Reset Workflow
            </button>
          </div>
        </div>
      )}

      {/* Message input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={isLoading || isGenerating}
        placeholder={
          needsApproval 
            ? "Type 'approve' to continue, or provide feedback for revisions..."
            : "Describe your feature idea..."
        }
        autoFocus={!workflowState}
      />
    </div>
  );
};

export default ChatInterface; 