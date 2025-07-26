import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { SpecState } from '../services/api';

interface WorkflowContextType {
  workflowState: SpecState | null;
  setWorkflowState: (state: SpecState | null) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export const WorkflowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [workflowState, setWorkflowState] = useState<SpecState | null>(null);

  return (
    <WorkflowContext.Provider value={{ workflowState, setWorkflowState }}>
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}; 