"use strict";
/**
 * ContentRenderer - Enhanced content rendering with syntax highlighting
 * Transforms plain text specifications into beautiful, interactive content
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMarkdown = exports.ContentRenderer = void 0;
class ContentRenderer {
    /**
     * Render markdown content with enhanced styling and features
     */
    static renderContent(content, options = {}) {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        // Truncate content if too long
        if (opts.maxContentLength && content.length > opts.maxContentLength) {
            content = content.substring(0, opts.maxContentLength) + '\n\n*[Content truncated for performance]*';
        }
        // Parse content into sections
        const sections = this.parseSections(content);
        // Extract code blocks
        const codeBlocks = this.extractCodeBlocks(content);
        // Generate table of contents
        const tableOfContents = opts.enableTableOfContents ? this.generateTableOfContents(content) : [];
        // Render enhanced HTML
        let html = this.renderMarkdownToHtml(content, opts);
        // Apply syntax highlighting to code blocks
        if (opts.enableSyntaxHighlighting) {
            html = this.applySyntaxHighlighting(html, codeBlocks);
        }
        // Add collapsible sections
        if (opts.enableCollapsibleSections) {
            html = this.addCollapsibleSections(html, sections);
        }
        // Add copy buttons
        if (opts.enableCopyButtons) {
            html = this.addCopyButtons(html);
        }
        // Add table of contents
        if (opts.enableTableOfContents && tableOfContents.length > 0) {
            html = this.addTableOfContents(html, tableOfContents);
        }
        // Wrap in container with styling
        html = `
            ${this.SYNTAX_HIGHLIGHTING_CSS}
            <div class="rendered-content" id="rendered-content">
                ${html}
            </div>
            ${this.getInteractionScript(opts)}
        `;
        return {
            html,
            tableOfContents,
            codeBlocks,
            sections
        };
    }
    /**
     * Parse content into logical sections
     */
    static parseSections(content) {
        const sections = [];
        const lines = content.split('\n');
        let currentSection = null;
        let sectionContent = [];
        let sectionId = 0;
        for (const line of lines) {
            // Check for heading (section start)
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                // Save previous section
                if (currentSection) {
                    currentSection.content = sectionContent.join('\n').trim();
                    sections.push(currentSection);
                }
                // Start new section
                const level = headingMatch[1].length;
                const title = headingMatch[2].trim();
                currentSection = {
                    id: `section-${++sectionId}`,
                    title,
                    content: '',
                    collapsible: level >= 2,
                    collapsed: false
                };
                sectionContent = [line];
            }
            else {
                // Add to current section
                sectionContent.push(line);
            }
        }
        // Save last section
        if (currentSection) {
            currentSection.content = sectionContent.join('\n').trim();
            sections.push(currentSection);
        }
        return sections;
    }
    /**
     * Extract code blocks from content
     */
    static extractCodeBlocks(content) {
        const codeBlocks = [];
        const lines = content.split('\n');
        let inCodeBlock = false;
        let currentBlock = {};
        let blockId = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('```')) {
                if (!inCodeBlock) {
                    // Start of code block
                    const language = line.substring(3).trim() || 'text';
                    currentBlock = {
                        id: `code-block-${++blockId}`,
                        language: this.normalizeLanguage(language),
                        code: '',
                        startLine: i + 1
                    };
                    inCodeBlock = true;
                }
                else {
                    // End of code block
                    currentBlock.endLine = i + 1;
                    if (currentBlock.code) {
                        codeBlocks.push(currentBlock);
                    }
                    currentBlock = {};
                    inCodeBlock = false;
                }
            }
            else if (inCodeBlock) {
                currentBlock.code = (currentBlock.code || '') + line + '\n';
            }
        }
        return codeBlocks;
    }
    /**
     * Generate table of contents from headings
     */
    static generateTableOfContents(content) {
        const toc = [];
        const lines = content.split('\n');
        let headingId = 0;
        for (const line of lines) {
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const title = headingMatch[2].trim();
                const id = `heading-${++headingId}`;
                const anchor = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
                toc.push({
                    id,
                    level,
                    title,
                    anchor
                });
            }
        }
        return toc;
    }
    /**
     * Convert markdown to HTML with basic formatting
     */
    static renderMarkdownToHtml(content, options) {
        let html = content;
        // Convert headings
        html = html.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, title) => {
            const level = hashes.length;
            const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
            return `<h${level} id="${id}">${title}</h${level}>`;
        });
        // Convert bold text
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Convert italic text
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Convert inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Convert links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        // Convert lists
        html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1<li>$2</li>');
        html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li>$2</li>');
        // Wrap consecutive list items in ul/ol tags
        html = html.replace(/(<li>.*<\/li>\s*)+/gs, (match) => {
            const hasNumbers = /^\s*\d+\./.test(match);
            const tag = hasNumbers ? 'ol' : 'ul';
            return `<${tag}>${match}</${tag}>`;
        });
        // Convert line breaks to paragraphs
        html = html.replace(/\n\s*\n/g, '</p><p>');
        html = `<p>${html}</p>`;
        // Clean up empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        return html;
    }
    /**
     * Apply syntax highlighting to code blocks
     */
    static applySyntaxHighlighting(html, codeBlocks) {
        // Replace code blocks with highlighted versions
        return html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const lang = this.normalizeLanguage(language || 'text');
            const blockId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            return `
                <div class="code-block" id="${blockId}">
                    <div class="code-header">
                        <span class="code-language">${lang}</span>
                        <button class="copy-button" onclick="copyCode('${blockId}')">Copy</button>
                    </div>
                    <div class="code-content">
                        <pre><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>
                    </div>
                </div>
            `;
        });
    }
    /**
     * Add collapsible sections to content
     */
    static addCollapsibleSections(html, sections) {
        // This is a simplified implementation
        // In a real implementation, you'd need more sophisticated HTML parsing
        return html;
    }
    /**
     * Add copy buttons to code blocks
     */
    static addCopyButtons(html) {
        // Copy buttons are already added in applySyntaxHighlighting
        return html;
    }
    /**
     * Add table of contents to the beginning of content
     */
    static addTableOfContents(html, toc) {
        const tocHtml = `
            <div class="table-of-contents">
                <div class="toc-title">📑 Table of Contents</div>
                <ul class="toc-list">
                    ${toc.map(entry => `
                        <li class="toc-item">
                            <a href="#${entry.anchor}" class="toc-link toc-level-${entry.level}">${entry.title}</a>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        return tocHtml + html;
    }
    /**
     * Generate interactive JavaScript for the content
     */
    static getInteractionScript(options) {
        return `
            <script>
                // Copy code functionality
                function copyCode(blockId) {
                    const block = document.getElementById(blockId);
                    const code = block.querySelector('code').textContent;
                    
                    navigator.clipboard.writeText(code).then(() => {
                        const button = block.querySelector('.copy-button');
                        const originalText = button.textContent;
                        button.textContent = 'Copied!';
                        setTimeout(() => {
                            button.textContent = originalText;
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy code:', err);
                    });
                }

                // Collapsible sections
                function toggleSection(sectionId) {
                    const section = document.getElementById(sectionId);
                    const content = section.querySelector('.section-content');
                    const toggle = section.querySelector('.section-toggle');
                    
                    if (content.classList.contains('collapsed')) {
                        content.classList.remove('collapsed');
                        toggle.classList.remove('collapsed');
                    } else {
                        content.classList.add('collapsed');
                        toggle.classList.add('collapsed');
                    }
                }

                // Smooth scrolling for TOC links
                document.addEventListener('DOMContentLoaded', () => {
                    const tocLinks = document.querySelectorAll('.toc-link');
                    tocLinks.forEach(link => {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            const targetId = link.getAttribute('href').substring(1);
                            const target = document.getElementById(targetId);
                            if (target) {
                                target.scrollIntoView({ behavior: 'smooth' });
                            }
                        });
                    });
                });
            </script>
        `;
    }
    /**
     * Normalize language names for syntax highlighting
     */
    static normalizeLanguage(language) {
        const normalized = language.toLowerCase().trim();
        return this.LANGUAGE_MAP[normalized] || normalized;
    }
    /**
     * Escape HTML characters
     */
    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (char) => map[char]);
    }
}
exports.ContentRenderer = ContentRenderer;
ContentRenderer.DEFAULT_OPTIONS = {
    enableSyntaxHighlighting: true,
    enableCollapsibleSections: true,
    enableCopyButtons: true,
    enableTableOfContents: true,
    maxContentLength: 50000
};
ContentRenderer.LANGUAGE_MAP = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'dart': 'dart',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
    'json': 'json',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'md': 'markdown',
    'markdown': 'markdown',
    'docker': 'dockerfile',
    'dockerfile': 'dockerfile'
};
ContentRenderer.SYNTAX_HIGHLIGHTING_CSS = `
        <style>
            /* Prism.js Dark Theme for VS Code */
            .token.comment,
            .token.prolog,
            .token.doctype,
            .token.cdata {
                color: var(--vscode-comments);
                font-style: italic;
            }

            .token.punctuation {
                color: var(--vscode-foreground);
            }

            .token.namespace {
                opacity: .7;
            }

            .token.property,
            .token.tag,
            .token.constant,
            .token.symbol,
            .token.deleted {
                color: var(--vscode-symbolIcon-keywordForeground);
            }

            .token.boolean,
            .token.number {
                color: var(--vscode-debugTokenExpression-number);
            }

            .token.selector,
            .token.attr-name,
            .token.string,
            .token.char,
            .token.builtin,
            .token.inserted {
                color: var(--vscode-debugTokenExpression-string);
            }

            .token.operator,
            .token.entity,
            .token.url,
            .language-css .token.string,
            .style .token.string,
            .token.variable {
                color: var(--vscode-debugTokenExpression-name);
            }

            .token.atrule,
            .token.attr-value,
            .token.function,
            .token.class-name {
                color: var(--vscode-symbolIcon-functionForeground);
            }

            .token.keyword {
                color: var(--vscode-symbolIcon-keywordForeground);
                font-weight: bold;
            }

            .token.regex,
            .token.important {
                color: var(--vscode-debugTokenExpression-name);
            }

            .token.important,
            .token.bold {
                font-weight: bold;
            }
            
            .token.italic {
                font-style: italic;
            }

            /* Code Block Styling */
            .code-block {
                position: relative;
                background: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-textBlockQuote-border);
                border-radius: 6px;
                margin: 16px 0;
                overflow: hidden;
            }

            .code-header {
                background: var(--vscode-editorGroupHeader-tabsBackground);
                border-bottom: 1px solid var(--vscode-textBlockQuote-border);
                padding: 8px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }

            .code-language {
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .copy-button {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                transition: background-color 0.2s;
            }

            .copy-button:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }

            .code-content {
                padding: 16px;
                overflow-x: auto;
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                line-height: 1.5;
            }

            .code-content pre {
                margin: 0;
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            /* Collapsible Sections */
            .section {
                margin-bottom: 24px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                overflow: hidden;
            }

            .section-header {
                background: var(--vscode-editorGroupHeader-tabsBackground);
                padding: 12px 16px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
                transition: background-color 0.2s;
            }

            .section-header:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .section-title {
                font-weight: 600;
                color: var(--vscode-foreground);
            }

            .section-toggle {
                color: var(--vscode-descriptionForeground);
                font-size: 14px;
                transition: transform 0.2s;
            }

            .section-toggle.collapsed {
                transform: rotate(-90deg);
            }

            .section-content {
                padding: 16px;
                background: var(--vscode-editor-background);
                transition: max-height 0.3s ease-out;
            }

            .section-content.collapsed {
                display: none;
            }

            /* Table of Contents */
            .table-of-contents {
                background: var(--vscode-sideBar-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                padding: 16px;
                margin-bottom: 24px;
            }

            .toc-title {
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--vscode-foreground);
            }

            .toc-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .toc-item {
                margin-bottom: 4px;
            }

            .toc-link {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
                font-size: 13px;
                display: block;
                padding: 2px 0;
                transition: color 0.2s;
            }

            .toc-link:hover {
                color: var(--vscode-textLink-activeForeground);
                text-decoration: underline;
            }

            .toc-level-1 { padding-left: 0; }
            .toc-level-2 { padding-left: 16px; }
            .toc-level-3 { padding-left: 32px; }
            .toc-level-4 { padding-left: 48px; }

            /* Enhanced Markdown Styling */
            .rendered-content h1 {
                font-size: 28px;
                font-weight: 700;
                margin: 32px 0 16px 0;
                padding-bottom: 8px;
                border-bottom: 2px solid var(--vscode-textBlockQuote-border);
                color: var(--vscode-foreground);
            }

            .rendered-content h2 {
                font-size: 24px;
                font-weight: 600;
                margin: 28px 0 14px 0;
                color: var(--vscode-foreground);
            }

            .rendered-content h3 {
                font-size: 20px;
                font-weight: 600;
                margin: 24px 0 12px 0;
                color: var(--vscode-foreground);
            }

            .rendered-content h4 {
                font-size: 18px;
                font-weight: 500;
                margin: 20px 0 10px 0;
                color: var(--vscode-foreground);
            }

            .rendered-content p {
                margin: 12px 0;
                line-height: 1.6;
                color: var(--vscode-foreground);
            }

            .rendered-content ul,
            .rendered-content ol {
                margin: 12px 0;
                padding-left: 24px;
            }

            .rendered-content li {
                margin: 6px 0;
                line-height: 1.5;
            }

            .rendered-content blockquote {
                margin: 16px 0;
                padding: 12px 16px;
                background: var(--vscode-textBlockQuote-background);
                border-left: 4px solid var(--vscode-textBlockQuote-border);
                border-radius: 0 4px 4px 0;
            }

            .rendered-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 16px 0;
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                overflow: hidden;
            }

            .rendered-content th,
            .rendered-content td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .rendered-content th {
                background: var(--vscode-editorGroupHeader-tabsBackground);
                font-weight: 600;
            }

            .rendered-content code {
                background: var(--vscode-textCodeBlock-background);
                padding: 2px 6px;
                border-radius: 3px;
                font-family: var(--vscode-editor-font-family);
                font-size: 0.9em;
            }

            /* Scroll behavior */
            .rendered-content {
                scroll-behavior: smooth;
            }
        </style>
    `;
/**
 * Quick render function for simple content
 */
function renderMarkdown(content, options) {
    return ContentRenderer.renderContent(content, options).html;
}
exports.renderMarkdown = renderMarkdown;
//# sourceMappingURL=contentRenderer.js.map