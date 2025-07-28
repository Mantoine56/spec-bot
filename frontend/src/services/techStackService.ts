/**
 * Tech Stack Profile Management Service
 * Handles saving, loading, and managing technology stack profiles for AI specification generation
 */

export interface TechStackProfile {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Tech stack details
  frontend?: string;
  backend?: string;
  database?: string;
  languages?: string;
  infrastructure?: string;
  authentication?: string;
  styling?: string;
  stateManagement?: string;
  testing?: string;
  deployment?: string;
  other?: string;
  
  // AI prompt preferences
  detailLevel: 'simple' | 'detailed';
  customInstructions?: string;
}

export interface TechStackService {
  getProfiles(): TechStackProfile[];
  getProfile(id: string): TechStackProfile | null;
  saveProfile(profile: Omit<TechStackProfile, 'id' | 'createdAt' | 'updatedAt'>): TechStackProfile;
  updateProfile(id: string, updates: Partial<TechStackProfile>): TechStackProfile | null;
  deleteProfile(id: string): boolean;
  getDefaultPresets(): TechStackProfile[];
  getActiveProfile(): TechStackProfile | null;
  setActiveProfile(id: string | null): void;
}

class TechStackServiceImpl implements TechStackService {
  private readonly storageKey = 'spec-bot-tech-stacks';
  private readonly activeProfileKey = 'spec-bot-active-tech-stack';

  /**
   * Get all saved tech stack profiles
   */
  getProfiles(): TechStackProfile[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        // Initialize with default presets
        const presets = this.getDefaultPresets();
        this.saveProfilesToStorage(presets);
        return presets;
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error loading tech stack profiles:', error);
      return this.getDefaultPresets();
    }
  }

  /**
   * Get a specific profile by ID
   */
  getProfile(id: string): TechStackProfile | null {
    const profiles = this.getProfiles();
    return profiles.find(p => p.id === id) || null;
  }

  /**
   * Save a new tech stack profile
   */
  saveProfile(profileData: Omit<TechStackProfile, 'id' | 'createdAt' | 'updatedAt'>): TechStackProfile {
    const profiles = this.getProfiles();
    const now = new Date().toISOString();
    
    const newProfile: TechStackProfile = {
      ...profileData,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    profiles.push(newProfile);
    this.saveProfilesToStorage(profiles);
    
    return newProfile;
  }

  /**
   * Update an existing profile
   */
  updateProfile(id: string, updates: Partial<TechStackProfile>): TechStackProfile | null {
    const profiles = this.getProfiles();
    const profileIndex = profiles.findIndex(p => p.id === id);
    
    if (profileIndex === -1) return null;

    profiles[profileIndex] = {
      ...profiles[profileIndex],
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };

    this.saveProfilesToStorage(profiles);
    return profiles[profileIndex];
  }

  /**
   * Delete a profile
   */
  deleteProfile(id: string): boolean {
    const profiles = this.getProfiles();
    const filteredProfiles = profiles.filter(p => p.id !== id);
    
    if (filteredProfiles.length === profiles.length) return false;

    this.saveProfilesToStorage(filteredProfiles);
    
    // Clear active profile if it was deleted
    if (this.getActiveProfile()?.id === id) {
      this.setActiveProfile(null);
    }
    
    return true;
  }

  /**
   * Get currently active tech stack profile
   */
  getActiveProfile(): TechStackProfile | null {
    try {
      const activeId = localStorage.getItem(this.activeProfileKey);
      return activeId ? this.getProfile(activeId) : null;
    } catch (error) {
      console.error('Error getting active profile:', error);
      return null;
    }
  }

  /**
   * Set the active tech stack profile
   */
  setActiveProfile(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(this.activeProfileKey, id);
      } else {
        localStorage.removeItem(this.activeProfileKey);
      }
    } catch (error) {
      console.error('Error setting active profile:', error);
    }
  }

  /**
   * Get default preset profiles
   */
  getDefaultPresets(): TechStackProfile[] {
    const now = new Date().toISOString();
    
    return [
      {
        id: 'preset-microsoft-dotnet',
        name: 'Microsoft .NET Stack',
        description: 'Enterprise Microsoft stack with Azure',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        detailLevel: 'detailed',
        frontend: 'React, TypeScript, Material-UI',
        backend: '.NET 8, ASP.NET Core, Entity Framework',
        database: 'SQL Server, Azure SQL Database',
        languages: 'C#, TypeScript, SQL',
        infrastructure: 'Azure App Service, Azure Functions, Azure Storage',
        authentication: 'Azure AD, JWT tokens',
        styling: 'Material-UI, SCSS',
        stateManagement: 'Redux Toolkit',
        testing: 'xUnit, Jest, Cypress',
        deployment: 'Azure DevOps, Azure App Service',
        other: 'SignalR for real-time, Azure Service Bus'
      },
      {
        id: 'preset-modern-web',
        name: 'Modern Web Stack',
        description: 'React + Node.js with modern tooling',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        detailLevel: 'detailed',
        frontend: 'React 18, TypeScript, Vite',
        backend: 'Node.js, Express, TypeScript',
        database: 'PostgreSQL, Redis',
        languages: 'TypeScript, JavaScript, SQL',
        infrastructure: 'Docker, AWS/Vercel',
        authentication: 'JWT, OAuth2',
        styling: 'TailwindCSS, Styled Components',
        stateManagement: 'Zustand, React Query',
        testing: 'Jest, React Testing Library, Playwright',
        deployment: 'Vercel, AWS Lambda'
      },
      {
        id: 'preset-python-fullstack',
        name: 'Python Full Stack',
        description: 'FastAPI + React with Python backend',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        detailLevel: 'detailed',
        frontend: 'React, TypeScript, TailwindCSS',
        backend: 'FastAPI, Python 3.11, SQLAlchemy',
        database: 'PostgreSQL, Redis',
        languages: 'Python, TypeScript, SQL',
        infrastructure: 'Docker, AWS/GCP',
        authentication: 'JWT, OAuth2, Pydantic',
        styling: 'TailwindCSS',
        stateManagement: 'Redux Toolkit, React Query',
        testing: 'pytest, Jest, Cypress',
        deployment: 'Docker, AWS Lambda, Vercel'
      },
      {
        id: 'preset-jamstack',
        name: 'JAMstack',
        description: 'Static site with serverless backend',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        detailLevel: 'simple',
        frontend: 'React, Next.js, TypeScript',
        backend: 'Serverless Functions, API Routes',
        database: 'MongoDB, Supabase',
        languages: 'TypeScript, JavaScript',
        infrastructure: 'Vercel, Netlify, CDN',
        authentication: 'Auth0, Supabase Auth',
        styling: 'TailwindCSS, CSS Modules',
        deployment: 'Vercel, Netlify'
      },
      {
        id: 'preset-enterprise',
        name: 'Enterprise Java',
        description: 'Spring Boot enterprise architecture',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        detailLevel: 'detailed',
        frontend: 'Angular, TypeScript, Angular Material',
        backend: 'Spring Boot, Java 17, Spring Security',
        database: 'Oracle DB, PostgreSQL, Redis',
        languages: 'Java, TypeScript, SQL',
        infrastructure: 'Kubernetes, Docker, AWS/Azure',
        authentication: 'Spring Security, OAuth2, LDAP',
        styling: 'Angular Material, SCSS',
        testing: 'JUnit, Mockito, Jasmine, Protractor',
        deployment: 'Jenkins, Kubernetes, Docker'
      },
      {
        id: 'preset-mobile',
        name: 'Mobile App Stack',
        description: 'React Native with Node.js backend',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        detailLevel: 'simple',
        frontend: 'React Native, Expo, TypeScript',
        backend: 'Node.js, Express, GraphQL',
        database: 'Firebase, MongoDB',
        languages: 'TypeScript, JavaScript',
        infrastructure: 'Firebase, AWS Amplify',
        authentication: 'Firebase Auth, Auth0',
        stateManagement: 'Redux Toolkit, Apollo Client',
        testing: 'Jest, Detox',
        deployment: 'App Store, Google Play, Expo'
      },
      {
        id: 'preset-api-only',
        name: 'API Only',
        description: 'Backend API service with no frontend',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        detailLevel: 'detailed',
        backend: 'FastAPI, Python 3.11',
        database: 'PostgreSQL, Redis',
        languages: 'Python, SQL',
        infrastructure: 'Docker, Kubernetes, AWS',
        authentication: 'JWT, API Keys, OAuth2',
        testing: 'pytest, Postman/Newman',
        deployment: 'Docker, AWS ECS, API Gateway',
        other: 'OpenAPI documentation, rate limiting'
      }
    ];
  }

  /**
   * Save profiles to localStorage
   */
  private saveProfilesToStorage(profiles: TechStackProfile[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(profiles));
    } catch (error) {
      console.error('Error saving tech stack profiles:', error);
    }
  }

  /**
   * Generate a unique ID for profiles
   */
  private generateId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const techStackService = new TechStackServiceImpl();

