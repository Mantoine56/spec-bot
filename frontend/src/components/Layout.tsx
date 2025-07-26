import React from 'react';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Main application layout component
 * Provides the overall structure with header and main content area
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Application Header */}
      <Header />
      
      {/* Main Content Area */}
      <main className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout; 