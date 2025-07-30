# Spec-Bot VS Code Extension

AI-powered specification generation directly in VS Code! Generate comprehensive software specifications through an intuitive chat interface that seamlessly integrates with your development workflow.

## ✨ Features

- 🤖 **AI-Powered Spec Generation**: Requirements → Design → Tasks workflow using GPT-4.1
- 🎨 **Native VS Code Theming**: Automatically adapts to your VS Code theme (dark/light mode)  
- 💬 **Chat Interface**: Conversational spec generation with human-in-the-loop approvals
- 📁 **Workspace Integration**: Saves generated specs directly to your current workspace
- ⚙️ **Configurable**: Support for OpenAI and Anthropic models via VS Code settings
- 🔄 **Real-time**: Live communication with Spec-Bot backend

## 🚀 Quick Start

### Prerequisites

1. **VS Code 1.74.0 or higher**
2. **Spec-Bot Backend Running**: This extension communicates with the Spec-Bot FastAPI backend
   ```bash
   cd ../backend
   python main.py
   ```

### Installation & Usage

1. **Open the extension in VS Code**:
   - Press `F5` to launch the Extension Development Host
   - Or run "Run Extension" from the Debug panel

2. **Configure API Keys**:
   - Open VS Code Settings (`Cmd/Ctrl + ,`)
   - Search for "Spec-Bot"
   - Add your OpenAI or Anthropic API key

3. **Open Spec-Bot Panel**:
   - Use Command Palette (`Cmd/Ctrl + Shift + P`)
   - Run "Spec-Bot: Generate Specification"
   - Or click the Spec-Bot icon in the Explorer panel

4. **Generate Specifications**:
   - Enter your feature idea in the chat interface
   - Review and approve each phase (Requirements → Design → Tasks)
   - Generated specs are automatically saved to `.specbot/specs/` in your workspace

## ⚙️ Configuration

Configure Spec-Bot through VS Code Settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `spec-bot.openaiApiKey` | OpenAI API Key for GPT models | `""` |
| `spec-bot.anthropicApiKey` | Anthropic API Key for Claude models | `""` |
| `spec-bot.defaultProvider` | Default LLM provider | `"openai"` |
| `spec-bot.defaultModel` | Default model to use | `"gpt-4.1"` |
| `spec-bot.backendUrl` | Spec-Bot backend server URL | `"http://localhost:8000"` |

## 🎨 VS Code Theme Integration

The extension automatically adapts to your VS Code theme:

- **Dark Themes**: Uses VS Code's dark color palette with proper contrast
- **Light Themes**: Matches VS Code's light theme styling  
- **High Contrast**: Fully supports high contrast accessibility themes
- **Custom Themes**: Inherits colors from any VS Code theme or extension

The webview uses VS Code's CSS variables for perfect theme integration:
- `--vscode-foreground` for text color
- `--vscode-editor-background` for backgrounds
- `--vscode-button-background` for interactive elements
- `--vscode-focusBorder` for accent colors

## 🏗️ Architecture

```
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code Extension │    │   FastAPI Backend│    │   OpenAI GPT-4.1│
│   • Webview Panel   │◄──►│   • LangGraph    │◄──►│   • 1M Tokens   │
│   • Theme Integration│    │   • 18+ Endpoints│    │   • Latest Model│
│   • Workspace Files │    │   • File Manager │    │                 │
│   • Settings UI     │    │   • Workflow Mgmt│    │                 │
└─────────────────────┘    └──────────────────┘    └─────────────────┘
                                     │                           
                                     ▼                           
                           ┌──────────────────┐                  
                           │  File System     │                  
                           │  .specbot/specs/ │                  
                           │  • requirements  │                  
                           │  • design.md     │                  
                           │  • tasks.md      │                  
                           │  • metadata.json │                  
                           └──────────────────┘                  
```

## 📁 Generated Output

When you generate a specification, the extension creates:

```
your-workspace/
└── .specbot/
    └── specs/
        └── your-feature-name/
            ├── requirements.md    # User stories & acceptance criteria
            ├── design.md         # Technical architecture & components  
            ├── tasks.md          # Implementation plan & tasks
            └── metadata.json     # Workflow metadata
```

## 🔧 Development

### Project Structure

```
vscode-extension/
├── src/
│   ├── extension.ts           # Main extension entry point
│   └── webview/
│       └── SpecBotPanel.ts   # Webview panel management
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript configuration
└── .vscode/
    ├── launch.json          # Debug configuration
    └── tasks.json           # Build tasks
```

### Building & Testing

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run extension in development
# Press F5 in VS Code or use "Run Extension" debug configuration
```

## 🚀 Next Steps

Upcoming features:
- [ ] **React Integration**: Full React component integration for richer UI
- [ ] **Side Panel**: Convert to native VS Code side panel view
- [ ] **Keyboard Shortcuts**: Power user keyboard navigation
- [ ] **File Templates**: Custom specification templates
- [ ] **Team Collaboration**: Multi-user workflow support

## 🤝 Contributing

This extension is part of the larger Spec-Bot project. See the main repository for contribution guidelines.

## 📄 License

MIT License - see the main Spec-Bot project for details.

---

**🎉 Transform your feature ideas into comprehensive specifications without leaving VS Code!**