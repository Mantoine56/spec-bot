import React from 'react';
import Layout from './components/Layout';
import ChatInterface from './components/ChatInterface';
import DocumentSidebar from './components/DocumentSidebar';
import { WorkflowProvider } from './contexts/WorkflowContext';

/**
 * Main application component
 * Sets up the layout and routing for the spec bot application
 */
function App() {
  return (
    <WorkflowProvider>
      <Layout>
        {/* Chat Interface Area */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatInterface />
        </div>

        {/* Document Preview Sidebar */}
        <DocumentSidebar />
      </Layout>
    </WorkflowProvider>
  );
}

export default App;
