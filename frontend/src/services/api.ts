/**
 * API client service for communicating with the FastAPI backend
 * Provides type-safe methods for all workflow and file management operations
 */

// Base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Type definitions for API responses - simplified for current backend compatibility
export interface PhaseResult {
  phase: 'requirements' | 'design' | 'tasks';
  content: string;
  generated_at?: string;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  feedback?: string;
}

export interface SpecState {
  workflow_id?: string;
  id?: string; // For backward compatibility
  feature_name?: string;
  initial_description?: string;
  user_input?: string; // For backward compatibility
  current_phase?: 'requirements' | 'design' | 'tasks' | 'completed';
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  requirements?: PhaseResult;
  design?: PhaseResult;
  tasks?: PhaseResult;
  llm_provider?: 'openai' | 'anthropic';
  model_name?: string;
  enable_research?: boolean;
  errors?: string[];
  
  // Current status field - handles both simple and complex responses
  status?: 'idle' | 'initializing' | 'generating_requirements' | 'awaiting_requirements_approval' | 
          'generating_design' | 'awaiting_design_approval' | 'generating_tasks' | 
          'awaiting_tasks_approval' | 'generating_final_documents' | 'completed' | 'error';
  message?: string;
}

export interface StartWorkflowRequest {
  feature_name: string;
  description: string;
  llm_provider?: 'openai' | 'anthropic';
  model_name?: string;
  enable_research?: boolean;
}

export interface ApprovalRequest {
  workflow_id: string;
  action: 'approve' | 'reject' | 'revise';
  feedback?: string;
}

export interface SettingsUpdateRequest {
  llm_provider: 'openai' | 'anthropic';
  openai_api_key?: string;
  anthropic_api_key?: string;
}

// Custom error class for API errors
export class ApiError extends Error {
  public status: number;
  public statusText: string;

  constructor(status: number, statusText: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * Generic API request function with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        response.status,
        response.statusText,
        errorText || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text() as unknown as T;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network or other errors
    throw new ApiError(0, 'Network Error', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Workflow Management API
 */
export const workflowApi = {
  /**
   * Start a new specification workflow
   */
  async startWorkflow(request: StartWorkflowRequest): Promise<SpecState> {
    return apiRequest<SpecState>('/api/spec/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get current workflow status
   */
  async getStatus(): Promise<SpecState> {
    return apiRequest<SpecState>('/api/spec/status');
  },

  /**
   * Submit approval or feedback for a workflow phase
   */
  async submitApproval(request: ApprovalRequest): Promise<SpecState> {
    return apiRequest<SpecState>('/api/spec/approve', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Reset the workflow to start over
   */
  async resetWorkflow(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/spec/reset', {
      method: 'POST',
    });
  },
};

/**
 * File Management API
 */
export const fileApi = {
  /**
   * Get all generated files
   */
  async getFiles(): Promise<{
    requirements_file?: string;
    design_file?: string;
    tasks_file?: string;
  }> {
    return apiRequest<any>('/api/spec/files');
  },

  /**
   * Preview a specific phase document
   */
  async previewDocument(phase: 'requirements' | 'design' | 'tasks'): Promise<string> {
    return apiRequest<string>(`/api/spec/preview/${phase}`);
  },
};

/**
 * Settings Management API
 */
export const settingsApi = {
  /**
   * Update application settings
   */
  async updateSettings(request: SettingsUpdateRequest): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/spec/settings', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

/**
 * Utility function to check if the backend is reachable
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/spec/status`);
    return response.status === 200 || response.status === 404; // 404 is fine, means no active workflow
  } catch {
    return false;
  }
} 