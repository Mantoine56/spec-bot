import React, { useState } from 'react';
import { useWorkflow } from '../contexts/WorkflowContext';
import DocumentModal from './DocumentModal';

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
        <div className={`border border-gray-200 rounded-lg p-3 ${workflowState?.requirements ? '' : 'opacity-50'}`}>
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-gray-700 text-sm">Requirements</h4>
            {workflowState?.requirements?.content && (
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                workflowState.requirements.approval_status === 'approved' 
                  ? 'bg-green-100 text-green-700' 
                  : workflowState.requirements.approval_status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {workflowState.requirements.approval_status === 'pending' ? 'Ready for Review' : 
                 workflowState.requirements.approval_status === 'approved' ? 'Approved' : 'Generated'}
              </span>
            )}
          </div>
          {workflowState?.requirements?.content ? (
            <button 
              onClick={() => openModal('Requirements Document', workflowState.requirements!.content)}
              className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
            >
              View Document →
            </button>
          ) : (
            <p className="text-xs text-gray-500">
              Will be generated first
            </p>
          )}
        </div>

        {/* Design Document */}
        <div className={`border border-gray-200 rounded-lg p-3 ${workflowState?.design ? '' : 'opacity-50'}`}>
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-gray-700 text-sm">Design</h4>
            {workflowState?.design?.content && (
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                workflowState.design.approval_status === 'approved' 
                  ? 'bg-green-100 text-green-700' 
                  : workflowState.design.approval_status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {workflowState.design.approval_status === 'pending' ? 'Ready for Review' : 
                 workflowState.design.approval_status === 'approved' ? 'Approved' : 'Generated'}
              </span>
            )}
          </div>
          {workflowState?.design?.content ? (
            <button 
              onClick={() => openModal('Design Document', workflowState.design!.content)}
              className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
            >
              View Document →
            </button>
          ) : (
            <p className="text-xs text-gray-500">
              Generated after requirements approval
            </p>
          )}
        </div>

        {/* Tasks Document */}
        <div className={`border border-gray-200 rounded-lg p-3 ${workflowState?.tasks ? '' : 'opacity-50'}`}>
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-gray-700 text-sm">Tasks</h4>
            {workflowState?.tasks?.content && (
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                workflowState.tasks.approval_status === 'approved' 
                  ? 'bg-green-100 text-green-700' 
                  : workflowState.tasks.approval_status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {workflowState.tasks.approval_status === 'pending' ? 'Ready for Review' : 
                 workflowState.tasks.approval_status === 'approved' ? 'Approved' : 'Generated'}
              </span>
            )}
          </div>
          {workflowState?.tasks?.content ? (
            <button 
              onClick={() => openModal('Tasks Document', workflowState.tasks!.content)}
              className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
            >
              View Document →
            </button>
          ) : (
            <p className="text-xs text-gray-500">
              Generated after design approval
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