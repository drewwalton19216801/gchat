import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';

interface EnhancedMarkdownProps {
  children: string;
  className?: string;
}

// Normalize language aliases to ensure consistent handling (e.g., golang -> go)
function normalizeLanguage(lang?: string | null): string | undefined {
  if (!lang) return undefined;
  const l = lang.toLowerCase();
  const map: Record<string, string> = {
    golang: 'go',
    'go-lang': 'go',
    go: 'go',
    jsx: 'javascript',
    tsx: 'typescript',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    py: 'python',
    js: 'javascript',
    ts: 'typescript',
    yml: 'yaml',
  };
  return map[l] || l;
}

// Attempt to read a language from a className string like "language-xxx ..."
function extractLanguageFromClassName(className?: string): string | undefined {
  if (!className) return undefined;
  const m = className.match(/(?:^|\s)language-([a-zA-Z0-9_-]+)/);
  return normalizeLanguage(m?.[1]);
}

export function EnhancedMarkdown({ children, className = '' }: EnhancedMarkdownProps) {
  // Check if content contains SVG (starts with <?xml or <svg and ends with </svg>)
  const svgMatch = children.match(/^(\s*<\?xml[^>]*>\s*)?<svg[\s\S]*<\/svg>\s*$/i);
  
  if (svgMatch) {
    // If it's pure SVG content, wrap it in our CodeBlock component
    return (
      <CodeBlock className="language-xml">
        {children}
      </CodeBlock>
    );
  }

  // Check for other XML/tag-based content that should be treated as code
  const hasXmlTags = /<[^>]+>/g.test(children) &&
                    !children.match(/^[\s\S]*<(strong|em|code|br|p|div|span|h[1-6]|ul|ol|li|blockquote|pre)[\s\S]*$/i) &&
                    // Make sure it's not already wrapped in markdown code blocks
                    !children.includes('```');

  if (hasXmlTags) {
    // If it contains XML/HTML tags but isn't markdown, treat as XML code
    return (
      <CodeBlock className="language-xml">
        {children}
      </CodeBlock>
    );
  }

  // Otherwise, use ReactMarkdown with our custom components
  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre: ({ children, ...props }) => {
          // Function to recursively find code elements
          const findCodeElement = (node: React.ReactNode): React.ReactElement | null => {
            if (React.isValidElement(node) && node.type === 'code') {
              return node;
            }
            if (React.isValidElement(node) && (node.props as any).children) {
              const childArray = React.Children.toArray((node.props as any).children);
              for (const child of childArray) {
                const found = findCodeElement(child);
                if (found) return found;
              }
            }
            if (Array.isArray(node)) {
              for (const child of node) {
                const found = findCodeElement(child);
                if (found) return found;
              }
            }
            return null;
          };

          const codeElement = findCodeElement(children);
          
          if (codeElement) {
            // Extract language from className or props
            const innerClassName = (codeElement.props as any).className || '';
            const language = extractLanguageFromClassName(innerClassName);
            const normalizedClassName = language ? `language-${language}` : innerClassName;
            
            return (
              <CodeBlock
                className={normalizedClassName}
                language={language}
                {...props}
              >
                {(codeElement.props as any).children}
              </CodeBlock>
            );
          }

          // Fallback: sometimes language might be on the pre element
          const preClassName = (props as any).className as string | undefined;
          const preLanguage = extractLanguageFromClassName(preClassName);

          if (preLanguage) {
            return (
              <CodeBlock
                className={`language-${preLanguage}`}
                language={preLanguage}
                {...props}
              >
                {children}
              </CodeBlock>
            );
          }
          
          // As a last resort, still wrap with CodeBlock to ensure copy UI
          return (
            <CodeBlock className={preClassName} {...props}>
              {children}
            </CodeBlock>
          );
        },
        code: ({ className, children, ...props }: any) => {
          return <code className={className} {...props}>{children}</code>;
        }
      }}
    >
      {children}
    </ReactMarkdown>
  );
}