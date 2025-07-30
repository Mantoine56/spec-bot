/**
 * SpecBotPanel - Main webview panel for Spec-Bot
 * Handles webview creation, theming, and communication with backend
 */

import * as vscode from 'vscode';
import axios from 'axios';

export class SpecBotPanel {
    /**
     * Track the currently active panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: SpecBotPanel | undefined;

    public static readonly viewType = 'spec-bot.panel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (SpecBotPanel.currentPanel) {
            SpecBotPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            SpecBotPanel.viewType,
            'Spec-Bot',
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,

                // And restrict the webview to only loading content from our extension's directory
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out', 'webview')]
            }
        );

        SpecBotPanel.currentPanel = new SpecBotPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message) => {
                this._handleWebviewMessage(message);
            },
            null,
            this._disposables
        );

        // Listen for theme changes to update webview styling
        vscode.window.onDidChangeActiveColorTheme(
            () => {
                this._update();
            },
            null,
            this._disposables
        );
    }

    public dispose() {
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

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private async _handleWebviewMessage(message: any) {
        const config = vscode.workspace.getConfiguration('spec-bot');
        const backendUrl = config.get<string>('backendUrl', 'http://localhost:8000');

        switch (message.type) {
            case 'apiCall':
                try {
                    // Forward API calls to the backend
                    const response = await axios({
                        method: message.method,
                        url: `${backendUrl}${message.url}`,
                        data: message.data,
                        headers: {
                            'Content-Type': 'application/json',
                            // Add API keys from settings if available
                            'X-OpenAI-Key': config.get<string>('openaiApiKey', ''),
                            'X-Anthropic-Key': config.get<string>('anthropicApiKey', '')
                        }
                    });

                    // Send response back to webview
                    this._panel.webview.postMessage({
                        type: 'apiResponse',
                        id: message.id,
                        data: response.data
                    });
                } catch (error: any) {
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
        }
    }

    private async _saveSpecsToWorkspace(specs: any) {
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
                const fileUri = vscode.Uri.joinPath(specBotDir, filename as string);
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content as string));
            }

            // Show success message and offer to open files
            const action = await vscode.window.showInformationMessage(
                `Specs saved to ${specBotDir.fsPath}`,
                'Open Files'
            );

            if (action === 'Open Files') {
                // Open the requirements file first
                const requirementsUri = vscode.Uri.joinPath(specBotDir, 'requirements.md');
                const doc = await vscode.workspace.openTextDocument(requirementsUri);
                await vscode.window.showTextDocument(doc);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save specs: ${error}`);
        }
    }

    private async _checkBackendStatus(backendUrl: string) {
        try {
            await axios.get(`${backendUrl}/health`);
            this._panel.webview.postMessage({
                type: 'backendStatus',
                status: 'connected'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'backendStatus',
                status: 'disconnected',
                error: 'Backend server not responding. Please start the Spec-Bot backend.'
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
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
                </div>
            \`;
            
            console.log('🎯 React app initialized, polling will start when workflow begins');
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
                
                // Start the workflow
                const response = await window.specBotApi.call('POST', '/api/spec/start', {
                    feature_name: idea,
                    description: idea,
                    llm_provider: 'openai',
                    model_name: 'gpt-4.1'
                });
                
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
                    <h3>📋 Requirements Generated</h3>
                    <div style="background: var(--vscode-input-background); border: 1px solid var(--vscode-border); padding: 12px; border-radius: 4px; margin: 8px 0; max-height: 300px; overflow-y: auto; white-space: pre-line; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.4;">
\${requirements}
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button onclick="approvePhase('requirements')" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">✅ Approve</button>
                        <button onclick="requestChanges('requirements')" style="background: var(--vscode-secondary-background); border: 1px solid var(--vscode-border);">📝 Request Changes</button>
                    </div>
                </div>
            \`;
            
            addMessage('assistant', approvalContent);
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
                    <h3>🎨 Design Document Generated</h3>
                    <div style="background: var(--vscode-input-background); border: 1px solid var(--vscode-border); padding: 12px; border-radius: 4px; margin: 8px 0; max-height: 300px; overflow-y: auto; white-space: pre-line; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.4;">
\${design}
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button onclick="approvePhase('design')" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">✅ Approve</button>
                        <button onclick="requestChanges('design')" style="background: var(--vscode-secondary-background); border: 1px solid var(--vscode-border);">📝 Request Changes</button>
                    </div>
                </div>
            \`;
            
            addMessage('assistant', approvalContent);
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
                    <h3>📋 Implementation Tasks Generated</h3>
                    <div style="background: var(--vscode-input-background); border: 1px solid var(--vscode-border); padding: 12px; border-radius: 4px; margin: 8px 0; max-height: 300px; overflow-y: auto; white-space: pre-line; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.4;">
\${tasks}
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button onclick="approvePhase('tasks')" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">✅ Approve</button>
                        <button onclick="requestChanges('tasks')" style="background: var(--vscode-secondary-background); border: 1px solid var(--vscode-border);">📝 Request Changes</button>
                    </div>
                </div>
            \`;
            
            addMessage('assistant', approvalContent);
        }

        function displayCompletedWorkflow(status) {
            // Clear polling since workflow is complete
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            
            addMessage('system', 'Workflow completed! Generated files are available in your workspace under .specbot/specs/');
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

        function disableApprovalButtons() {
            // Disable all existing approval buttons to prevent duplicate approvals
            const buttons = document.querySelectorAll('button[onclick*="approvePhase"], button[onclick*="requestChanges"]');
            buttons.forEach(button => {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
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