"use strict";
/**
 * File Management Utilities for Spec-Bot VS Code Extension
 * Handles all file system operations for saving and managing generated specifications
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
exports.initializeFileManager = exports.FileManagerService = void 0;
const vscode = __importStar(require("vscode"));
class FileManagerService {
    /**
     * Get the current workspace root directory
     */
    static getWorkspaceRoot() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        return workspaceFolders[0].uri;
    }
    /**
     * Generate a safe folder name from feature name
     */
    static sanitizeFeatureName(featureName) {
        return featureName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }
    /**
     * Create the specification folder structure
     */
    static async createSpecFolder(featureName) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            throw new Error('No workspace is currently open. Please open a folder or workspace first.');
        }
        const sanitizedName = this.sanitizeFeatureName(featureName);
        const specFolderUri = vscode.Uri.joinPath(workspaceRoot, this.SPEC_FOLDER, sanitizedName);
        try {
            // Create the directory (will not fail if it already exists)
            await vscode.workspace.fs.createDirectory(specFolderUri);
            console.log('📁 Created spec folder:', specFolderUri.fsPath);
            return specFolderUri;
        }
        catch (error) {
            console.error('❌ Failed to create spec folder:', error);
            throw new Error(`Failed to create specification folder: ${error}`);
        }
    }
    /**
     * Save a specification file to the workspace
     */
    static async saveSpecFile(folderUri, fileName, content) {
        const fileUri = vscode.Uri.joinPath(folderUri, fileName);
        const encoder = new TextEncoder();
        try {
            await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));
            console.log('💾 Saved spec file:', fileName);
            return fileUri;
        }
        catch (error) {
            console.error(`❌ Failed to save ${fileName}:`, error);
            throw new Error(`Failed to save ${fileName}: ${error}`);
        }
    }
    /**
     * Save all specification files for a workflow
     */
    static async saveAllSpecifications(featureName, specifications) {
        const result = {
            success: false,
            files: [],
            errors: []
        };
        try {
            // Create the folder
            const folderUri = await this.createSpecFolder(featureName);
            if (!folderUri) {
                result.errors.push('Failed to create specification folder');
                return result;
            }
            // Save each specification file
            const savePromises = [];
            if (specifications.requirements) {
                savePromises.push(this.saveSpecFile(folderUri, 'requirements.md', specifications.requirements));
            }
            if (specifications.design) {
                savePromises.push(this.saveSpecFile(folderUri, 'design.md', specifications.design));
            }
            if (specifications.tasks) {
                savePromises.push(this.saveSpecFile(folderUri, 'tasks.md', specifications.tasks));
            }
            // Wait for all files to be saved
            const savedFiles = await Promise.all(savePromises);
            result.files = savedFiles;
            result.success = true;
            // Show success notification
            const fileCount = savedFiles.length;
            vscode.window.showInformationMessage(`✅ Successfully saved ${fileCount} specification file${fileCount > 1 ? 's' : ''} to workspace!`, 'Open Folder').then(selection => {
                if (selection === 'Open Folder') {
                    vscode.commands.executeCommand('revealInExplorer', folderUri);
                }
            });
        }
        catch (error) {
            result.errors.push(error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`❌ Failed to save specifications: ${error}`);
        }
        return result;
    }
    /**
     * Open specification files in VS Code editor
     */
    static async openSpecificationFiles(files) {
        try {
            // Open each file in a new tab
            for (const fileUri of files) {
                const document = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(document, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Beside // Open alongside current file
                });
            }
            console.log(`📖 Opened ${files.length} specification files in editor`);
        }
        catch (error) {
            console.error('❌ Failed to open specification files:', error);
            vscode.window.showErrorMessage(`Failed to open specification files: ${error}`);
        }
    }
    /**
     * Check if workspace is available and show appropriate error if not
     */
    static validateWorkspace() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            vscode.window.showWarningMessage('⚠️ No workspace is open. Please open a folder or workspace to save specifications.', 'Open Folder').then(selection => {
                if (selection === 'Open Folder') {
                    vscode.commands.executeCommand('workbench.action.files.openFolder');
                }
            });
            return false;
        }
        return true;
    }
    /**
     * Get the path to recently generated specifications
     */
    static async getRecentSpecifications() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return [];
        }
        const specFolderUri = vscode.Uri.joinPath(workspaceRoot, this.SPEC_FOLDER);
        try {
            const entries = await vscode.workspace.fs.readDirectory(specFolderUri);
            const recentFolders = [];
            // Get all specification folders (sorted by name for now)
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    recentFolders.push(vscode.Uri.joinPath(specFolderUri, name));
                }
            }
            return recentFolders.slice(0, 10); // Return last 10 folders
        }
        catch (error) {
            console.log('No recent specifications found');
            return [];
        }
    }
    /**
     * Clean up old specification folders (keep last 20)
     */
    static async cleanupOldSpecifications() {
        try {
            const recentSpecs = await this.getRecentSpecifications();
            const KEEP_COUNT = 20;
            if (recentSpecs.length > KEEP_COUNT) {
                const toDelete = recentSpecs.slice(KEEP_COUNT);
                for (const folderUri of toDelete) {
                    await vscode.workspace.fs.delete(folderUri, { recursive: true });
                    console.log('🗑️ Cleaned up old specification folder:', folderUri.fsPath);
                }
            }
        }
        catch (error) {
            console.log('Could not clean up old specifications:', error);
        }
    }
}
exports.FileManagerService = FileManagerService;
FileManagerService.SPEC_FOLDER = 'spec-bot-generated';
/**
 * Initialize file manager service and set up workspace watchers
 */
function initializeFileManager(context) {
    console.log('📁 Initializing File Manager Service...');
    // Clean up old specifications on startup
    FileManagerService.cleanupOldSpecifications();
    // Watch for workspace changes
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        console.log('📁 Workspace folders changed, reinitializing file manager');
    });
    context.subscriptions.push(workspaceWatcher);
    console.log('✅ File Manager Service initialized');
}
exports.initializeFileManager = initializeFileManager;
//# sourceMappingURL=fileManager.js.map