/**
 * Helper function to format tech stack for AI prompts
 */
export function formatTechStackForPrompt(profile: TechStackProfile): string {
  const parts: string[] = [];

  if (profile.detailLevel === 'simple') {
    // Simple format
    if (profile.frontend) parts.push(`Frontend: ${profile.frontend}`);
    if (profile.backend) parts.push(`Backend: ${profile.backend}`);
    if (profile.database) parts.push(`Database: ${profile.database}`);
  } else {
    // Detailed format
    if (profile.languages) parts.push(`Languages: ${profile.languages}`);
    if (profile.frontend) parts.push(`Frontend: ${profile.frontend}`);
    if (profile.backend) parts.push(`Backend: ${profile.backend}`);
    if (profile.database) parts.push(`Database: ${profile.database}`);
    if (profile.stateManagement) parts.push(`State Management: ${profile.stateManagement}`);
    if (profile.authentication) parts.push(`Authentication: ${profile.authentication}`);
    if (profile.styling) parts.push(`Styling: ${profile.styling}`);
    if (profile.testing) parts.push(`Testing: ${profile.testing}`);
    if (profile.infrastructure) parts.push(`Infrastructure: ${profile.infrastructure}`);
    if (profile.deployment) parts.push(`Deployment: ${profile.deployment}`);
    if (profile.other) parts.push(`Other: ${profile.other}`);
  }

  let formatted = parts.join('\n');
  
  if (profile.customInstructions) {
    formatted += `\n\nAdditional Instructions: ${profile.customInstructions}`;
  }

  return formatted;
}

/**
 * Helper function to get a quick preview of a tech stack profile
 */
export function getTechStackPreview(profile: TechStackProfile): string {
  const key_parts = [
    profile.frontend,
    profile.backend,
    profile.database
  ].filter(Boolean);

  return key_parts.slice(0, 3).join(', ') || 'Custom stack';
} 