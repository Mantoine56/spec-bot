"use strict";
/**
 * Project Detection and Context Analysis
 * Analyzes the current workspace to understand project type, tech stack, and structure
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectContext = exports.ProjectDetectorService = exports.PackageManager = exports.Framework = exports.TechStack = exports.ProjectType = void 0;
const vscode = __importStar(require("vscode"));
var ProjectType;
(function (ProjectType) {
    ProjectType["WEB_APPLICATION"] = "web-application";
    ProjectType["MOBILE_APPLICATION"] = "mobile-application";
    ProjectType["DESKTOP_APPLICATION"] = "desktop-application";
    ProjectType["API_SERVICE"] = "api-service";
    ProjectType["LIBRARY"] = "library";
    ProjectType["CLI_TOOL"] = "cli-tool";
    ProjectType["MONOREPO"] = "monorepo";
    ProjectType["UNKNOWN"] = "unknown";
})(ProjectType = exports.ProjectType || (exports.ProjectType = {}));
var TechStack;
(function (TechStack) {
    TechStack["JAVASCRIPT"] = "javascript";
    TechStack["TYPESCRIPT"] = "typescript";
    TechStack["PYTHON"] = "python";
    TechStack["JAVA"] = "java";
    TechStack["CSHARP"] = "csharp";
    TechStack["GO"] = "go";
    TechStack["RUST"] = "rust";
    TechStack["PHP"] = "php";
    TechStack["RUBY"] = "ruby";
    TechStack["SWIFT"] = "swift";
    TechStack["KOTLIN"] = "kotlin";
    TechStack["DART"] = "dart";
})(TechStack = exports.TechStack || (exports.TechStack = {}));
var Framework;
(function (Framework) {
    // Frontend
    Framework["REACT"] = "react";
    Framework["ANGULAR"] = "angular";
    Framework["VUE"] = "vue";
    Framework["SVELTE"] = "svelte";
    Framework["NEXT_JS"] = "nextjs";
    Framework["NUXT"] = "nuxt";
    // Backend
    Framework["EXPRESS"] = "express";
    Framework["FASTAPI"] = "fastapi";
    Framework["DJANGO"] = "django";
    Framework["FLASK"] = "flask";
    Framework["SPRING_BOOT"] = "spring-boot";
    Framework["ASP_NET"] = "asp-net";
    Framework["GIN"] = "gin";
    // Mobile
    Framework["REACT_NATIVE"] = "react-native";
    Framework["FLUTTER"] = "flutter";
    Framework["IONIC"] = "ionic";
    // Desktop
    Framework["ELECTRON"] = "electron";
    Framework["TAURI"] = "tauri";
})(Framework = exports.Framework || (exports.Framework = {}));
var PackageManager;
(function (PackageManager) {
    PackageManager["NPM"] = "npm";
    PackageManager["YARN"] = "yarn";
    PackageManager["PNPM"] = "pnpm";
    PackageManager["PIP"] = "pip";
    PackageManager["POETRY"] = "poetry";
    PackageManager["CONDA"] = "conda";
    PackageManager["MAVEN"] = "maven";
    PackageManager["GRADLE"] = "gradle";
    PackageManager["CARGO"] = "cargo";
    PackageManager["GO_MOD"] = "go-mod";
    PackageManager["COMPOSER"] = "composer";
    PackageManager["BUNDLER"] = "bundler";
})(PackageManager = exports.PackageManager || (exports.PackageManager = {}));
class ProjectDetectorService {
    /**
     * Analyze the current workspace and detect project context
     */
    static async analyzeProject() {
        console.log('🔍 Starting project analysis...');
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                return this.getDefaultContext();
            }
            // Scan workspace for config files
            const configFiles = await this.scanConfigFiles(workspaceRoot);
            console.log('📁 Found config files:', configFiles);
            // Analyze tech stack
            const techStack = this.analyzeTechStack(configFiles);
            console.log('💻 Detected tech stack:', techStack);
            // Detect frameworks
            const framework = await this.detectFramework(workspaceRoot, configFiles);
            console.log('🚀 Detected framework:', framework);
            // Analyze project structure
            const structure = await this.analyzeProjectStructure(workspaceRoot);
            console.log('🏗️ Project structure:', structure);
            // Determine project type
            const projectType = this.determineProjectType(techStack, framework, structure, configFiles);
            console.log('📋 Project type:', projectType);
            // Generate suggestions
            const suggestedFeatures = this.generateFeatureSuggestions(projectType, framework, techStack);
            const contextPrompt = this.buildContextPrompt(projectType, framework, techStack, structure);
            const context = {
                projectType,
                techStack,
                framework,
                isMonorepo: structure.isMonorepo,
                hasBackend: structure.hasBackend,
                hasFrontend: structure.hasFrontend,
                hasDatabase: structure.hasDatabase,
                hasMobile: structure.hasMobile,
                configFiles,
                packageManagers: this.detectPackageManagers(configFiles),
                suggestedFeatures,
                contextPrompt
            };
            console.log('✅ Project analysis complete:', context);
            return context;
        }
        catch (error) {
            console.error('❌ Error analyzing project:', error);
            return this.getDefaultContext();
        }
    }
    /**
     * Get workspace root directory
     */
    static getWorkspaceRoot() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        return workspaceFolders[0].uri;
    }
    /**
     * Scan workspace for configuration files
     */
    static async scanConfigFiles(workspaceRoot) {
        const configFiles = [];
        try {
            const entries = await vscode.workspace.fs.readDirectory(workspaceRoot);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) {
                    // Check exact file matches
                    if (this.CONFIG_FILES[name]) {
                        configFiles.push(name);
                    }
                    // Check pattern matches (like *.csproj)
                    for (const pattern of Object.keys(this.CONFIG_FILES)) {
                        if (pattern.includes('*') && this.matchesPattern(name, pattern)) {
                            configFiles.push(name);
                        }
                    }
                }
                else if (type === vscode.FileType.Directory) {
                    // Check for important directories
                    if (['ios', 'android', 'src', 'frontend', 'backend', 'api', 'web', 'mobile'].includes(name)) {
                        configFiles.push(name + '/');
                    }
                }
            }
        }
        catch (error) {
            console.log('Could not scan workspace files:', error);
        }
        return configFiles;
    }
    /**
     * Check if filename matches a pattern (simple glob matching)
     */
    static matchesPattern(filename, pattern) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filename);
    }
    /**
     * Analyze tech stack based on config files
     */
    static analyzeTechStack(configFiles) {
        const techStack = new Set();
        for (const file of configFiles) {
            const config = this.CONFIG_FILES[file];
            if (config?.techStack) {
                config.techStack.forEach((tech) => techStack.add(tech));
            }
        }
        return Array.from(techStack);
    }
    /**
     * Detect package managers
     */
    static detectPackageManagers(configFiles) {
        const packageManagers = new Set();
        for (const file of configFiles) {
            const config = this.CONFIG_FILES[file];
            if (config?.packageManager) {
                packageManagers.add(config.packageManager);
            }
        }
        return Array.from(packageManagers);
    }
    /**
     * Detect framework by analyzing package.json and other files
     */
    static async detectFramework(workspaceRoot, configFiles) {
        // Check for direct framework indicators
        for (const file of configFiles) {
            const config = this.CONFIG_FILES[file];
            if (config?.framework) {
                return config.framework;
            }
        }
        // Analyze package.json for frameworks
        if (configFiles.includes('package.json')) {
            try {
                const packageJsonUri = vscode.Uri.joinPath(workspaceRoot, 'package.json');
                const content = await vscode.workspace.fs.readFile(packageJsonUri);
                const packageJson = JSON.parse(content.toString());
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
                // React ecosystem
                if (dependencies.react) {
                    if (dependencies.next)
                        return Framework.NEXT_JS;
                    if (dependencies['react-native'])
                        return Framework.REACT_NATIVE;
                    return Framework.REACT;
                }
                // Vue ecosystem
                if (dependencies.vue) {
                    if (dependencies.nuxt)
                        return Framework.NUXT;
                    return Framework.VUE;
                }
                // Angular
                if (dependencies['@angular/core'])
                    return Framework.ANGULAR;
                // Svelte
                if (dependencies.svelte)
                    return Framework.SVELTE;
                // Backend frameworks
                if (dependencies.express)
                    return Framework.EXPRESS;
                if (dependencies.electron)
                    return Framework.ELECTRON;
            }
            catch (error) {
                console.log('Could not parse package.json:', error);
            }
        }
        return null;
    }
    /**
     * Analyze project structure
     */
    static async analyzeProjectStructure(workspaceRoot) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(workspaceRoot);
            const directories = entries
                .filter(([_, type]) => type === vscode.FileType.Directory)
                .map(([name]) => name);
            const isMonorepo = directories.some(dir => ['packages', 'apps', 'libs', 'services', 'workspaces'].includes(dir));
            const hasBackend = directories.some(dir => ['backend', 'api', 'server', 'services'].includes(dir) ||
                dir.includes('api') || dir.includes('backend'));
            const hasFrontend = directories.some(dir => ['frontend', 'web', 'client', 'ui', 'app'].includes(dir) ||
                dir.includes('frontend') || dir.includes('web'));
            const hasDatabase = directories.some(dir => ['database', 'db', 'migrations', 'schemas'].includes(dir));
            const hasMobile = directories.some(dir => ['mobile', 'ios', 'android', 'react-native'].includes(dir));
            return { isMonorepo, hasBackend, hasFrontend, hasDatabase, hasMobile };
        }
        catch (error) {
            console.log('Could not analyze project structure:', error);
            return {
                isMonorepo: false,
                hasBackend: false,
                hasFrontend: false,
                hasDatabase: false,
                hasMobile: false
            };
        }
    }
    /**
     * Determine overall project type
     */
    static determineProjectType(techStack, framework, structure, configFiles) {
        if (structure.isMonorepo)
            return ProjectType.MONOREPO;
        if (framework === Framework.REACT_NATIVE || framework === Framework.FLUTTER || structure.hasMobile) {
            return ProjectType.MOBILE_APPLICATION;
        }
        if (framework === Framework.ELECTRON || framework === Framework.TAURI) {
            return ProjectType.DESKTOP_APPLICATION;
        }
        if (structure.hasBackend && !structure.hasFrontend) {
            return ProjectType.API_SERVICE;
        }
        if (structure.hasFrontend || framework) {
            return ProjectType.WEB_APPLICATION;
        }
        // Check for CLI indicators
        if (configFiles.some(file => file.includes('bin') || file.includes('cli'))) {
            return ProjectType.CLI_TOOL;
        }
        // Check for library indicators
        if (configFiles.includes('package.json')) {
            // This would require parsing package.json to check if it's a library
            return ProjectType.LIBRARY;
        }
        return ProjectType.UNKNOWN;
    }
    /**
     * Generate feature suggestions based on project context
     */
    static generateFeatureSuggestions(projectType, framework, techStack) {
        const suggestions = [];
        switch (projectType) {
            case ProjectType.WEB_APPLICATION:
                suggestions.push('User authentication system', 'Dashboard component', 'API integration', 'Responsive layout');
                if (framework === Framework.REACT) {
                    suggestions.push('React component library', 'State management with Redux', 'React hooks for data fetching');
                }
                break;
            case ProjectType.MOBILE_APPLICATION:
                suggestions.push('Mobile navigation', 'Push notifications', 'Offline data sync', 'Camera integration');
                break;
            case ProjectType.API_SERVICE:
                suggestions.push('REST API endpoints', 'Database integration', 'Authentication middleware', 'API documentation');
                if (techStack.includes(TechStack.PYTHON)) {
                    suggestions.push('FastAPI endpoints', 'Pydantic models', 'Database migrations');
                }
                break;
            case ProjectType.MONOREPO:
                suggestions.push('Shared component library', 'Cross-package utilities', 'Build system optimization', 'Package versioning');
                break;
            default:
                suggestions.push('Core functionality', 'Configuration system', 'Error handling', 'Testing framework');
        }
        return suggestions;
    }
    /**
     * Build context prompt for LLM
     */
    static buildContextPrompt(projectType, framework, techStack, structure) {
        let prompt = `This is a ${projectType.replace('-', ' ')} project`;
        if (framework) {
            prompt += ` built with ${framework}`;
        }
        if (techStack.length > 0) {
            prompt += ` using ${techStack.join(', ')}`;
        }
        if (structure.isMonorepo) {
            prompt += ` with a monorepo structure`;
        }
        const components = [];
        if (structure.hasFrontend)
            components.push('frontend');
        if (structure.hasBackend)
            components.push('backend');
        if (structure.hasDatabase)
            components.push('database');
        if (structure.hasMobile)
            components.push('mobile');
        if (components.length > 0) {
            prompt += ` including ${components.join(', ')} components`;
        }
        prompt += '. Please generate specifications that are appropriate for this project context and tech stack.';
        return prompt;
    }
    /**
     * Get default context when analysis fails
     */
    static getDefaultContext() {
        return {
            projectType: ProjectType.UNKNOWN,
            techStack: [],
            framework: null,
            isMonorepo: false,
            hasBackend: false,
            hasFrontend: false,
            hasDatabase: false,
            hasMobile: false,
            configFiles: [],
            packageManagers: [],
            suggestedFeatures: ['Core functionality', 'User interface', 'Data management', 'Error handling'],
            contextPrompt: 'Please generate comprehensive specifications for this project.'
        };
    }
}
exports.ProjectDetectorService = ProjectDetectorService;
ProjectDetectorService.CONFIG_FILES = {
    // JavaScript/TypeScript
    'package.json': { techStack: [TechStack.JAVASCRIPT, TechStack.TYPESCRIPT], packageManager: PackageManager.NPM },
    'yarn.lock': { packageManager: PackageManager.YARN },
    'pnpm-lock.yaml': { packageManager: PackageManager.PNPM },
    'tsconfig.json': { techStack: [TechStack.TYPESCRIPT] },
    // Python
    'requirements.txt': { techStack: [TechStack.PYTHON], packageManager: PackageManager.PIP },
    'pyproject.toml': { techStack: [TechStack.PYTHON], packageManager: PackageManager.POETRY },
    'Pipfile': { techStack: [TechStack.PYTHON], packageManager: PackageManager.PIP },
    'environment.yml': { techStack: [TechStack.PYTHON], packageManager: PackageManager.CONDA },
    // Java
    'pom.xml': { techStack: [TechStack.JAVA], packageManager: PackageManager.MAVEN },
    'build.gradle': { techStack: [TechStack.JAVA], packageManager: PackageManager.GRADLE },
    // Go
    'go.mod': { techStack: [TechStack.GO], packageManager: PackageManager.GO_MOD },
    // Rust
    'Cargo.toml': { techStack: [TechStack.RUST], packageManager: PackageManager.CARGO },
    // PHP
    'composer.json': { techStack: [TechStack.PHP], packageManager: PackageManager.COMPOSER },
    // Ruby
    'Gemfile': { techStack: [TechStack.RUBY], packageManager: PackageManager.BUNDLER },
    // C#
    '*.csproj': { techStack: [TechStack.CSHARP] },
    '*.sln': { techStack: [TechStack.CSHARP] },
    // Mobile
    'pubspec.yaml': { techStack: [TechStack.DART], framework: Framework.FLUTTER },
    'ios/': { techStack: [TechStack.SWIFT] },
    'android/': { techStack: [TechStack.KOTLIN, TechStack.JAVA] },
    // Config files
    'docker-compose.yml': { hasBackend: true },
    'Dockerfile': { hasBackend: true },
    '.env': { hasBackend: true }
};
/**
 * Initialize project detector and return current project context
 */
async function getProjectContext() {
    return await ProjectDetectorService.analyzeProject();
}
exports.getProjectContext = getProjectContext;
//# sourceMappingURL=projectDetector.js.map