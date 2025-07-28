import React, { useState, useEffect, useRef, useCallback } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import TechStackPanel from './TechStackPanel';
import { workflowApi, ApiError } from '../services/api';
import { useWorkflow } from '../contexts/WorkflowContext';
import { formatTechStackForPrompt } from '../services/techStackService';
import type { MessageProps } from './Message';
import type { SpecState } from '../services/api';
import type { TechStackProfile } from '../services/techStackService';

/**
 * Main chat interface component
 * Manages conversation flow, workflow state, and user interactions
 */
const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const { workflowState, setWorkflowState } = useWorkflow();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track what we've already shown to prevent duplicates
  const [shownStatuses, setShownStatuses] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Tech stack management
  const [selectedTechStack, setSelectedTechStack] = useState<TechStackProfile | null>(null);
  const [techStackChanged, setTechStackChanged] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check for existing workflow on component mount
  useEffect(() => {
    if (!hasInitialized) {
      checkExistingWorkflow();
      setHasInitialized(true);
    }
  }, [hasInitialized]);

  /**
   * Add a message with duplicate prevention
   */
  const addMessage = useCallback((message: Omit<MessageProps, 'id'> & { id?: string }) => {
    const id = message.id || `msg-${Date.now()}-${Math.random()}`;
    setMessages(prev => {
      // Check if we already have this message
      const exists = prev.some(m => 
        m.id === id || 
        (m.type === message.type && m.content === message.content)
      );
      if (exists) return prev;
      
      return [...prev, { ...message, id }];
    });
  }, []);

  /**
   * Check if there's an existing workflow in progress
   */
  const checkExistingWorkflow = async () => {
    try {
      const response = await workflowApi.getStatus();
      
      if (response && typeof response === 'object' && 'status' in response) {
        if (response.status !== 'idle' && 'workflow_id' in response) {
          // We have an active workflow
          setWorkflowState(response as SpecState);
          
          // Add initial description if it exists
          const state = response as SpecState;
          if (state.initial_description) {
            addMessage({
              id: 'initial-input',
              type: 'user',
              content: state.initial_description,
              timestamp: new Date(state.created_at || Date.now()),
            });
          }
          
          // Start polling for updates
          pollWorkflowStatus();
        } else {
          // No workflow, show welcome
          showWelcomeMessage();
        }
      } else {
        showWelcomeMessage();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        showWelcomeMessage();
      } else {
        setError('Failed to connect to backend. Please ensure the server is running.');
      }
    }
  };

  /**
   * Show welcome message
   */
  const showWelcomeMessage = () => {
    addMessage({
      id: 'welcome-message',
      type: 'assistant',
      content: 'Hi! I\'m Spec Bot, your AI-powered specification generator. I can help you create comprehensive requirements, design documents, and task lists for your features.\n\nTo get started, describe the feature you\'d like me to analyze.',
      timestamp: new Date(),
    });
  };

  /**
   * Get status message for current state
   */
  const getStatusMessage = (status: string): string | null => {
    const messages: Record<string, string> = {
      'generating_requirements': 'Generating requirements...',
      'awaiting_requirements_approval': 'Requirements ready for review. Please approve or provide feedback.',
      'generating_design': 'Generating design document...',
      'awaiting_design_approval': 'Design ready for review. Please approve or provide feedback.',
      'generating_tasks': 'Generating task list...',
      'awaiting_tasks_approval': 'Tasks ready for review. Please approve or provide feedback.',
      'completed': 'Specification generation completed! All documents have been saved.',
      'error': 'An error occurred during workflow processing.',
    };
    
    return messages[status] || null;
  };

  /**
   * Poll workflow status for real-time updates
   */
  const pollWorkflowStatus = useCallback(() => {
    let isPolling = true;
    
    const poll = async () => {
      if (!isPolling) return;
      
      try {
        const state = await workflowApi.getStatus();
        setWorkflowState(state);
        
        // Determine current status
        let currentStatus = state.status;
        if (state.pending_approval) {
          currentStatus = `awaiting_${state.pending_approval}_approval`;
        }
        
        // Add status message if we haven't shown this status yet
        if (currentStatus && !shownStatuses.has(currentStatus)) {
          const statusMessage = getStatusMessage(currentStatus);
          if (statusMessage) {
            addMessage({
              id: `status-${currentStatus}`,
              type: 'system',
              content: statusMessage,
              timestamp: new Date(),
            });
            setShownStatuses(prev => new Set([...prev, currentStatus]));
          }
        }
        
        // Add document summaries when they're first generated
        ['requirements', 'design', 'tasks'].forEach(phase => {
          const phaseData = state[phase as keyof typeof state] as any;
          if (phaseData?.content && !shownStatuses.has(`${phase}_generated`)) {
            addMessage({
              id: `${phase}-summary`,
              type: 'assistant',
              content: `**${phase.charAt(0).toUpperCase() + phase.slice(1)} Generated:** ✅\n\n${phaseData.content.substring(0, 200)}...`,
              timestamp: new Date(state.updated_at || Date.now()),
              metadata: { phase: phase as 'requirements' | 'design' | 'tasks' }
            });
            setShownStatuses(prev => new Set([...prev, `${phase}_generated`]));
          }
        });
        
        // Continue polling if workflow is still active
        if (state.status && !['completed', 'error', 'idle'].includes(state.status)) {
          setTimeout(() => poll(), 5000);
        } else {
          isPolling = false;
        }
      } catch (error) {
        console.error('Polling error:', error);
        setTimeout(() => poll(), 10000);
      }
    };
    
    poll();
    
    // Return cleanup function
    return () => {
      isPolling = false;
    };
  }, [addMessage, shownStatuses, setWorkflowState]);

  /**
   * Extract feature name from user input
   */
  const extractFeatureName = (input: string): string => {
    // Remove common words and get meaningful terms
    const words = input.toLowerCase().split(/\s+/).filter(word => 
      word.length > 2 && 
      !['the', 'and', 'for', 'with', 'that', 'this', 'create', 'build', 'make', 'add', 'new'].includes(word)
    );
    
    // Look for specific patterns
    const patterns = [
      /(?:for|about|called?)\s+([a-zA-Z_][a-zA-Z0-9_\s]{2,20})/i,
      /([a-zA-Z_][a-zA-Z0-9_\s]{2,20})\s+(?:page|app|feature|system|component)/i,
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1].trim().replace(/\s+/g, '_').toLowerCase();
      }
    }
    
    // Fallback: use first 3 words
    return words.slice(0, 3).join('_').toLowerCase();
  };

  /**
   * Reset the workflow
   */
  const handleReset = async () => {
    try {
      await workflowApi.resetWorkflow(workflowState?.workflow_id);
      setMessages([]);
      setWorkflowState(null);
      setError(null);
      setShownStatuses(new Set());
      
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

  /**
   * Handle approve button click
   */
  const handleApprove = async () => {
    if (!workflowState || !workflowState.workflow_id) return;
    
    try {
      setIsLoading(true);
      await handleWorkflowFeedback('approve');
    } catch (error) {
      console.error('Approve error:', error);
      setError('Failed to approve. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle request changes button click
   */
  const handleRequestChanges = () => {
    // Focus the input for user to provide feedback
    const input = document.querySelector('textarea');
    if (input) {
      input.focus();
      input.placeholder = 'Please describe what changes you\'d like...';
    }
  };

  /**
   * Handle workflow feedback (approve/revise)
   */
  const handleWorkflowFeedback = async (feedback: string) => {
    if (!workflowState || !workflowState.workflow_id) return;

    const isApproval = feedback.toLowerCase().includes('approve') || 
                     feedback.toLowerCase().includes('looks good') || 
                     feedback.toLowerCase().includes('yes') ||
                     feedback === 'approve';

    const action = isApproval ? 'approve' : 'revise';

    try {
      const state = await workflowApi.submitApproval({
        workflow_id: workflowState.workflow_id,
        action: action,
        feedback: isApproval ? undefined : feedback,
      });

      setWorkflowState(state);
      
      // Add user feedback message
      addMessage({
        type: 'user',
        content: isApproval ? 'Approved - continue to next phase' : feedback,
        timestamp: new Date(),
      });

      // Reset shown statuses for the approval so we can show new status
      if (isApproval && workflowState.pending_approval) {
        setShownStatuses(prev => {
          const newSet = new Set(prev);
          newSet.delete(`awaiting_${workflowState.pending_approval}_approval`);
          return newSet;
        });
      }

      // Resume polling
      pollWorkflowStatus();
    } catch (error) {
      console.error('Workflow feedback error:', error);
      setError('Failed to submit feedback. Please try again.');
    }
  };

  /**
   * Handle tech stack profile changes
   */
  const handleTechStackChange = (profile: TechStackProfile | null) => {
    const previousStack = selectedTechStack;
    setSelectedTechStack(profile);
    
    // If we're in the middle of a workflow and the tech stack changed, 
    // mark it for potential regeneration
    if (workflowState && workflowState.status !== 'idle' && previousStack?.id !== profile?.id) {
      setTechStackChanged(true);
      
      // Show a message about the tech stack change
      if (profile) {
        addMessage({
          type: 'system',
          content: `Tech stack updated to "${profile.name}". You can regenerate the current phase to incorporate these changes.`,
          timestamp: new Date(),
        });
      } else {
        addMessage({
          type: 'system', 
          content: 'Tech stack cleared. Future generations will not include specific technology constraints.',
          timestamp: new Date(),
        });
      }
    }
  };

  /**
   * Handle regeneration with new tech stack
   */
  const handleRegenerateWithTechStack = async () => {
    if (!selectedTechStack || !workflowState) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Create a regeneration request with tech stack context
      const techStackContext = formatTechStackForPrompt(selectedTechStack);
      const regenerationMessage = `Please regenerate the current phase using the updated technology stack:\n\n${techStackContext}`;
      
      // Send as feedback to trigger regeneration
      await handleWorkflowFeedback(regenerationMessage);
      
      // Clear the tech stack changed flag
      setTechStackChanged(false);
      
      // Add a system message
      addMessage({
        type: 'system',
        content: `Regenerating current phase with "${selectedTechStack.name}" tech stack...`,
        timestamp: new Date(),
      });
      
    } catch (error) {
      console.error('Tech stack regeneration error:', error);
      setError('Failed to regenerate with new tech stack. Please try again.');
    }
  };

  /**
   * Handle user message submission
   */
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    addMessage({
      type: 'user',
      content: message,
      timestamp: new Date(),
    });

    try {
      setIsLoading(true);
      setError(null);

      if (workflowState && workflowState.status !== 'idle') {
        // Existing workflow - treat as feedback
        await handleWorkflowFeedback(message);
      } else {
        // New workflow - include tech stack context if available
        const featureName = extractFeatureName(message);
        let enhancedDescription = message;
        
        // Add tech stack context to the description if a profile is selected
        if (selectedTechStack) {
          const techStackContext = formatTechStackForPrompt(selectedTechStack);
          enhancedDescription = `${message}\n\n**Technology Stack:**\n${techStackContext}`;
          
          // Show user that tech stack was included
          addMessage({
            type: 'system',
            content: `Using tech stack: ${selectedTechStack.name} (${selectedTechStack.detailLevel} detail level)`,
            timestamp: new Date(),
          });
        }
        
        const state = await workflowApi.startWorkflow({
          feature_name: featureName,
          description: enhancedDescription,
        });

        setWorkflowState(state);
        setShownStatuses(new Set()); // Reset for new workflow
        setTechStackChanged(false); // Reset tech stack change flag
        pollWorkflowStatus();
      }
    } catch (error) {
      console.error('Send message error:', error);
      if (error instanceof ApiError) {
        setError(`Failed to process request: ${error.message}`);
      } else {
        setError('Failed to send message. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Determine if workflow needs approval
  const needsApproval = workflowState?.pending_approval !== undefined;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Error banner - fixed at top */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat messages - scrollable middle area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="p-6 space-y-4">
            {messages.map((message) => (
              <Message key={message.id} {...message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Fixed bottom area */}
      <div className="flex-shrink-0 border-t border-gray-200">
        {/* Action bar for workflow controls */}
        {workflowState && workflowState.status !== 'idle' && (
          <div className="bg-gray-50 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Feature:</span> {workflowState.feature_name} • 
                <span className="font-medium"> Status:</span> {workflowState.status?.replace(/_/g, ' ')}
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Tech Stack Regeneration Button */}
                {techStackChanged && selectedTechStack && (
                  <button
                    onClick={handleRegenerateWithTechStack}
                    disabled={isLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Regenerate current phase with ${selectedTechStack.name}`}
                  >
                    {isLoading ? 'Regenerating...' : 'Regenerate with Tech Stack'}
                  </button>
                )}

                {needsApproval && (
                  <>
                    <button
                      onClick={handleApprove}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={handleRequestChanges}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Request Changes
                    </button>
                  </>
                )}
                
                <button
                  onClick={handleReset}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Reset Workflow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tech Stack Panel */}
        <div className="px-6 py-3">
          <TechStackPanel 
            onTechStackChange={handleTechStackChange}
          />
        </div>

        {/* Message input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          placeholder={
            workflowState?.pending_approval 
              ? "Provide feedback or click 'Approve' above..."
              : "Describe your feature idea..."
          }
        />
      </div>
    </div>
  );
};

export default ChatInterface; 