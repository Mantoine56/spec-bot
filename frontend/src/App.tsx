import React from 'react';
import Layout from './components/Layout';
import ChatInterface from './components/ChatInterface';

/**
 * Main application component
 * Sets up the layout and routing for the spec bot application
 */
function App() {
  return (
    <Layout>
      <div className="flex-1 flex">
        {/* Chat Interface Area */}
        <div className="flex-1 flex flex-col">
          <ChatInterface />
        </div>

        {/* Document Preview Sidebar (placeholder for now) */}
        <div className="w-96 bg-white border-l border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Generated Documents
          </h3>
          <div className="space-y-4">
            <div className="card p-4 opacity-50">
              <h4 className="font-medium text-gray-700 mb-2">Requirements</h4>
              <p className="text-sm text-gray-500">
                Generated requirements document will appear here
              </p>
            </div>
            <div className="card p-4 opacity-50">
              <h4 className="font-medium text-gray-700 mb-2">Design</h4>
              <p className="text-sm text-gray-500">
                Generated design document will appear here
              </p>
            </div>
            <div className="card p-4 opacity-50">
              <h4 className="font-medium text-gray-700 mb-2">Tasks</h4>
              <p className="text-sm text-gray-500">
                Generated task list will appear here
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;
