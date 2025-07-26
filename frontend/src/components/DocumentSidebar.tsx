import React, { useState } from 'react';
import { useWorkflow } from '../contexts/WorkflowContext';
import DocumentModal from './DocumentModal';
import MarkdownRenderer from './MarkdownRenderer';

/**
 * Document sidebar component that displays generated documents
 * Shows requirements, design, and tasks based on workflow state
 */
const DocumentSidebar: React.FC = () => {
  const { workflowState } = useWorkflow();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
  }>({
    isOpen: false,
    title: '',
    content: ''
  });

  const openModal = (title: string, content: string) => {
    setModalState({
      isOpen: true,
      title,
      content
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      content: ''
    });
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Generated Documents
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
        {/* Requirements Document */}
        <div className={`card p-4 ${workflowState?.requirements ? '' : 'opacity-50'}`}>
          <h4 className="font-medium text-gray-700 mb-2">Requirements</h4>
          {workflowState?.requirements?.content ? (
            <div className="text-sm">
              <div className="mb-2">
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  workflowState.requirements.approval_status === 'approved' 
                    ? 'bg-green-100 text-green-800' 
                    : workflowState.requirements.approval_status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {workflowState.requirements.approval_status === 'pending' ? 'Ready for Review' : 
                   workflowState.requirements.approval_status === 'approved' ? 'Approved' : 'Generated'}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-3 rounded text-xs">
                <MarkdownRenderer 
                  content={workflowState.requirements.content.substring(0, 500) + 
                    (workflowState.requirements.content.length > 500 ? '...' : '')}
                  isPreview={true}
                />
              </div>
              {workflowState.requirements.content.length > 500 && (
                <button 
                  onClick={() => openModal('Requirements Document', workflowState.requirements!.content)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  View Full Document
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Generated requirements document will appear here
            </p>
          )}
        </div>

        {/* Design Document */}
        <div className={`card p-4 ${workflowState?.design ? '' : 'opacity-50'}`}>
          <h4 className="font-medium text-gray-700 mb-2">Design</h4>
          {workflowState?.design?.content ? (
            <div className="text-sm">
              <div className="mb-2">
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  workflowState.design.approval_status === 'approved' 
                    ? 'bg-green-100 text-green-800' 
                    : workflowState.design.approval_status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {workflowState.design.approval_status === 'pending' ? 'Ready for Review' : 
                   workflowState.design.approval_status === 'approved' ? 'Approved' : 'Generated'}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-3 rounded text-xs">
                <MarkdownRenderer 
                  content={workflowState.design.content.substring(0, 500) + 
                    (workflowState.design.content.length > 500 ? '...' : '')}
                  isPreview={true}
                />
              </div>
              {workflowState.design.content.length > 500 && (
                <button 
                  onClick={() => openModal('Design Document', workflowState.design!.content)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  View Full Document
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Generated design document will appear here
            </p>
          )}
        </div>

        {/* Tasks Document */}
        <div className={`card p-4 ${workflowState?.tasks ? '' : 'opacity-50'}`}>
          <h4 className="font-medium text-gray-700 mb-2">Tasks</h4>
          {workflowState?.tasks?.content ? (
            <div className="text-sm">
              <div className="mb-2">
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  workflowState.tasks.approval_status === 'approved' 
                    ? 'bg-green-100 text-green-800' 
                    : workflowState.tasks.approval_status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {workflowState.tasks.approval_status === 'pending' ? 'Ready for Review' : 
                   workflowState.tasks.approval_status === 'approved' ? 'Approved' : 'Generated'}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-3 rounded text-xs">
                <MarkdownRenderer 
                  content={workflowState.tasks.content.substring(0, 500) + 
                    (workflowState.tasks.content.length > 500 ? '...' : '')}
                  isPreview={true}
                />
              </div>
              {workflowState.tasks.content.length > 500 && (
                <button 
                  onClick={() => openModal('Tasks Document', workflowState.tasks!.content)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  View Full Document
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Generated task list will appear here
            </p>
          )}
        </div>
        </div>
      </div>

      {/* Document Modal */}
      <DocumentModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        content={modalState.content}
      />
    </div>
  );
};

export default DocumentSidebar; 