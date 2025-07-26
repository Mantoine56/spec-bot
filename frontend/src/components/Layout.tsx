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
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Application Header */}
      <Header />
      
      {/* Main Content Area - takes remaining height */}
      <main className="flex-1 min-h-0 flex">
        {children}
      </main>
    </div>
  );
};

export default Layout; 