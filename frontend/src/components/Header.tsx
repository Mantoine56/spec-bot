import React, { useState } from 'react';
import Settings from './Settings';

/**
 * Application header component
 * Contains branding, navigation, and user controls
 */
const Header: React.FC = () => {
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* Logo and Title - Compact Single Line */}
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold text-gray-900">Spec Bot</h1>
              <span className="text-xs text-gray-400 font-medium">AI Spec Generator</span>
            </div>
          </div>

          {/* Status and Actions - Compact */}
          <div className="flex items-center space-x-3">
            {/* Status Indicator - More compact */}
            <div className="flex items-center space-x-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-600 font-medium">Ready</span>
            </div>

            {/* Settings Button - Smaller */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <Settings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  );
};

export default Header; 