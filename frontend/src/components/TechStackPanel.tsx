import React, { useState, useEffect } from 'react';
import { techStackService, getTechStackPreview } from '../services/techStackService';
import type { TechStackProfile } from '../services/techStackService';

/**
 * Props for the TechStackPanel component
 */
interface TechStackPanelProps {
  onTechStackChange?: (profile: TechStackProfile | null) => void;
  className?: string;
}

/**
 * Collapsible tech stack panel that appears above the message input
 * Allows users to select, create, and manage technology stack profiles
 */
const TechStackPanel: React.FC<TechStackPanelProps> = ({ 
  onTechStackChange, 
  className = '' 
}) => {
  // Panel state
  const [isExpanded, setIsExpanded] = useState(false);
  const [profiles, setProfiles] = useState<TechStackProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<TechStackProfile | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);

  // Load profiles and active profile on mount
  useEffect(() => {
    const loadedProfiles = techStackService.getProfiles();
    const loadedActiveProfile = techStackService.getActiveProfile();
    
    setProfiles(loadedProfiles);
    setActiveProfile(loadedActiveProfile);
    
    // Show suggestion if no active profile is set
    if (!loadedActiveProfile && loadedProfiles.length > 0) {
      setShowSuggestion(true);
    }
  }, []);

  /**
   * Handle profile selection
   */
  const handleProfileSelect = (profile: TechStackProfile) => {
    setActiveProfile(profile);
    techStackService.setActiveProfile(profile.id);
    setShowSuggestion(false);
    onTechStackChange?.(profile);
  };

  /**
   * Handle clearing active profile
   */
  const handleClearProfile = () => {
    setActiveProfile(null);
    techStackService.setActiveProfile(null);
    onTechStackChange?.(null);
  };

  /**
   * Handle creating a new profile
   */
  const handleCreateProfile = () => {
    setShowCreateForm(true);
    setIsExpanded(true);
  };

  /**
   * Dismiss the suggestion
   */
  const dismissSuggestion = () => {
    setShowSuggestion(false);
  };

  return (
    <div className={`tech-stack-panel ${className}`}>
      {/* Auto-suggestion banner */}
      {showSuggestion && !activeProfile && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium">
                  💡 Select a tech stack to get more relevant specifications
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Choose from presets like Microsoft .NET, Modern Web, or create your own
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsExpanded(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Select Stack
              </button>
              <button
                onClick={dismissSuggestion}
                className="text-blue-400 hover:text-blue-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main panel */}
      <div className="bg-white border border-gray-200 rounded-lg">
        {/* Header */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-purple-500 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Tech Stack</span>
              {activeProfile && (
                <div className="text-xs text-gray-500">
                  {activeProfile.name}: {getTechStackPreview(activeProfile)}
                </div>
              )}
              {!activeProfile && (
                <div className="text-xs text-gray-400">No stack selected</div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {activeProfile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearProfile();
                }}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Clear tech stack"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              className={`p-1 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable content */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-4">
            {!showCreateForm ? (
              <>
                {/* Profile selection */}
                <div className="space-y-3">
                  {/* Action buttons */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">Select Tech Stack</h4>
                    <button
                      onClick={handleCreateProfile}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Create Custom
                    </button>
                  </div>

                  {/* Profile list */}
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          activeProfile?.id === profile.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => handleProfileSelect(profile)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h5 className="text-sm font-medium text-gray-800">
                                {profile.name}
                              </h5>
                              {profile.isDefault && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                  Preset
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {profile.description}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 font-mono">
                              {getTechStackPreview(profile)}
                            </p>
                          </div>
                          
                          {activeProfile?.id === profile.id && (
                            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <CreateProfileForm
                onSave={(newProfile) => {
                  const savedProfile = techStackService.saveProfile(newProfile);
                  setProfiles(techStackService.getProfiles());
                  handleProfileSelect(savedProfile);
                  setShowCreateForm(false);
                }}
                onCancel={() => setShowCreateForm(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Form for creating a new tech stack profile
 */
interface CreateProfileFormProps {
  onSave: (profile: Omit<TechStackProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const CreateProfileForm: React.FC<CreateProfileFormProps> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    detailLevel: 'simple' as 'simple' | 'detailed',
    frontend: '',
    backend: '',
    database: '',
    languages: '',
    infrastructure: '',
    authentication: '',
    styling: '',
    stateManagement: '',
    testing: '',
    deployment: '',
    other: '',
    customInstructions: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a name for your tech stack profile');
      return;
    }

    onSave(formData);
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Create Custom Tech Stack</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Profile Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="My Custom Stack"
            className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Brief description of this stack"
            className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Detail Level
          </label>
          <select
            value={formData.detailLevel}
            onChange={(e) => updateField('detailLevel', e.target.value)}
            className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="simple">Simple (Frontend, Backend, Database)</option>
            <option value="detailed">Detailed (All categories)</option>
          </select>
        </div>
      </div>

      {/* Tech stack fields */}
      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
        <TechField label="Frontend" value={formData.frontend} onChange={(v) => updateField('frontend', v)} placeholder="React, Vue, Angular..." />
        <TechField label="Backend" value={formData.backend} onChange={(v) => updateField('backend', v)} placeholder="Node.js, .NET, FastAPI..." />
        <TechField label="Database" value={formData.database} onChange={(v) => updateField('database', v)} placeholder="PostgreSQL, MongoDB..." />
        
        {formData.detailLevel === 'detailed' && (
          <>
            <TechField label="Languages" value={formData.languages} onChange={(v) => updateField('languages', v)} placeholder="TypeScript, C#, Python..." />
            <TechField label="Styling" value={formData.styling} onChange={(v) => updateField('styling', v)} placeholder="TailwindCSS, Material-UI..." />
            <TechField label="State Management" value={formData.stateManagement} onChange={(v) => updateField('stateManagement', v)} placeholder="Redux, Zustand..." />
            <TechField label="Authentication" value={formData.authentication} onChange={(v) => updateField('authentication', v)} placeholder="JWT, OAuth2..." />
            <TechField label="Testing" value={formData.testing} onChange={(v) => updateField('testing', v)} placeholder="Jest, Cypress..." />
            <TechField label="Infrastructure" value={formData.infrastructure} onChange={(v) => updateField('infrastructure', v)} placeholder="AWS, Azure, Docker..." />
            <TechField label="Deployment" value={formData.deployment} onChange={(v) => updateField('deployment', v)} placeholder="Vercel, Azure DevOps..." />
            <TechField label="Other" value={formData.other} onChange={(v) => updateField('other', v)} placeholder="Additional technologies..." />
          </>
        )}
      </div>

      {/* Custom instructions */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Custom Instructions (Optional)
        </label>
        <textarea
          value={formData.customInstructions}
          onChange={(e) => updateField('customInstructions', e.target.value)}
          placeholder="Any specific requirements or preferences for the AI..."
          rows={2}
          className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          Save Profile
        </button>
      </div>
    </form>
  );
};

/**
 * Individual tech field component
 */
interface TechFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

const TechField: React.FC<TechFieldProps> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </div>
);

export default TechStackPanel; 