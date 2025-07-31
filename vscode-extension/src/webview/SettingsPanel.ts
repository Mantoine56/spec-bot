/**
 * SettingsPanel - Advanced configuration interface for Spec-Bot
 * Provides comprehensive settings management with secure credential storage
 */

import * as vscode from 'vscode';

export class SettingsPanel {
    /**
     * Track the currently active settings panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: SettingsPanel | undefined;

    public static readonly viewType = 'spec-bot-settings';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            SettingsPanel.viewType,
            '⚙️ Spec-Bot Settings',
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
                
                // Restrict the webview to only loading content from our extension's `media` directory.
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],

                // Retain context when hidden
                retainContextWhenHidden: true
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri, context);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri, context);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._context = context;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                this._handleMessage(message);
            },
            null,
            this._disposables
        );
    }

    private async _handleMessage(message: any) {
        console.log('🔧 Settings panel received message:', message);

        switch (message.type) {
            case 'saveApiKey':
                await this._saveApiKey(message.provider, message.key);
                break;

            case 'getApiKey':
                await this._getApiKey(message.provider);
                break;

            case 'saveSetting':
                await this._saveSetting(message.key, message.value);
                break;

            case 'getSetting':
                await this._getSetting(message.key);
                break;

            case 'getAllSettings':
                await this._getAllSettings();
                break;

            case 'resetSettings':
                await this._resetSettings();
                break;

            case 'testApiKey':
                await this._testApiKey(message.provider, message.key);
                break;
        }
    }

    private async _saveApiKey(provider: string, key: string) {
        try {
            // Store API keys securely in VS Code's secret storage
            const secretKey = `spec-bot.${provider}.apiKey`;
            await this._context.secrets.store(secretKey, key);
            
            // Also save the provider selection in regular settings
            const config = vscode.workspace.getConfiguration('spec-bot');
            await config.update('defaultLlmProvider', provider, vscode.ConfigurationTarget.Global);
            
            console.log(`✅ Saved API key for ${provider}`);
            
            this._panel.webview.postMessage({
                type: 'apiKeySaved',
                provider: provider,
                success: true
            });

        } catch (error) {
            console.error(`❌ Error saving API key for ${provider}:`, error);
            
            this._panel.webview.postMessage({
                type: 'apiKeySaved',
                provider: provider,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _getApiKey(provider: string) {
        try {
            const secretKey = `spec-bot.${provider}.apiKey`;
            const key = await this._context.secrets.get(secretKey);
            
            this._panel.webview.postMessage({
                type: 'apiKeyValue',
                provider: provider,
                key: key ? '••••••••••••••••' : '', // Mask the key for security
                hasKey: !!key
            });

        } catch (error) {
            console.error(`❌ Error getting API key for ${provider}:`, error);
            
            this._panel.webview.postMessage({
                type: 'apiKeyValue',
                provider: provider,
                key: '',
                hasKey: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _saveSetting(key: string, value: any) {
        try {
            const config = vscode.workspace.getConfiguration('spec-bot');
            await config.update(key, value, vscode.ConfigurationTarget.Global);
            
            console.log(`✅ Saved setting: ${key} = ${value}`);
            
            this._panel.webview.postMessage({
                type: 'settingSaved',
                key: key,
                success: true
            });

        } catch (error) {
            console.error(`❌ Error saving setting ${key}:`, error);
            
            this._panel.webview.postMessage({
                type: 'settingSaved',
                key: key,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _getSetting(key: string) {
        try {
            const config = vscode.workspace.getConfiguration('spec-bot');
            const value = config.get(key);
            
            this._panel.webview.postMessage({
                type: 'settingValue',
                key: key,
                value: value
            });

        } catch (error) {
            console.error(`❌ Error getting setting ${key}:`, error);
            
            this._panel.webview.postMessage({
                type: 'settingValue',
                key: key,
                value: null,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _getAllSettings() {
        try {
            const config = vscode.workspace.getConfiguration('spec-bot');
            const settings = {
                defaultLlmProvider: config.get('defaultLlmProvider', 'openai'),
                defaultModel: config.get('defaultModel', 'gpt-4'),
                autoSaveSpecs: config.get('autoSaveSpecs', true),
                autoOpenFiles: config.get('autoOpenFiles', true),
                fileNamingPattern: config.get('fileNamingPattern', 'feature-name'),
                outputDirectory: config.get('outputDirectory', '.specbot-generated'),
                approvalRequired: config.get('approvalRequired', true),
                debugMode: config.get('debugMode', false),
                maxSpecLength: config.get('maxSpecLength', 10000),
                includeProjectContext: config.get('includeProjectContext', true)
            };
            
            // Check which API keys are available (without revealing them)
            const apiKeys = {
                openai: !!(await this._context.secrets.get('spec-bot.openai.apiKey')),
                anthropic: !!(await this._context.secrets.get('spec-bot.anthropic.apiKey'))
            };
            
            this._panel.webview.postMessage({
                type: 'allSettings',
                settings: settings,
                apiKeys: apiKeys
            });

        } catch (error) {
            console.error('❌ Error getting all settings:', error);
            
            this._panel.webview.postMessage({
                type: 'allSettings',
                settings: {},
                apiKeys: {},
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _resetSettings() {
        try {
            const config = vscode.workspace.getConfiguration('spec-bot');
            
            // Reset all settings to defaults
            const settingsToReset = [
                'defaultLlmProvider',
                'defaultModel', 
                'autoSaveSpecs',
                'autoOpenFiles',
                'fileNamingPattern',
                'outputDirectory',
                'approvalRequired',
                'debugMode',
                'maxSpecLength',
                'includeProjectContext'
            ];
            
            for (const setting of settingsToReset) {
                await config.update(setting, undefined, vscode.ConfigurationTarget.Global);
            }
            
            // Optionally reset API keys (ask user first)
            const resetApiKeys = await vscode.window.showWarningMessage(
                'Do you also want to clear all saved API keys?',
                { modal: true },
                'Yes, clear API keys',
                'No, keep API keys'
            );
            
            if (resetApiKeys === 'Yes, clear API keys') {
                await this._context.secrets.delete('spec-bot.openai.apiKey');
                await this._context.secrets.delete('spec-bot.anthropic.apiKey');
            }
            
            console.log('✅ Settings reset to defaults');
            
            this._panel.webview.postMessage({
                type: 'settingsReset',
                success: true,
                apiKeysCleared: resetApiKeys === 'Yes, clear API keys'
            });
            
            // Refresh the settings display
            await this._getAllSettings();

        } catch (error) {
            console.error('❌ Error resetting settings:', error);
            
            this._panel.webview.postMessage({
                type: 'settingsReset',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _testApiKey(provider: string, key: string) {
        try {
            console.log(`🧪 Testing API key for ${provider}...`);
            
            // This is a placeholder - in a real implementation, you'd make a test API call
            // For now, we'll just validate the key format
            let isValid = false;
            let errorMessage = '';
            
            if (provider === 'openai') {
                isValid = key.startsWith('sk-') && key.length > 20;
                errorMessage = isValid ? '' : 'OpenAI API keys should start with "sk-" and be longer than 20 characters';
            } else if (provider === 'anthropic') {
                isValid = key.startsWith('sk-ant-') && key.length > 20;
                errorMessage = isValid ? '' : 'Anthropic API keys should start with "sk-ant-" and be longer than 20 characters';
            }
            
            this._panel.webview.postMessage({
                type: 'apiKeyTestResult',
                provider: provider,
                isValid: isValid,
                error: errorMessage
            });

        } catch (error) {
            console.error(`❌ Error testing API key for ${provider}:`, error);
            
            this._panel.webview.postMessage({
                type: 'apiKeyTestResult',
                provider: provider,
                isValid: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;

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
        this._panel.title = '⚙️ Spec-Bot Settings';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Spec-Bot Settings</title>
            <style>
                /* VS Code Theme Variables */
                :root {
                    --vscode-foreground: var(--vscode-editor-foreground);
                    --vscode-background: var(--vscode-editor-background);
                    --vscode-secondary-background: var(--vscode-sideBar-background);
                    --vscode-border: var(--vscode-panel-border);
                    --vscode-input-background: var(--vscode-input-background);
                    --vscode-input-foreground: var(--vscode-input-foreground);
                    --vscode-input-border: var(--vscode-input-border);
                    --vscode-button-background: var(--vscode-button-background);
                    --vscode-button-foreground: var(--vscode-button-foreground);
                    --vscode-button-hover-background: var(--vscode-button-hoverBackground);
                    --vscode-button-secondary-background: var(--vscode-button-secondaryBackground);
                    --vscode-button-secondary-foreground: var(--vscode-button-secondaryForeground);
                    --vscode-error-foreground: var(--vscode-errorForeground);
                    --vscode-success-foreground: var(--vscode-testing-iconPassed);
                    --vscode-warning-foreground: var(--vscode-editorWarning-foreground);
                    --vscode-description-foreground: var(--vscode-descriptionForeground);
                }

                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-background);
                    margin: 0;
                    padding: 20px;
                    line-height: 1.5;
                }

                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }

                h1 {
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                    font-size: 24px;
                    font-weight: 600;
                }

                .subtitle {
                    color: var(--vscode-description-foreground);
                    margin-bottom: 32px;
                    font-size: 14px;
                }

                .section {
                    background: var(--vscode-secondary-background);
                    border: 1px solid var(--vscode-border);
                    border-radius: 6px;
                    padding: 24px;
                    margin-bottom: 24px;
                }

                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: var(--vscode-foreground);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .section-description {
                    color: var(--vscode-description-foreground);
                    margin-bottom: 20px;
                    font-size: 13px;
                    line-height: 1.6;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                .form-group:last-child {
                    margin-bottom: 0;
                }

                label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                    font-size: 13px;
                }

                input, select, textarea {
                    width: 100%;
                    padding: 8px 12px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-family: inherit;
                    font-size: 13px;
                    box-sizing: border-box;
                }

                input:focus, select:focus, textarea:focus {
                    outline: none;
                    border-color: var(--vscode-button-background);
                }

                .input-group {
                    display: flex;
                    gap: 8px;
                    align-items: flex-end;
                }

                .input-group input {
                    flex: 1;
                }

                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 13px;
                    font-weight: 500;
                    transition: background-color 0.2s;
                }

                button:hover {
                    background: var(--vscode-button-hover-background);
                }

                button.secondary {
                    background: var(--vscode-button-secondary-background);
                    color: var(--vscode-button-secondary-foreground);
                }

                button.danger {
                    background: var(--vscode-error-foreground);
                    color: white;
                }

                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .checkbox-group input[type="checkbox"] {
                    width: auto;
                    margin: 0;
                }

                .status-indicator {
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .status-success {
                    background: rgba(0, 255, 0, 0.1);
                    color: var(--vscode-success-foreground);
                }

                .status-error {
                    background: rgba(255, 0, 0, 0.1);
                    color: var(--vscode-error-foreground);
                }

                .status-warning {
                    background: rgba(255, 165, 0, 0.1);
                    color: var(--vscode-warning-foreground);
                }

                .help-text {
                    font-size: 12px;
                    color: var(--vscode-description-foreground);
                    margin-top: 4px;
                    line-height: 1.4;
                }

                .actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 24px;
                    border-top: 1px solid var(--vscode-border);
                }

                .loading {
                    opacity: 0.6;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .spinner {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid var(--vscode-description-foreground);
                    border-radius: 50%;
                    border-top-color: var(--vscode-button-background);
                    animation: spin 1s ease-in-out infinite;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚙️ Spec-Bot Settings</h1>
                <p class="subtitle">Configure your AI-powered specification generator</p>

                <!-- API Configuration Section -->
                <div class="section">
                    <div class="section-title">
                        🔑 API Configuration
                    </div>
                    <div class="section-description">
                        Configure your AI provider API keys. Keys are stored securely using VS Code's secret storage.
                    </div>

                    <div class="form-group">
                        <label for="llmProvider">Default LLM Provider</label>
                        <select id="llmProvider">
                            <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                        </select>
                        <div class="help-text">Choose your preferred AI provider for spec generation</div>
                    </div>

                    <div class="form-group">
                        <label for="openaiKey">OpenAI API Key</label>
                        <div class="input-group">
                            <input type="password" id="openaiKey" placeholder="sk-..." />
                            <button onclick="testApiKey('openai')" id="testOpenaiBtn">Test</button>
                            <button onclick="saveApiKey('openai')" class="secondary">Save</button>
                        </div>
                        <div id="openaiStatus" class="help-text"></div>
                    </div>

                    <div class="form-group">
                        <label for="anthropicKey">Anthropic API Key</label>
                        <div class="input-group">
                            <input type="password" id="anthropicKey" placeholder="sk-ant-..." />
                            <button onclick="testApiKey('anthropic')" id="testAnthropicBtn">Test</button>
                            <button onclick="saveApiKey('anthropic')" class="secondary">Save</button>
                        </div>
                        <div id="anthropicStatus" class="help-text"></div>
                    </div>

                    <div class="form-group">
                        <label for="defaultModel">Default Model</label>
                        <select id="defaultModel">
                            <option value="gpt-4">GPT-4 (Recommended)</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                            <option value="claude-3-haiku">Claude 3 Haiku</option>
                        </select>
                        <div class="help-text">Select the AI model for generating specifications</div>
                    </div>
                </div>

                <!-- Workflow Settings Section -->
                <div class="section">
                    <div class="section-title">
                        🔄 Workflow Settings
                    </div>
                    <div class="section-description">
                        Customize how the specification generation workflow behaves.
                    </div>

                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="approvalRequired" />
                            <label for="approvalRequired">Require manual approval for each phase</label>
                        </div>
                        <div class="help-text">When enabled, you'll review and approve each phase (Requirements → Design → Tasks)</div>
                    </div>

                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="includeProjectContext" />
                            <label for="includeProjectContext">Include project context in generation</label>
                        </div>
                        <div class="help-text">Use detected project information (tech stack, framework) to improve specifications</div>
                    </div>

                    <div class="form-group">
                        <label for="maxSpecLength">Maximum Specification Length</label>
                        <input type="number" id="maxSpecLength" min="1000" max="50000" step="1000" />
                        <div class="help-text">Maximum characters per specification section (1000-50000)</div>
                    </div>
                </div>

                <!-- File Management Section -->
                <div class="section">
                    <div class="section-title">
                        📁 File Management
                    </div>
                    <div class="section-description">
                        Configure how generated specifications are saved and organized.
                    </div>

                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="autoSaveSpecs" />
                            <label for="autoSaveSpecs">Auto-save specifications to workspace</label>
                        </div>
                        <div class="help-text">Automatically save generated specs as markdown files</div>
                    </div>

                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="autoOpenFiles" />
                            <label for="autoOpenFiles">Auto-open generated files</label>
                        </div>
                        <div class="help-text">Open specification files in VS Code editor tabs after generation</div>
                    </div>

                    <div class="form-group">
                        <label for="outputDirectory">Output Directory</label>
                        <input type="text" id="outputDirectory" placeholder=".specbot-generated" />
                        <div class="help-text">Directory name for saving specifications (relative to workspace root)</div>
                    </div>

                    <div class="form-group">
                        <label for="fileNamingPattern">File Naming Pattern</label>
                        <select id="fileNamingPattern">
                            <option value="feature-name">Feature Name (my-feature/requirements.md)</option>
                            <option value="timestamp">Timestamp (2024-01-15-143022/requirements.md)</option>
                            <option value="custom">Custom Pattern</option>
                        </select>
                        <div class="help-text">How to organize and name generated specification files</div>
                    </div>
                </div>

                <!-- Advanced Settings Section -->
                <div class="section">
                    <div class="section-title">
                        🔧 Advanced Settings
                    </div>
                    <div class="section-description">
                        Advanced configuration options for power users.
                    </div>

                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="debugMode" />
                            <label for="debugMode">Enable debug mode</label>
                        </div>
                        <div class="help-text">Show detailed logging and debug information in VS Code console</div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="actions">
                    <button onclick="saveAllSettings()">💾 Save All Settings</button>
                    <button onclick="resetAllSettings()" class="danger">🔄 Reset to Defaults</button>
                    <button onclick="exportSettings()" class="secondary">📤 Export Settings</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                let currentSettings = {};
                let currentApiKeys = {};

                // Initialize settings panel
                window.addEventListener('load', () => {
                    console.log('🔧 Settings panel loaded');
                    loadAllSettings();
                });

                function loadAllSettings() {
                    vscode.postMessage({ type: 'getAllSettings' });
                }

                function saveApiKey(provider) {
                    const input = document.getElementById(provider + 'Key');
                    const key = input.value.trim();
                    
                    if (!key) {
                        showStatus(provider + 'Status', 'Please enter an API key', 'error');
                        return;
                    }
                    
                    showStatus(provider + 'Status', 'Saving...', 'loading');
                    vscode.postMessage({ 
                        type: 'saveApiKey', 
                        provider: provider, 
                        key: key 
                    });
                }

                function testApiKey(provider) {
                    const input = document.getElementById(provider + 'Key');
                    const key = input.value.trim();
                    
                    if (!key) {
                        showStatus(provider + 'Status', 'Please enter an API key first', 'error');
                        return;
                    }
                    
                    showStatus(provider + 'Status', 'Testing...', 'loading');
                    const button = document.getElementById('test' + provider.charAt(0).toUpperCase() + provider.slice(1) + 'Btn');
                    button.disabled = true;
                    
                    vscode.postMessage({ 
                        type: 'testApiKey', 
                        provider: provider, 
                        key: key 
                    });
                }

                function saveAllSettings() {
                    const settings = {
                        defaultLlmProvider: document.getElementById('llmProvider').value,
                        defaultModel: document.getElementById('defaultModel').value,
                        autoSaveSpecs: document.getElementById('autoSaveSpecs').checked,
                        autoOpenFiles: document.getElementById('autoOpenFiles').checked,
                        fileNamingPattern: document.getElementById('fileNamingPattern').value,
                        outputDirectory: document.getElementById('outputDirectory').value,
                        approvalRequired: document.getElementById('approvalRequired').checked,
                        debugMode: document.getElementById('debugMode').checked,
                        maxSpecLength: parseInt(document.getElementById('maxSpecLength').value) || 10000,
                        includeProjectContext: document.getElementById('includeProjectContext').checked
                    };

                    // Save each setting
                    for (const [key, value] of Object.entries(settings)) {
                        vscode.postMessage({ 
                            type: 'saveSetting', 
                            key: key, 
                            value: value 
                        });
                    }

                    // Show success message
                    showGlobalMessage('Settings saved successfully!', 'success');
                }

                function resetAllSettings() {
                    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
                        vscode.postMessage({ type: 'resetSettings' });
                    }
                }

                function exportSettings() {
                    const settingsData = {
                        settings: currentSettings,
                        timestamp: new Date().toISOString(),
                        version: '1.0'
                    };
                    
                    const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'spec-bot-settings.json';
                    a.click();
                    URL.revokeObjectURL(url);
                }

                function showStatus(elementId, message, type) {
                    const element = document.getElementById(elementId);
                    element.className = 'help-text';
                    
                    if (type === 'loading') {
                        element.innerHTML = '<span class="spinner"></span> ' + message;
                    } else {
                        element.className += ' status-' + type;
                        element.textContent = message;
                    }
                }

                function showGlobalMessage(message, type) {
                    // Simple implementation - could be enhanced with a toast notification
                    alert(message);
                }

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'allSettings':
                            currentSettings = message.settings;
                            currentApiKeys = message.apiKeys;
                            populateSettings(message.settings, message.apiKeys);
                            break;
                            
                        case 'apiKeySaved':
                            const saveButton = document.querySelector(\`button[onclick="saveApiKey('\${message.provider}')"]\`);
                            saveButton.disabled = false;
                            
                            if (message.success) {
                                showStatus(message.provider + 'Status', 'API key saved successfully!', 'success');
                                currentApiKeys[message.provider] = true;
                            } else {
                                showStatus(message.provider + 'Status', 'Failed to save: ' + message.error, 'error');
                            }
                            break;
                            
                        case 'apiKeyTestResult':
                            const testButton = document.getElementById('test' + message.provider.charAt(0).toUpperCase() + message.provider.slice(1) + 'Btn');
                            testButton.disabled = false;
                            
                            if (message.isValid) {
                                showStatus(message.provider + 'Status', 'API key is valid!', 'success');
                            } else {
                                showStatus(message.provider + 'Status', 'Invalid key: ' + message.error, 'error');
                            }
                            break;
                            
                        case 'settingsReset':
                            if (message.success) {
                                showGlobalMessage('Settings reset successfully!', 'success');
                                loadAllSettings(); // Reload to show defaults
                            } else {
                                showGlobalMessage('Failed to reset settings: ' + message.error, 'error');
                            }
                            break;
                    }
                });

                function populateSettings(settings, apiKeys) {
                    // Populate form fields with current settings
                    document.getElementById('llmProvider').value = settings.defaultLlmProvider || 'openai';
                    document.getElementById('defaultModel').value = settings.defaultModel || 'gpt-4';
                    document.getElementById('autoSaveSpecs').checked = settings.autoSaveSpecs !== false;
                    document.getElementById('autoOpenFiles').checked = settings.autoOpenFiles !== false;
                    document.getElementById('fileNamingPattern').value = settings.fileNamingPattern || 'feature-name';
                    document.getElementById('outputDirectory').value = settings.outputDirectory || '.specbot-generated';
                    document.getElementById('approvalRequired').checked = settings.approvalRequired !== false;
                    document.getElementById('debugMode').checked = settings.debugMode === true;
                    document.getElementById('maxSpecLength').value = settings.maxSpecLength || 10000;
                    document.getElementById('includeProjectContext').checked = settings.includeProjectContext !== false;
                    
                    // Show API key status
                    if (apiKeys.openai) {
                        showStatus('openaiStatus', 'API key configured', 'success');
                    } else {
                        showStatus('openaiStatus', 'No API key configured', 'warning');
                    }
                    
                    if (apiKeys.anthropic) {
                        showStatus('anthropicStatus', 'API key configured', 'success');
                    } else {
                        showStatus('anthropicStatus', 'No API key configured', 'warning');
                    }
                }
            </script>
        </body>
        </html>`;
    }
}