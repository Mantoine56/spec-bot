"use strict";
/**
 * SpecBotPanel - Main webview panel for Spec-Bot
 * Handles webview creation, theming, and communication with backend
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecBotPanel = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const fileManager_1 = require("../utils/fileManager");
const projectDetector_1 = require("../utils/projectDetector");
class SpecBotPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it.
        if (SpecBotPanel.currentPanel) {
            SpecBotPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(SpecBotPanel.viewType, 'Spec-Bot', column || vscode.ViewColumn.One, {
            // Enable javascript in the webview
            enableScripts: true,
            // And restrict the webview to only loading content from our extension's directory
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out', 'webview')]
        });
        SpecBotPanel.currentPanel = new SpecBotPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage((message) => {
            this._handleWebviewMessage(message);
        }, null, this._disposables);
        // Listen for theme changes to update webview styling
        vscode.window.onDidChangeActiveColorTheme(() => {
            this._update();
        }, null, this._disposables);
    }
    dispose() {
        SpecBotPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    async _handleWebviewMessage(message) {
        const config = vscode.workspace.getConfiguration('spec-bot');
        const backendUrl = config.get('backendUrl', 'http://localhost:8000');
        switch (message.type) {
            case 'apiCall':
                try {
                    // Forward API calls to the backend
                    const response = await (0, axios_1.default)({
                        method: message.method,
                        url: `${backendUrl}${message.url}`,
                        data: message.data,
                        headers: {
                            'Content-Type': 'application/json',
                            // Add API keys from settings if available
                            'X-OpenAI-Key': config.get('openaiApiKey', ''),
                            'X-Anthropic-Key': config.get('anthropicApiKey', '')
                        }
                    });
                    // Send response back to webview
                    this._panel.webview.postMessage({
                        type: 'apiResponse',
                        id: message.id,
                        data: response.data
                    });
                }
                catch (error) {
                    // Send error back to webview
                    this._panel.webview.postMessage({
                        type: 'apiError',
                        id: message.id,
                        error: error.response?.data || error.message
                    });
                }
                break;
            case 'saveToWorkspace':
                // Handle saving generated specs to the current workspace
                await this._saveSpecsToWorkspace(message.data);
                break;
            case 'openSettings':
                // Open VS Code settings for Spec-Bot
                vscode.commands.executeCommand('workbench.action.openSettings', 'spec-bot');
                break;
            case 'checkBackend':
                // Check if the backend is running
                await this._checkBackendStatus(backendUrl);
                break;
            case 'saveSpecifications':
                // Handle saving completed specifications to workspace
                await this._saveSpecificationsToWorkspace(message.featureName, message.specifications);
                break;
            case 'getProjectContext':
                // Get project context for smart suggestions
                await this._getProjectContext();
                break;
        }
    }
    async _saveSpecsToWorkspace(specs) {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
            return;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const specBotDir = vscode.Uri.joinPath(workspaceFolder.uri, '.specbot', 'specs', specs.featureName);
        try {
            // Create directory structure
            await vscode.workspace.fs.createDirectory(specBotDir);
            // Save each file
            for (const [filename, content] of Object.entries(specs.files)) {
                const fileUri = vscode.Uri.joinPath(specBotDir, filename);
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content));
            }
            // Show success message and offer to open files
            const action = await vscode.window.showInformationMessage(`Specs saved to ${specBotDir.fsPath}`, 'Open Files');
            if (action === 'Open Files') {
                // Open the requirements file first
                const requirementsUri = vscode.Uri.joinPath(specBotDir, 'requirements.md');
                const doc = await vscode.workspace.openTextDocument(requirementsUri);
                await vscode.window.showTextDocument(doc);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to save specs: ${error}`);
        }
    }
    async _saveSpecificationsToWorkspace(featureName, specifications) {
        console.log('💾 Saving specifications to workspace...', { featureName, specifications });
        try {
            // Validate workspace
            if (!fileManager_1.FileManagerService.validateWorkspace()) {
                return;
            }
            // Save all specifications using FileManagerService
            const result = await fileManager_1.FileManagerService.saveAllSpecifications(featureName, specifications);
            if (result.success && result.files.length > 0) {
                console.log('✅ Successfully saved specifications:', result.files.map(f => f.fsPath));
                // Auto-open the generated files
                await fileManager_1.FileManagerService.openSpecificationFiles(result.files);
                // Send success message back to webview
                this._panel.webview.postMessage({
                    type: 'saveSpecificationsResult',
                    success: true,
                    fileCount: result.files.length,
                    message: `Successfully saved ${result.files.length} specification files and opened them in the editor!`
                });
            }
            else {
                console.error('❌ Failed to save specifications:', result.errors);
                // Send error message back to webview
                this._panel.webview.postMessage({
                    type: 'saveSpecificationsResult',
                    success: false,
                    message: `Failed to save specifications: ${result.errors.join(', ')}`
                });
            }
        }
        catch (error) {
            console.error('❌ Error in _saveSpecificationsToWorkspace:', error);
            // Send error message back to webview
            this._panel.webview.postMessage({
                type: 'saveSpecificationsResult',
                success: false,
                message: `Error saving specifications: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
    async _getProjectContext() {
        console.log('🔍 Getting project context...');
        try {
            // Analyze current project
            const context = await (0, projectDetector_1.getProjectContext)();
            // Send project context back to webview
            this._panel.webview.postMessage({
                type: 'projectContext',
                context: context
            });
            console.log('✅ Project context sent to webview:', context);
        }
        catch (error) {
            console.error('❌ Error getting project context:', error);
            // Send error back to webview
            this._panel.webview.postMessage({
                type: 'projectContextError',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async _checkBackendStatus(backendUrl) {
        try {
            await axios_1.default.get(`${backendUrl}/health`);
            this._panel.webview.postMessage({
                type: 'backendStatus',
                status: 'connected'
            });
        }
        catch (error) {
            this._panel.webview.postMessage({
                type: 'backendStatus',
                status: 'disconnected',
                error: 'Backend server not responding. Please start the Spec-Bot backend.'
            });
        }
    }
    _getHtmlForWebview(webview) {
        // Get the current color theme
        const theme = vscode.window.activeColorTheme;
        const isDark = theme.kind === vscode.ColorThemeKind.Dark || theme.kind === vscode.ColorThemeKind.HighContrast;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spec-Bot</title>
    <style>
        /* VS Code theme variables */
        :root {
            --vscode-font-family: var(--vscode-font-family);
            --vscode-font-size: var(--vscode-font-size);
            --vscode-font-weight: var(--vscode-font-weight);
            
            /* Colors that adapt to VS Code theme */
            --vscode-foreground: var(--vscode-foreground, ${isDark ? '#cccccc' : '#333333'});
            --vscode-background: var(--vscode-editor-background, ${isDark ? '#1e1e1e' : '#ffffff'});
            --vscode-secondary-background: var(--vscode-sideBar-background, ${isDark ? '#252526' : '#f3f3f3'});
            --vscode-border: var(--vscode-panel-border, ${isDark ? '#3c3c3c' : '#e5e5e5'});
            --vscode-input-background: var(--vscode-input-background, ${isDark ? '#3c3c3c' : '#ffffff'});
            --vscode-input-border: var(--vscode-input-border, ${isDark ? '#3c3c3c' : '#cecece'});
            --vscode-button-background: var(--vscode-button-background, ${isDark ? '#0e639c' : '#007acc'});
            --vscode-button-foreground: var(--vscode-button-foreground, ${isDark ? '#ffffff' : '#ffffff'});
            --vscode-button-hover-background: var(--vscode-button-hoverBackground, ${isDark ? '#1177bb' : '#005a9e'});
            --vscode-accent: var(--vscode-focusBorder, ${isDark ? '#007fd4' : '#005a9e'});
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-background);
            height: 100vh;
            overflow: hidden;
        }

        #root {
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Override default styles to match VS Code */
        input, textarea, button, select {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
        }

        input, textarea {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            padding: 4px 8px;
        }

        input:focus, textarea:focus {
            outline: 1px solid var(--vscode-accent);
            border-color: var(--vscode-accent);
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            padding: 6px 14px;
            cursor: pointer;
            font-weight: 500;
        }

        button:hover {
            background-color: var(--vscode-button-hover-background);
        }

        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        /* Scrollbar styling to match VS Code */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background-color: ${isDark ? '#424242' : '#c1c1c1'};
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background-color: ${isDark ? '#4f4f4f' : '#a6a6a6'};
        }

        /* Loading state */
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            flex-direction: column;
            gap: 16px;
        }

        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--vscode-border);
            border-top: 3px solid var(--vscode-accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .error {
            color: var(--vscode-errorForeground, #f85149);
            padding: 16px;
            background-color: var(--vscode-inputValidation-errorBackground, rgba(248, 81, 73, 0.1));
            border: 1px solid var(--vscode-inputValidation-errorBorder, #f85149);
            border-radius: 4px;
            margin: 16px;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">
            <div class="spinner"></div>
            <div>Loading Spec-Bot...</div>
        </div>
    </div>

    <script>
        // VS Code API
        const vscode = acquireVsCodeApi();
        
        // Global state
        let backendConnected = false;
        
        // Initialize the webview
        window.addEventListener('load', () => {
            console.log('Spec-Bot webview loaded');
            checkBackendConnection();
            initializeReactApp();
        });

        // Check backend connection
        function checkBackendConnection() {
            vscode.postMessage({
                type: 'checkBackend'
            });
        }

        // API wrapper for communicating with backend through extension
        window.specBotApi = {
            call: async (method, url, data = null) => {
                return new Promise((resolve, reject) => {
                    const id = Date.now() + Math.random();
                    
                    // Store the promise resolvers
                    window.pendingApiCalls = window.pendingApiCalls || {};
                    window.pendingApiCalls[id] = { resolve, reject };
                    
                    // Send message to extension
                    vscode.postMessage({
                        type: 'apiCall',
                        id,
                        method,
                        url,
                        data
                    });
                });
            },
            
            saveToWorkspace: (specs) => {
                vscode.postMessage({
                    type: 'saveToWorkspace',
                    data: specs
                });
            },
            
            openSettings: () => {
                vscode.postMessage({
                    type: 'openSettings'
                });
            }
        };

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'apiResponse':
                    if (window.pendingApiCalls && window.pendingApiCalls[message.id]) {
                        window.pendingApiCalls[message.id].resolve(message.data);
                        delete window.pendingApiCalls[message.id];
                    }
                    break;
                    
                case 'apiError':
                    if (window.pendingApiCalls && window.pendingApiCalls[message.id]) {
                        window.pendingApiCalls[message.id].reject(new Error(message.error));
                        delete window.pendingApiCalls[message.id];
                    }
                    break;
                    
                case 'backendStatus':
                    backendConnected = message.status === 'connected';
                    updateConnectionStatus(message);
                    break;
                    
                case 'saveSpecificationsResult':
                    handleSaveSpecificationsResult(message);
                    break;
                    
                case 'projectContext':
                    handleProjectContext(message.context);
                    break;
                    
                case 'projectContextError':
                    handleProjectContextError(message.error);
                    break;
            }
        });

        function updateConnectionStatus(status) {
            const root = document.getElementById('root');
            
            if (status.status === 'disconnected') {
                root.innerHTML = \`
                    <div class="error">
                        <h3>Backend Not Connected</h3>
                        <p>\${status.error}</p>
                        <p>Please start the Spec-Bot backend server:</p>
                        <pre>cd backend && python main.py</pre>
                        <button onclick="checkBackendConnection()">Retry Connection</button>
                        <button onclick="window.specBotApi.openSettings()">Open Settings</button>
                    </div>
                \`;
            } else {
                // Backend is connected, initialize React app
                initializeReactApp();
            }
        }

        function initializeReactApp() {
            if (!backendConnected) return;
            
            // Initialize the chat interface
            const root = document.getElementById('root');
            root.innerHTML = \`
                <div style="padding: 20px; height: 100vh; display: flex; flex-direction: column;">
                    <h2 style="margin-top: 0; color: var(--vscode-foreground);">🤖 Spec-Bot</h2>
                    
                    <!-- Project Context Info -->
                    <div class="header-info"></div>
                    
                    <!-- Progress Bar -->
                    <div id="progressBar" style="display: none; background: var(--vscode-secondary-background); border: 1px solid var(--vscode-border); border-radius: 4px; padding: 12px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span id="progressText" style="font-size: 13px; font-weight: 500;">Starting workflow...</span>
                            <span id="progressPhase" style="font-size: 11px; opacity: 0.8;">Phase 1 of 3</span>
                        </div>
                        <div style="background: var(--vscode-input-background); height: 4px; border-radius: 2px; overflow: hidden;">
                            <div id="progressFill" style="background: var(--vscode-button-background); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    
                    <!-- Chat Messages Area -->
                    <div id="chatMessages" style="flex: 1; background: var(--vscode-secondary-background); border: 1px solid var(--vscode-border); border-radius: 4px; padding: 16px; margin-bottom: 16px; overflow-y: auto;">
                        <div class="message system">
                            <p>Welcome to Spec-Bot! 🚀</p>
                            <p>Enter your feature idea below to generate a comprehensive specification.</p>
                        </div>
                    </div>
                    
                    <!-- Input Area -->
                    <div style="display: flex; gap: 8px;">
                        <input id="featureInput" type="text" placeholder="Enter your feature idea..." style="flex: 1;" onkeypress="if(event.key==='Enter')handleStartWorkflow()" />
                        <button onclick="handleStartWorkflow()" id="generateBtn">Generate Spec</button>
                        <button onclick="window.specBotApi.openSettings()">Settings</button>
                    </div>
                    
                    <!-- Smart Suggestions -->
                    <div id="suggestions"></div>
                </div>
            \`;
            
            console.log('🎯 React app initialized, polling will start when workflow begins');
            
            // Theme system temporarily disabled to fix loading issues
            console.log('🎨 Theme system temporarily disabled');
            
            // Request project context for smart suggestions
            vscode.postMessage({
                type: 'getProjectContext'
            });
        }

        // Global workflow state
        let currentWorkflowId = null;
        let pollingInterval = null;
        let lastShownStatus = null;
        let shownApprovals = new Set(); // Track which approvals we've already shown
        let workflowApprovals = new Map(); // Track approvals per workflow ID
        
        async function handleStartWorkflow() {
            try {
                const input = document.getElementById('featureInput');
                const idea = input.value.trim();
                
                if (!idea) {
                    addMessage('system', 'Please enter a feature idea first!');
                    return;
                }
                
                console.log('Starting workflow for:', idea);
                addMessage('user', idea);
                addMessage('system', 'Starting spec generation... 🚀');
                
                // Disable input while processing
                input.disabled = true;
                document.getElementById('generateBtn').disabled = true;
                
                // Prepare workflow data with project context
                const workflowData = {
                    feature_name: idea,
                    description: idea,
                    llm_provider: 'openai',
                    model_name: 'gpt-4.1'
                };
                
                // Add project context if available
                if (projectContext) {
                    workflowData.project_context = {
                        project_type: projectContext.projectType,
                        tech_stack: projectContext.techStack,
                        framework: projectContext.framework,
                        context_prompt: projectContext.contextPrompt,
                        is_monorepo: projectContext.isMonorepo,
                        has_backend: projectContext.hasBackend,
                        has_frontend: projectContext.hasFrontend
                    };
                    console.log('🎯 Including project context in workflow:', workflowData.project_context);
                }
                
                // Start the workflow
                const response = await window.specBotApi.call('POST', '/api/spec/start', workflowData);
                
                console.log('Workflow started:', response);
                
                // Stop any existing polling first
                stopPolling();
                
                // Reset all tracking state
                currentWorkflowId = response.workflow_id;
                lastShownStatus = null;
                shownApprovals.clear();
                workflowApprovals.clear();
                
                console.log('🔄 Reset state for new workflow:', currentWorkflowId);
                console.log('🔄 Cleared approvals tracking');
                
                input.value = '';
                
                // Show initial progress
                updateProgress('Starting', 5, '🚀 Initializing workflow...');
                
                // Re-enable input
                input.disabled = false;
                document.getElementById('generateBtn').disabled = false;
                
                addMessage('system', \`Workflow started! ID: \${currentWorkflowId}\`);
                
                // Start fresh polling
                startPolling();
                
            } catch (error) {
                console.error('Failed to start workflow:', error);
                addMessage('system', \`Error: \${error.message}\`, 'error');
                
                // Re-enable input on error
                document.getElementById('featureInput').disabled = false;
                document.getElementById('generateBtn').disabled = false;
            }
        }

        function addMessage(type, content, style = '') {
            const chatMessages = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type} \${style}\`;
            
            const timestamp = new Date().toLocaleTimeString();
            
            let messageContent = '';
            if (type === 'user') {
                messageContent = \`
                    <div style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 12px; border-radius: 8px; margin: 8px 0; max-width: 80%; margin-left: auto;">
                        <strong>You:</strong> \${content}
                        <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">\${timestamp}</div>
                    </div>
                \`;
            } else if (type === 'assistant') {
                messageContent = \`
                    <div style="background: var(--vscode-secondary-background); border: 1px solid var(--vscode-border); padding: 12px; border-radius: 8px; margin: 8px 0; max-width: 80%;">
                        <strong>🤖 Spec-Bot:</strong><br>
                        <div style="margin-top: 8px;">\${content}</div>
                        <div style="font-size: 11px; opacity: 0.8; margin-top: 8px;">\${timestamp}</div>
                    </div>
                \`;
            } else {
                messageContent = \`
                    <div style="background: var(--vscode-input-background); border: 1px solid var(--vscode-border); padding: 8px; border-radius: 4px; margin: 4px 0; font-size: 13px; \${style === 'error' ? 'border-color: var(--vscode-errorForeground); color: var(--vscode-errorForeground);' : ''}">
                        \${content}
                    </div>
                \`;
            }
            
            messageDiv.innerHTML = messageContent;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function startPolling() {
            // Clear any existing polling first (safety)
            if (pollingInterval) {
                console.log('🔄 Clearing existing polling interval');
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            
            console.log('🚀 Starting new polling interval');
            
            // Poll every 2 seconds for workflow updates
            pollingInterval = setInterval(async () => {
                if (!currentWorkflowId) {
                    console.log('⏸️ No current workflow ID, skipping poll');
                    return;
                }
                
                try {
                    const status = await window.specBotApi.call('GET', '/api/spec/status');
                    updateWorkflowStatus(status);
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }, 2000);
        }

        function stopPolling() {
            if (pollingInterval) {
                console.log('🛑 Stopping polling interval');
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        }

        function updateWorkflowStatus(status) {
            if (!status) return;
            
            console.log('📡 ===== WORKFLOW STATUS UPDATE =====');
            console.log('📡 Full workflow status response:', JSON.stringify(status, null, 2));
            console.log('📡 Current workflow ID:', currentWorkflowId);
            console.log('📡 Status.status:', status.status);
            console.log('📡 Status.workflow_id:', status.workflow_id);
            console.log('📡 Current shownApprovals:', Array.from(shownApprovals));
            
            // If no current workflow ID, try to get it from status
            if (!currentWorkflowId && status.workflow_id) {
                currentWorkflowId = status.workflow_id;
                console.log('Set current workflow ID from status:', currentWorkflowId);
            }
            
            // Handle different workflow statuses
            console.log('🎯 About to switch on status:', status.status);
            switch (status.status) {
                case 'GENERATING_REQUIREMENTS':
                case 'generating_requirements':
                    const generatingRequirementsKey = \`\${currentWorkflowId}_generating_requirements\`;
                    if (!shownApprovals.has(generatingRequirementsKey)) {
                        console.log('✅ Showing generating requirements for workflow:', currentWorkflowId);
                        updateProgress('Phase 1 of 3', 10, '📝 Generating requirements...');
                        addMessage('system', '📝 Generating requirements...');
                        shownApprovals.add(generatingRequirementsKey);
                    }
                    break;
                    
                case 'AWAITING_REQUIREMENTS_APPROVAL':
                case 'awaiting_requirements_approval':
                    const requirementsKey = \`\${currentWorkflowId}_requirements_approval\`;
                    console.log('🔍 Checking requirements approval for workflow:', currentWorkflowId);
                    console.log('🔍 Requirements key:', requirementsKey);
                    console.log('🔍 Already shown?', shownApprovals.has(requirementsKey));
                    
                    if (!shownApprovals.has(requirementsKey)) {
                        console.log('✅ Showing requirements approval for first time');
                        updateProgress('Phase 1 of 3', 33, '📋 Requirements ready for review');
                        displayRequirementsForApproval(status);
                        // Note: shownApprovals.add() is done inside displayRequirementsForApproval()
                    } else {
                        console.log('🚫 Requirements approval already shown for workflow:', currentWorkflowId);
                    }
                    break;
                    
                case 'GENERATING_DESIGN':
                case 'generating_design':
                    const generatingDesignKey = \`\${currentWorkflowId}_generating_design\`;
                    if (!shownApprovals.has(generatingDesignKey)) {
                        console.log('✅ Showing generating design for workflow:', currentWorkflowId);
                        updateProgress('Phase 2 of 3', 40, '🎨 Generating design document...');
                        addMessage('system', '🎨 Generating design document...');
                        shownApprovals.add(generatingDesignKey);
                    }
                    break;
                    
                case 'AWAITING_DESIGN_APPROVAL':
                case 'awaiting_design_approval':
                    const designApprovalKey = \`\${currentWorkflowId}_design_approval\`;
                    console.log('🔍 Checking design approval for workflow:', currentWorkflowId);
                    console.log('🔍 Design approval key:', designApprovalKey);
                    console.log('🔍 Already shown?', shownApprovals.has(designApprovalKey));
                    
                    if (!shownApprovals.has(designApprovalKey)) {
                        console.log('✅ Showing design approval for first time');
                        updateProgress('Phase 2 of 3', 66, '🎨 Design ready for review');
                        displayDesignForApproval(status);
                        // Note: shownApprovals.add() will be done inside displayDesignForApproval()
                    } else {
                        console.log('🚫 Design approval already shown for workflow:', currentWorkflowId);
                    }
                    break;
                    
                case 'GENERATING_TASKS':
                case 'generating_tasks':
                    const generatingTasksKey = \`\${currentWorkflowId}_generating_tasks\`;
                    if (!shownApprovals.has(generatingTasksKey)) {
                        console.log('✅ Showing generating tasks for workflow:', currentWorkflowId);
                        updateProgress('Phase 3 of 3', 75, '📋 Generating implementation tasks...');
                        addMessage('system', '📋 Generating implementation tasks...');
                        shownApprovals.add(generatingTasksKey);
                    }
                    break;
                    
                case 'AWAITING_TASKS_APPROVAL':
                case 'awaiting_tasks_approval':
                    const tasksApprovalKey = \`\${currentWorkflowId}_tasks_approval\`;
                    console.log('🔍 Checking tasks approval for workflow:', currentWorkflowId);
                    console.log('🔍 Tasks approval key:', tasksApprovalKey);
                    console.log('🔍 Already shown?', shownApprovals.has(tasksApprovalKey));
                    
                    if (!shownApprovals.has(tasksApprovalKey)) {
                        console.log('✅ Showing tasks approval for first time');
                        updateProgress('Phase 3 of 3', 90, '📋 Tasks ready for review');
                        displayTasksForApproval(status);
                        // Note: shownApprovals.add() will be done inside displayTasksForApproval()
                    } else {
                        console.log('🚫 Tasks approval already shown for workflow:', currentWorkflowId);
                    }
                    break;
                    
                case 'GENERATING_FINAL_DOCUMENTS':
                case 'generating_final_documents':
                    const generatingFinalKey = \`\${currentWorkflowId}_generating_final\`;
                    if (!shownApprovals.has(generatingFinalKey)) {
                        console.log('✅ Showing generating final documents for workflow:', currentWorkflowId);
                        updateProgress('Finalizing', 95, '📄 Creating final documents...');
                        addMessage('system', '📄 Finalizing documents...');
                        shownApprovals.add(generatingFinalKey);
                    }
                    break;
                    
                case 'COMPLETED':
                case 'completed':
                    const completedKey = \`\${currentWorkflowId}_completed\`;
                    if (!shownApprovals.has(completedKey)) {
                        console.log('✅ Showing completion for workflow:', currentWorkflowId);
                        updateProgress('Complete', 100, '🎉 Specification generation complete!');
                        addMessage('assistant', '🎉 Specification generation complete! Files have been saved to your workspace.');
                        displayCompletedWorkflow(status);
                        shownApprovals.add(completedKey);
                        
                        // Stop polling and clear workflow ID
                        stopPolling();
                        currentWorkflowId = null;
                        
                        // Hide progress bar after 3 seconds
                        setTimeout(() => hideProgress(), 3000);
                    }
                    break;
                    
                case 'ERROR':
                case 'error':
                    addMessage('system', \`❌ Error: \${status.error}\`, 'error');
                    currentWorkflowId = null;
                    break;
                    
                default:
                    console.log('❌ UNHANDLED workflow status:', status.status);
                    console.log('❌ Full status object:', JSON.stringify(status, null, 2));
                    console.log('❌ Available status properties:', Object.keys(status));
                    
                    // Check if we have requirements content but status is different
                    if (status.requirements || status.generated_content?.requirements) {
                        console.log('Found requirements content in unhandled status, displaying approval UI');
                        displayRequirementsForApproval(status);
                    }
                    break;
            }
        }

        function displayRequirementsForApproval(status) {
            const requirementsKey = \`\${currentWorkflowId}_requirements_approval\`;
            console.log('🔍 displayRequirementsForApproval called for workflow:', currentWorkflowId);
            console.log('🔍 Double-checking key:', requirementsKey);
            
            // Double-check that we haven't already shown this (extra safety)
            if (shownApprovals.has(requirementsKey)) {
                console.log('🚫 DOUBLE CHECK: Requirements approval already shown, skipping...');
                return;
            }
            
            console.log('🐛 Raw status object:', JSON.stringify(status, null, 2));
            console.log('🐛 status.generated_content:', JSON.stringify(status.generated_content, null, 2));
            console.log('🐛 status.requirements:', JSON.stringify(status.requirements, null, 2));
            
            // Let's specifically check what type of content we're getting
            if (status.generated_content?.requirements) {
                console.log('🔍 Requirements content type:', typeof status.generated_content.requirements);
                console.log('🔍 Requirements content keys:', Object.keys(status.generated_content.requirements));
                if (status.generated_content.requirements.content) {
                    console.log('🔍 Requirements.content type:', typeof status.generated_content.requirements.content);
                    console.log('🔍 Requirements.content preview:', status.generated_content.requirements.content.substring(0, 200));
                }
            }
            
            // Handle different possible formats of requirements content
            let requirements;
            if (status.generated_content?.requirements) {
                if (typeof status.generated_content.requirements === 'string') {
                    requirements = status.generated_content.requirements;
                } else if (typeof status.generated_content.requirements === 'object') {
                    // Check if it has a 'content' property (likely the actual markdown)
                    if (status.generated_content.requirements.content) {
                        requirements = status.generated_content.requirements.content;
                        console.log('✅ Found requirements.content, using that');
                    } else {
                        // Fallback to JSON display if no content property
                        requirements = JSON.stringify(status.generated_content.requirements, null, 2);
                        console.log('⚠️ No requirements.content found, using JSON fallback');
                    }
                } else {
                    requirements = String(status.generated_content.requirements);
                }
            } else if (status.requirements) {
                if (typeof status.requirements === 'string') {
                    requirements = status.requirements;
                } else if (typeof status.requirements === 'object') {
                    // Check if it has a 'content' property
                    if (status.requirements.content) {
                        requirements = status.requirements.content;
                        console.log('✅ Found requirements.content, using that');
                    } else {
                        requirements = JSON.stringify(status.requirements, null, 2);
                        console.log('⚠️ No requirements.content found, using JSON fallback');
                    }
                } else {
                    requirements = String(status.requirements);
                }
            } else {
                requirements = 'Requirements generated and ready for review.';
            }
            
            console.log('📄 Final requirements content (type:', typeof requirements, ', length:', requirements.length, '):', requirements.substring(0, 200));
            
            // Mark as shown immediately to prevent race conditions
            shownApprovals.add(requirementsKey);
            console.log('✅ Marked requirements approval as shown for workflow:', currentWorkflowId);
            
            const approvalContent = \`
                <div style="margin: 16px 0;">
                    <h3 style="color: var(--vscode-foreground); margin-bottom: 16px; font-size: 18px;">📋 Requirements Generated</h3>
                    <div id="requirements-content-\${currentWorkflowId}" style="
                        background: var(--vscode-editor-background); 
                        border: 1px solid var(--vscode-panel-border); 
                        border-radius: 6px; 
                        margin: 8px 0; 
                        max-height: 400px; 
                        overflow-y: auto;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        padding: 16px;
                    ">
                        <div class="enhanced-content" id="requirements-rendered-\${currentWorkflowId}">
                            <!-- Content will be rendered here -->
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border);">
                        <button onclick="approvePhase('requirements')" style="
                            background: var(--vscode-button-background); 
                            color: var(--vscode-button-foreground);
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        ">✅ Approve Requirements</button>
                        <button onclick="requestChanges('requirements')" style="
                            background: var(--vscode-button-secondaryBackground); 
                            color: var(--vscode-button-secondaryForeground);
                            border: 1px solid var(--vscode-panel-border);
                            padding: 10px 20px;
                            border-radius: 4px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">📝 Request Changes</button>
                    </div>
                </div>
            \`;
            
            // Add the content to the chat
            addMessage('assistant', approvalContent);
            
            // Now enhance the content with syntax highlighting
            setTimeout(() => {
                const contentElement = document.getElementById('requirements-rendered-' + currentWorkflowId);
                if (contentElement) {
                    contentElement.innerHTML = renderEnhancedMarkdown(requirements);
                }
            }, 100);
        }

        function displayDesignForApproval(status) {
            const designApprovalKey = \`\${currentWorkflowId}_design_approval\`;
            console.log('🔍 displayDesignForApproval called for workflow:', currentWorkflowId);
            console.log('🔍 Double-checking design key:', designApprovalKey);
            
            // Double-check that we haven't already shown this (extra safety)
            if (shownApprovals.has(designApprovalKey)) {
                console.log('🚫 DOUBLE CHECK: Design approval already shown, skipping...');
                return;
            }
            
            console.log('🐛 Raw design status object:', JSON.stringify(status, null, 2));
            
            // Handle different possible formats of design content
            let design;
            if (status.generated_content?.design) {
                if (typeof status.generated_content.design === 'string') {
                    design = status.generated_content.design;
                } else if (typeof status.generated_content.design === 'object') {
                    // Check if it has a 'content' property (likely the actual markdown)
                    if (status.generated_content.design.content) {
                        design = status.generated_content.design.content;
                        console.log('✅ Found design.content, using that');
                    } else {
                        design = JSON.stringify(status.generated_content.design, null, 2);
                        console.log('⚠️ No design.content found, using JSON fallback');
                    }
                } else {
                    design = String(status.generated_content.design);
                }
            } else if (status.design) {
                if (typeof status.design === 'string') {
                    design = status.design;
                } else if (typeof status.design === 'object') {
                    // Check if it has a 'content' property
                    if (status.design.content) {
                        design = status.design.content;
                        console.log('✅ Found design.content, using that');
                    } else {
                        design = JSON.stringify(status.design, null, 2);
                        console.log('⚠️ No design.content found, using JSON fallback');
                    }
                } else {
                    design = String(status.design);
                }
            } else {
                design = 'Design document generated and ready for review.';
            }
            
            console.log('📄 Final design content (type:', typeof design, ', length:', design.length, '):', design.substring(0, 200));
            
            // Mark as shown immediately to prevent race conditions
            shownApprovals.add(designApprovalKey);
            console.log('✅ Marked design approval as shown for workflow:', currentWorkflowId);
            
            const approvalContent = \`
                <div style="margin: 16px 0;">
                    <h3 style="color: var(--vscode-foreground); margin-bottom: 16px; font-size: 18px;">🎨 Design Document Generated</h3>
                    <div id="design-content-\${currentWorkflowId}" style="
                        background: var(--vscode-editor-background); 
                        border: 1px solid var(--vscode-panel-border); 
                        border-radius: 6px; 
                        margin: 8px 0; 
                        max-height: 400px; 
                        overflow-y: auto;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        padding: 16px;
                    ">
                        <div class="enhanced-content" id="design-rendered-\${currentWorkflowId}">
                            <!-- Content will be rendered here -->
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border);">
                        <button onclick="approvePhase('design')" style="
                            background: var(--vscode-button-background); 
                            color: var(--vscode-button-foreground);
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        ">✅ Approve Design</button>
                        <button onclick="requestChanges('design')" style="
                            background: var(--vscode-button-secondaryBackground); 
                            color: var(--vscode-button-secondaryForeground);
                            border: 1px solid var(--vscode-panel-border);
                            padding: 10px 20px;
                            border-radius: 4px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">📝 Request Changes</button>
                    </div>
                </div>
            \`;
            
            // Add the content to the chat
            addMessage('assistant', approvalContent);
            
            // Now enhance the content with markdown rendering
            setTimeout(() => {
                const contentElement = document.getElementById('design-rendered-' + currentWorkflowId);
                if (contentElement) {
                    contentElement.innerHTML = renderEnhancedMarkdown(design);
                }
            }, 100);
        }

        function displayTasksForApproval(status) {
            const tasksApprovalKey = \`\${currentWorkflowId}_tasks_approval\`;
            console.log('🔍 displayTasksForApproval called for workflow:', currentWorkflowId);
            console.log('🔍 Double-checking tasks key:', tasksApprovalKey);
            
            // Double-check that we haven't already shown this (extra safety)
            if (shownApprovals.has(tasksApprovalKey)) {
                console.log('🚫 DOUBLE CHECK: Tasks approval already shown, skipping...');
                return;
            }
            
            console.log('🐛 Raw tasks status object:', JSON.stringify(status, null, 2));
            
            // Handle different possible formats of tasks content
            let tasks;
            if (status.generated_content?.tasks) {
                if (typeof status.generated_content.tasks === 'string') {
                    tasks = status.generated_content.tasks;
                } else if (typeof status.generated_content.tasks === 'object') {
                    // Check if it has a 'content' property (likely the actual markdown)
                    if (status.generated_content.tasks.content) {
                        tasks = status.generated_content.tasks.content;
                        console.log('✅ Found tasks.content, using that');
                    } else {
                        tasks = JSON.stringify(status.generated_content.tasks, null, 2);
                        console.log('⚠️ No tasks.content found, using JSON fallback');
                    }
                } else {
                    tasks = String(status.generated_content.tasks);
                }
            } else if (status.tasks) {
                if (typeof status.tasks === 'string') {
                    tasks = status.tasks;
                } else if (typeof status.tasks === 'object') {
                    // Check if it has a 'content' property
                    if (status.tasks.content) {
                        tasks = status.tasks.content;
                        console.log('✅ Found tasks.content, using that');
                    } else {
                        tasks = JSON.stringify(status.tasks, null, 2);
                        console.log('⚠️ No tasks.content found, using JSON fallback');
                    }
                } else {
                    tasks = String(status.tasks);
                }
            } else {
                tasks = 'Implementation tasks generated and ready for review.';
            }
            
            console.log('📄 Final tasks content (type:', typeof tasks, ', length:', tasks.length, '):', tasks.substring(0, 200));
            
            // Mark as shown immediately to prevent race conditions
            shownApprovals.add(tasksApprovalKey);
            console.log('✅ Marked tasks approval as shown for workflow:', currentWorkflowId);
            
            const approvalContent = \`
                <div style="margin: 16px 0;">
                    <h3 style="color: var(--vscode-foreground); margin-bottom: 16px; font-size: 18px;">📋 Implementation Tasks Generated</h3>
                    <div id="tasks-content-\${currentWorkflowId}" style="
                        background: var(--vscode-editor-background); 
                        border: 1px solid var(--vscode-panel-border); 
                        border-radius: 6px; 
                        margin: 8px 0; 
                        max-height: 400px; 
                        overflow-y: auto;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        padding: 16px;
                    ">
                        <div class="enhanced-content" id="tasks-rendered-\${currentWorkflowId}">
                            <!-- Content will be rendered here -->
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border);">
                        <button onclick="approvePhase('tasks')" style="
                            background: var(--vscode-button-background); 
                            color: var(--vscode-button-foreground);
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        ">✅ Approve Tasks</button>
                        <button onclick="requestChanges('tasks')" style="
                            background: var(--vscode-button-secondaryBackground); 
                            color: var(--vscode-button-secondaryForeground);
                            border: 1px solid var(--vscode-panel-border);
                            padding: 10px 20px;
                            border-radius: 4px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">📝 Request Changes</button>
                    </div>
                </div>
            \`;
            
            // Add the content to the chat
            addMessage('assistant', approvalContent);
            
            // Now enhance the content with markdown rendering
            setTimeout(() => {
                const contentElement = document.getElementById('tasks-rendered-' + currentWorkflowId);
                if (contentElement) {
                    contentElement.innerHTML = renderEnhancedMarkdown(tasks);
                }
            }, 100);
        }

        function displayCompletedWorkflow(status) {
            // Clear polling since workflow is complete
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            
            console.log('🎉 Workflow completed! Processing specifications for file saving...');
            
            // Extract specifications from status
            const specifications = {};
            
            // Extract requirements
            if (status.requirements?.content) {
                specifications.requirements = status.requirements.content;
            } else if (status.generated_content?.requirements?.content) {
                specifications.requirements = status.generated_content.requirements.content;
            } else if (typeof status.requirements === 'string') {
                specifications.requirements = status.requirements;
            } else if (typeof status.generated_content?.requirements === 'string') {
                specifications.requirements = status.generated_content.requirements;
            }
            
            // Extract design
            if (status.design?.content) {
                specifications.design = status.design.content;
            } else if (status.generated_content?.design?.content) {
                specifications.design = status.generated_content.design.content;
            } else if (typeof status.design === 'string') {
                specifications.design = status.design;
            } else if (typeof status.generated_content?.design === 'string') {
                specifications.design = status.generated_content.design;
            }
            
            // Extract tasks
            if (status.tasks?.content) {
                specifications.tasks = status.tasks.content;
            } else if (status.generated_content?.tasks?.content) {
                specifications.tasks = status.generated_content.tasks.content;
            } else if (typeof status.tasks === 'string') {
                specifications.tasks = status.tasks;
            } else if (typeof status.generated_content?.tasks === 'string') {
                specifications.tasks = status.generated_content.tasks;
            }
            
            console.log('📄 Extracted specifications:', {
                hasRequirements: !!specifications.requirements,
                hasDesign: !!specifications.design,
                hasTasks: !!specifications.tasks
            });
            
            // Use feature name from status, or fallback to a default
            const featureName = status.feature_name || 'specification';
            
            // Send message to extension host to save files
            vscode.postMessage({
                type: 'saveSpecifications',
                featureName: featureName,
                specifications: specifications
            });
            
            addMessage('system', '🎉 Workflow completed! Saving specification files to your workspace...');
        }

        function updateProgress(phase, percentage, text) {
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            const progressPhase = document.getElementById('progressPhase');
            const progressFill = document.getElementById('progressFill');
            
            if (progressBar && progressText && progressPhase && progressFill) {
                progressBar.style.display = 'block';
                progressText.textContent = text;
                progressPhase.textContent = phase;
                progressFill.style.width = percentage + '%';
            }
        }

        function hideProgress() {
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                progressBar.style.display = 'none';
            }
        }

        function handleSaveSpecificationsResult(message) {
            console.log('📁 Received save specifications result:', message);
            
            if (message.success) {
                addMessage('system', \`✅ \${message.message}\`);
                
                // Hide progress bar after a short delay
                setTimeout(() => hideProgress(), 2000);
            } else {
                addMessage('system', \`❌ \${message.message}\`, 'error');
                console.error('Failed to save specifications:', message.message);
            }
        }

        let projectContext = null;

        function handleProjectContext(context) {
            console.log('🎯 Received project context:', context);
            projectContext = context;
            
            // Update UI with project context
            updateProjectContextUI(context);
            
            // Show smart suggestions
            showSmartSuggestions(context);
        }

        function handleProjectContextError(error) {
            console.error('❌ Project context error:', error);
            // Silently handle - don't show error to user as this is optional
        }

        function updateProjectContextUI(context) {
            // Add project info to the header or somewhere visible
            const headerInfo = document.querySelector('.header-info');
            if (headerInfo) {
                let contextInfo = '';
                
                if (context.framework) {
                    contextInfo += \`🚀 \${context.framework}\`;
                }
                
                if (context.techStack && context.techStack.length > 0) {
                    if (contextInfo) contextInfo += ' • ';
                    contextInfo += \`💻 \${context.techStack.join(', ')}\`;
                }
                
                if (context.projectType && context.projectType !== 'unknown') {
                    if (contextInfo) contextInfo += ' • ';
                    contextInfo += \`📋 \${context.projectType.replace('-', ' ')}\`;
                }
                
                if (contextInfo) {
                    headerInfo.innerHTML = \`<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">\${contextInfo}</div>\`;
                }
            }
        }

        function showSmartSuggestions(context) {
            if (context.suggestedFeatures && context.suggestedFeatures.length > 0) {
                const suggestionsHtml = context.suggestedFeatures.map(feature => 
                    \`<button onclick="useSuggestion('\${feature}')" style="
                        background: var(--vscode-button-secondaryBackground); 
                        color: var(--vscode-button-secondaryForeground);
                        border: none; 
                        padding: 4px 8px; 
                        margin: 2px; 
                        border-radius: 3px; 
                        cursor: pointer;
                        font-size: 11px;
                    ">\${feature}</button>\`
                ).join('');
                
                // Add suggestions below the input
                const suggestionsDiv = document.getElementById('suggestions');
                if (suggestionsDiv) {
                    suggestionsDiv.innerHTML = \`
                        <div style="margin: 8px 0;">
                            <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">
                                💡 Suggested features for your \${context.projectType.replace('-', ' ')} project:
                            </div>
                            <div>\${suggestionsHtml}</div>
                        </div>
                    \`;
                }
            }
        }

        function useSuggestion(suggestion) {
            console.log('💡 Using suggestion:', suggestion);
            const input = document.getElementById('featureInput');
            if (input) {
                input.value = suggestion;
                input.focus();
            }
        }

        function disableApprovalButtons() {
            // Disable all existing approval buttons to prevent duplicate approvals
            const buttons = document.querySelectorAll('button[onclick*="approvePhase"], button[onclick*="requestChanges"]');
            buttons.forEach(button => {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            });
        }

        function renderEnhancedMarkdown(content) {
            // Enhanced markdown rendering with table support
            let html = content;
            
            // Convert markdown tables to HTML tables FIRST (before other processing)
            html = convertMarkdownTables(html);
            
            // Convert basic markdown - keeping it simple for now
            // Convert headings
            html = html.replace(/^### (.+)$/gm, '<h3 style="color: var(--vscode-foreground); font-size: 18px; font-weight: 600; margin: 16px 0 10px 0;">$1</h3>');
            html = html.replace(/^## (.+)$/gm, '<h2 style="color: var(--vscode-foreground); font-size: 20px; font-weight: 600; margin: 20px 0 12px 0;">$1</h2>');
            html = html.replace(/^# (.+)$/gm, '<h1 style="color: var(--vscode-foreground); font-size: 24px; font-weight: 700; margin: 24px 0 16px 0;">$1</h1>');
            
            // Convert bold text
            html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong style="font-weight: 600;">$1</strong>');
            
            // Convert italic text
            html = html.replace(/\\*(.+?)\\*/g, '<em style="font-style: italic;">$1</em>');
            
            // Convert inline code
            html = html.replace(/\`([^\`]+)\`/g, '<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; font-family: var(--vscode-editor-font-family); font-size: 0.9em; color: var(--vscode-foreground);">$1</code>');
            
            // Convert line breaks to HTML
            html = html.replace(/\\n/g, '<br>');
            
            // Wrap in paragraph
            html = '<div style="color: var(--vscode-foreground); line-height: 1.6; font-family: var(--vscode-font-family);">' + html + '</div>';
            
            return html;
        }

        function convertMarkdownTables(content) {
            // Split content into lines
            const lines = content.split('\\n');
            let result = [];
            let i = 0;
            
            while (i < lines.length) {
                const line = lines[i].trim();
                
                // Check if this line looks like a table header (contains pipes)
                if (line.includes('|') && line.split('|').length > 2) {
                    // Check if next line is a separator line (contains dashes and pipes)
                    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
                    
                    if (nextLine.includes('|') && nextLine.includes('-')) {
                        // We found a table! Parse it
                        const tableHtml = parseMarkdownTable(lines, i);
                        result.push(tableHtml.html);
                        i = tableHtml.nextIndex;
                        continue;
                    }
                }
                
                // Not a table, just add the line
                result.push(lines[i]);
                i++;
            }
            
            return result.join('\\n');
        }

        function parseMarkdownTable(lines, startIndex) {
            // Parse header row
            const headerLine = lines[startIndex].trim();
            const headers = headerLine.split('|').map(h => h.trim()).filter(h => h !== '');
            
            // Skip separator row
            let currentIndex = startIndex + 2;
            
            // Parse data rows
            const rows = [];
            while (currentIndex < lines.length) {
                const line = lines[currentIndex].trim();
                if (!line.includes('|') || line.split('|').length < 2) {
                    break; // End of table
                }
                
                const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
                if (cells.length > 0) {
                    rows.push(cells);
                }
                currentIndex++;
            }
            
            // Generate HTML table with beautiful VS Code styling
            let tableHtml = '<table style="' +
                'width: 100%; ' +
                'border-collapse: collapse; ' +
                'margin: 16px 0; ' +
                'background: var(--vscode-editor-background); ' +
                'border: 1px solid var(--vscode-panel-border); ' +
                'border-radius: 6px; ' +
                'overflow: hidden; ' +
                'box-shadow: 0 2px 4px rgba(0,0,0,0.1);' +
            '">';
            
            // Add header
            if (headers.length > 0) {
                tableHtml += '<thead><tr style="background: var(--vscode-button-secondaryBackground);">';
                headers.forEach(header => {
                    tableHtml += '<th style="' +
                        'padding: 12px 16px; ' +
                        'text-align: left; ' +
                        'font-weight: 600; ' +
                        'color: var(--vscode-foreground); ' +
                        'border-bottom: 2px solid var(--vscode-panel-border); ' +
                        'font-size: 13px;' +
                    '">' + escapeHtml(header) + '</th>';
                });
                tableHtml += '</tr></thead>';
            }
            
            // Add body rows
            if (rows.length > 0) {
                tableHtml += '<tbody>';
                rows.forEach((row, rowIndex) => {
                    const isEven = rowIndex % 2 === 0;
                    const rowBg = isEven ? 'var(--vscode-editor-background)' : 'var(--vscode-input-background)';
                    
                    tableHtml += '<tr style="background: ' + rowBg + '; transition: background-color 0.2s;" onmouseover="this.style.background=\\'var(--vscode-list-hoverBackground)\\'" onmouseout="this.style.background=\\'' + rowBg + '\\'">';
                    
                    // Ensure we have the right number of cells
                    for (let j = 0; j < Math.max(headers.length, row.length); j++) {
                        const cellContent = j < row.length ? row[j] : '';
                        tableHtml += '<td style="' +
                            'padding: 10px 16px; ' +
                            'color: var(--vscode-foreground); ' +
                            'border-bottom: 1px solid var(--vscode-panel-border); ' +
                            'font-size: 12px; ' +
                            'line-height: 1.4;' +
                        '">' + escapeHtml(cellContent) + '</td>';
                    }
                    tableHtml += '</tr>';
                });
                tableHtml += '</tbody>';
            }
            
            tableHtml += '</table>';
            
            return {
                html: tableHtml,
                nextIndex: currentIndex
            };
        }

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, (char) => map[char]);
        }

        function copyCodeBlock(blockId) {
            const block = document.getElementById(blockId);
            if (!block) return;
            
            const code = block.querySelector('code').textContent;
            
            navigator.clipboard.writeText(code).then(() => {
                const button = block.querySelector('.copy-button');
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.background = 'var(--vscode-button-background)';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = 'var(--vscode-button-secondaryBackground)';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code:', err);
            });
        }

        async function approvePhase(phase) {
            try {
                // Disable approval buttons immediately to prevent double-clicks
                disableApprovalButtons();
                
                addMessage('user', \`✅ Approved \${phase}\`);
                addMessage('system', \`Processing approval for \${phase}...\`);
                
                await window.specBotApi.call('POST', '/api/spec/approve', {
                    workflow_id: currentWorkflowId,
                    action: 'approve'
                });
                
            } catch (error) {
                console.error('Approval error:', error);
                addMessage('system', \`Error processing approval: \${error.message}\`, 'error');
            }
        }

        async function requestChanges(phase) {
            const feedback = prompt(\`What changes would you like for the \${phase}?\`);
            if (!feedback) return;
            
            try {
                addMessage('user', \`📝 Requested changes to \${phase}: \${feedback}\`);
                addMessage('system', \`Processing change request for \${phase}...\`);
                
                await window.specBotApi.call('POST', '/api/spec/approve', {
                    workflow_id: currentWorkflowId,
                    action: 'request_changes',
                    feedback: feedback
                });
                
            } catch (error) {
                console.error('Change request error:', error);
                addMessage('system', \`Error processing changes: \${error.message}\`, 'error');
            }
        }
    </script>
</body>
</html>`;
    }
}
exports.SpecBotPanel = SpecBotPanel;
SpecBotPanel.viewType = 'spec-bot.panel';
//# sourceMappingURL=SpecBotPanel.js.map