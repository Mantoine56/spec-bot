/**
 * Spec-Bot VS Code Extension
 * Main extension entry point that creates and manages the webview panel
 */

import * as vscode from 'vscode';
import { SpecBotPanel } from './webview/SpecBotPanel';

/**
 * Extension activation function
 * Called when the extension is activated (first time command is executed)
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Spec-Bot extension activated successfully!');
    
    try {
        // Register command to open the Spec-Bot panel
        const disposable = vscode.commands.registerCommand('spec-bot.openPanel', () => {
            console.log('🤖 Spec-Bot command executed!');
            SpecBotPanel.createOrShow(context.extensionUri);
        });

        context.subscriptions.push(disposable);
        console.log('✅ Command registered: spec-bot.openPanel');

        // Set context variable to show the panel in explorer
        vscode.commands.executeCommand('setContext', 'spec-bot.panelVisible', true);
        console.log('✅ Extension setup complete');
        
    } catch (error) {
        console.error('❌ Error in extension activation:', error);
    }
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export function deactivate() {
    console.log('Spec-Bot extension deactivated');
}