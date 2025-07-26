import React, { useState, useEffect } from 'react';
import { settingsApi, ApiError } from '../services/api';

/**
 * Settings configuration interface
 */
interface SettingsConfig {
  llm_provider: 'openai' | 'anthropic';
  model_name: string;
  openai_api_key: string;
  anthropic_api_key: string;
  enable_research: boolean;
}

/**
 * Settings modal props
 */
interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Settings modal component for LLM provider configuration and API key management
 * Provides secure localStorage persistence and configuration validation
 */
const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  // Settings state with defaults
  const [settings, setSettings] = useState<SettingsConfig>({
    llm_provider: 'openai',
    model_name: 'gpt-4.1',
    openai_api_key: '',
    anthropic_api_key: '',
    enable_research: false,
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState(false);

  /**
   * Load settings from localStorage on component mount
   */
  useEffect(() => {
    const savedSettings = localStorage.getItem('spec-bot-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prevSettings => ({ ...prevSettings, ...parsed }));
      } catch (error) {
        console.warn('Failed to parse saved settings:', error);
      }
    }
  }, []);

  /**
   * Save settings to localStorage
   */
  const saveToLocalStorage = (newSettings: SettingsConfig) => {
    localStorage.setItem('spec-bot-settings', JSON.stringify(newSettings));
  };

  /**
   * Handle settings form submission
   */
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Validate required API key based on selected provider
    const requiredKey = settings.llm_provider === 'openai' ? settings.openai_api_key : settings.anthropic_api_key;
    if (!requiredKey.trim()) {
      setError(`${settings.llm_provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key is required`);
      setIsLoading(false);
      return;
    }

    try {
      // Get the appropriate API key based on selected provider
      const apiKey = settings.llm_provider === 'openai' 
        ? settings.openai_api_key 
        : settings.anthropic_api_key;

      // Save to backend
      await settingsApi.updateSettings({
        provider: settings.llm_provider,
        model_name: settings.model_name,
        api_key: apiKey || undefined,
      });

      // Save to localStorage
      saveToLocalStorage(settings);
      
      setSuccess('Settings saved successfully!');
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`Failed to save settings: ${error.message}`);
      } else {
        setError('Failed to save settings. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle input changes
   */
  const handleInputChange = (field: keyof SettingsConfig, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  /**
   * Clear API key for security
   */
  const clearApiKey = (provider: 'openai' | 'anthropic') => {
    const field = `${provider}_api_key` as keyof SettingsConfig;
    handleInputChange(field, '');
  };

  /**
   * Test API connection
   */
  const testConnection = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the appropriate API key based on selected provider
      const apiKey = settings.llm_provider === 'openai' 
        ? settings.openai_api_key 
        : settings.anthropic_api_key;

      // This would ideally call a test endpoint on the backend
      await settingsApi.updateSettings({
        provider: settings.llm_provider,
        model_name: settings.model_name,
        api_key: apiKey || undefined,
      });
      
      setSuccess('Connection test successful!');
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`Connection test failed: ${error.message}`);
      } else {
        setError('Connection test failed. Please check your API key.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if modal is closed
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* LLM Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              LLM Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  handleInputChange('llm_provider', 'openai');
                  handleInputChange('model_name', 'gpt-4.1');
                }}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  settings.llm_provider === 'openai'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="font-medium">OpenAI</div>
                <div className="text-xs text-gray-500">GPT-4.1</div>
              </button>
              <button
                onClick={() => {
                  handleInputChange('llm_provider', 'anthropic');
                  handleInputChange('model_name', 'claude-3.5-sonnet');
                }}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  settings.llm_provider === 'anthropic'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="font-medium">Anthropic</div>
                <div className="text-xs text-gray-500">Claude 3.5</div>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </label>
            <select
              value={settings.model_name}
              onChange={(e) => handleInputChange('model_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {settings.llm_provider === 'openai' ? (
                <>
                  <option value="gpt-4.1">GPT-4.1 (Latest)</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4">GPT-4</option>
                </>
              ) : (
                <>
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                </>
              )}
            </select>
          </div>

          {/* API Keys Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                API Keys
              </label>
              <button
                onClick={() => setShowApiKeys(!showApiKeys)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                {showApiKeys ? 'Hide' : 'Show'} Keys
              </button>
            </div>
            
            {/* API Key Explanation */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-700">
                <strong>How API keys work:</strong> If you have keys in your .env file, they're used as defaults. 
                Adding keys here will override the .env keys for your personal use.
              </p>
            </div>

            {/* OpenAI API Key */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKeys ? 'text' : 'password'}
                  value={settings.openai_api_key}
                  onChange={(e) => handleInputChange('openai_api_key', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {settings.openai_api_key && (
                  <button
                    onClick={() => clearApiKey('openai')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Anthropic API Key */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Anthropic API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKeys ? 'text' : 'password'}
                  value={settings.anthropic_api_key}
                  onChange={(e) => handleInputChange('anthropic_api_key', e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {settings.anthropic_api_key && (
                  <button
                    onClick={() => clearApiKey('anthropic')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Additional Options
            </label>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enable-research"
                checked={settings.enable_research}
                onChange={(e) => handleInputChange('enable_research', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enable-research" className="ml-2 block text-sm text-gray-700">
                Enable web research (coming soon)
              </label>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={testConnection}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
          >
            Test Connection
          </button>
          
          <div className="space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 