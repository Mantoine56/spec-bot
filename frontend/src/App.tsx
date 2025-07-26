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
        <div className="flex-1 flex">
          {/* Chat Interface Area */}
          <div className="flex-1 flex flex-col">
            <ChatInterface />
          </div>

          {/* Document Preview Sidebar */}
          <DocumentSidebar />
        </div>
      </Layout>
    </WorkflowProvider>
  );
}

export default App;
