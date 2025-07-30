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
/**
 * Extension activation function
 * Called when the extension is activated (first time command is executed)
 */
function activate(context) {
    console.log('🚀 Spec-Bot extension activated successfully!');
    try {
        // Register command to open the Spec-Bot panel
        const disposable = vscode.commands.registerCommand('spec-bot.openPanel', () => {
            console.log('🤖 Spec-Bot command executed!');
            SpecBotPanel_1.SpecBotPanel.createOrShow(context.extensionUri);
        });
        context.subscriptions.push(disposable);
        console.log('✅ Command registered: spec-bot.openPanel');
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