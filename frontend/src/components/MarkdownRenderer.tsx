import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

/**
 * Props for the MarkdownRenderer component
 */
interface MarkdownRendererProps {
  content: string;
  className?: string;
  isPreview?: boolean; // For sidebar previews vs full documents
}

/**
 * Professional markdown renderer with syntax highlighting
 * Provides enhanced formatting for generated specification documents
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '', 
  isPreview = false 
}) => {
  return (
    <div className={`markdown-renderer ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom code block rendering with syntax highlighting
          code({ children, className, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const inline = !className || !className.startsWith('language-');
            
            return !inline && language ? (
              <SyntaxHighlighter
                style={vscDarkPlus as any}
                language={language}
                PreTag="div"
                className="rounded-lg text-sm"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code 
                className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono" 
                {...props}
              >
                {children}
              </code>
            );
          },
          
          // Enhanced heading styles
          h1: ({ children }) => (
            <h1 className={`font-bold text-gray-900 pb-2 border-b border-gray-200 ${
              isPreview ? 'text-lg mb-3' : 'text-2xl mb-4'
            }`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`font-semibold text-gray-800 ${
              isPreview ? 'text-base mb-2 mt-4' : 'text-xl mb-3 mt-6'
            }`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`font-semibold text-gray-700 ${
              isPreview ? 'text-sm mb-2 mt-3' : 'text-lg mb-2 mt-4'
            }`}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className={`font-semibold text-gray-700 ${
              isPreview ? 'text-sm mb-1 mt-2' : 'text-base mb-2 mt-3'
            }`}>
              {children}
            </h4>
          ),
          
          // Enhanced paragraph styles
          p: ({ children }) => (
            <p className={`text-gray-700 leading-relaxed ${
              isPreview ? 'mb-3' : 'mb-4'
            }`}>
              {children}
            </p>
          ),
          
          // Enhanced list styles
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="ml-2">
              {children}
            </li>
          ),
          
          // Enhanced blockquote styles
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 text-gray-700 italic">
              {children}
            </blockquote>
          ),
          
          // Enhanced table styles
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-300 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-200">
              {children}
            </td>
          ),
          
          // Enhanced link styles
          a: ({ children, href }) => (
            <a 
              href={href} 
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank" 
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          
          // Enhanced horizontal rule
          hr: () => (
            <hr className="my-6 border-t border-gray-300" />
          ),
          
          // Enhanced strong/bold text
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">
              {children}
            </strong>
          ),
          
          // Enhanced emphasis/italic text
          em: ({ children }) => (
            <em className="italic text-gray-800">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 