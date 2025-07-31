"use strict";
/**
 * Spec-Bot VS Code Extension
 * Main extension entry point that creates and manages the webview panel
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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const SpecBotPanel_1 = require("./webview/SpecBotPanel");
const SettingsPanel_1 = require("./webview/SettingsPanel");
const fileManager_1 = require("./utils/fileManager");
/**
 * Open recent specification files in the editor
 */
async function openRecentSpecifications() {
    try {
        // Validate workspace
        if (!fileManager_1.FileManagerService.validateWorkspace()) {
            return;
        }
        // Get recent specification folders
        const recentSpecs = await fileManager_1.FileManagerService.getRecentSpecifications();
        if (recentSpecs.length === 0) {
            vscode.window.showInformationMessage('No generated specifications found. Generate your first spec to get started!', 'Generate Spec').then(selection => {
                if (selection === 'Generate Spec') {
                    vscode.commands.executeCommand('spec-bot.openPanel');
                }
            });
            return;
        }
        // Show quick pick to select specification folder
        const items = recentSpecs.map(uri => {
            const folderName = uri.path.split('/').pop() || 'Unknown';
            return {
                label: `📁 ${folderName}`,
                description: 'Generated specification',
                uri: uri
            };
        });
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a specification to open',
            matchOnDescription: true
        });
        if (selected) {
            // Get all markdown files in the selected folder
            const folderContents = await vscode.workspace.fs.readDirectory(selected.uri);
            const markdownFiles = folderContents
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name]) => vscode.Uri.joinPath(selected.uri, name));
            // Open all markdown files
            for (const fileUri of markdownFiles) {
                const document = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(document, { preview: false });
            }
            console.log(`📖 Opened ${markdownFiles.length} specification files`);
        }
    }
    catch (error) {
        console.error('❌ Error opening recent specifications:', error);
        vscode.window.showErrorMessage(`Failed to open recent specifications: ${error}`);
    }
}
/**
 * Clear workflow history and old specification files
 */
async function clearWorkflowHistory() {
    try {
        const action = await vscode.window.showWarningMessage('Are you sure you want to clear all workflow history? This will delete all generated specification files.', { modal: true }, 'Clear All', 'Cancel');
        if (action === 'Clear All') {
            // Validate workspace
            if (!fileManager_1.FileManagerService.validateWorkspace()) {
                return;
            }
            const workspaceRoot = fileManager_1.FileManagerService.getWorkspaceRoot();
            if (!workspaceRoot) {
                return;
            }
            const specFolderUri = vscode.Uri.joinPath(workspaceRoot, 'spec-bot-generated');
            try {
                // Delete the entire spec-bot-generated folder
                await vscode.workspace.fs.delete(specFolderUri, { recursive: true });
                vscode.window.showInformationMessage('✅ Workflow history cleared successfully!');
                console.log('🗑️ Cleared all specification files');
            }
            catch (error) {
                // If folder doesn't exist, that's fine
                if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                    vscode.window.showInformationMessage('✅ No workflow history to clear.');
                }
                else {
                    throw error;
                }
            }
        }
    }
    catch (error) {
        console.error('❌ Error clearing workflow history:', error);
        vscode.window.showErrorMessage(`Failed to clear workflow history: ${error}`);
    }
}
/**
 * Extension activation function
 * Called when the extension is activated (first time command is executed)
 */
function activate(context) {
    console.log('🚀 Spec-Bot extension activated successfully!');
    try {
        // Initialize file manager service
        (0, fileManager_1.initializeFileManager)(context);
        // Register all Spec-Bot commands
        const commands = [
            // Main command: Generate Specification
            vscode.commands.registerCommand('spec-bot.openPanel', () => {
                console.log('🤖 Generate Specification command executed!');
                SpecBotPanel_1.SpecBotPanel.createOrShow(context.extensionUri);
            }),
            // Open Generated Files command
            vscode.commands.registerCommand('spec-bot.openRecentFiles', async () => {
                console.log('📁 Open Generated Files command executed!');
                await openRecentSpecifications();
            }),
            // Clear Workflow History command
            vscode.commands.registerCommand('spec-bot.clearHistory', async () => {
                console.log('🗑️ Clear History command executed!');
                await clearWorkflowHistory();
            }),
            // Configure Settings command
            vscode.commands.registerCommand('spec-bot.openSettings', () => {
                console.log('⚙️ Configure Settings command executed!');
                SettingsPanel_1.SettingsPanel.createOrShow(context.extensionUri, context);
            }),
            // Refresh Extension command
            vscode.commands.registerCommand('spec-bot.refreshExtension', () => {
                console.log('🔄 Refresh Extension command executed!');
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            })
        ];
        // Register all commands
        context.subscriptions.push(...commands);
        console.log('✅ All Spec-Bot commands registered successfully');
        // Set context variable to show the panel in explorer
        vscode.commands.executeCommand('setContext', 'spec-bot.panelVisible', true);
        console.log('✅ Extension setup complete');
    }
    catch (error) {
        console.error('❌ Error in extension activation:', error);
    }
}
exports.activate = activate;
/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
function deactivate() {
    console.log('Spec-Bot extension deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map