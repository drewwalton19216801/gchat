import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';

interface EnhancedMarkdownProps {
  children: string;
  className?: string;
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
          const codeElement = React.Children.toArray(children).find(
            (child): child is React.ReactElement =>
              React.isValidElement(child) && child.type === 'code'
          );
          
          if (codeElement) {
            return (
              <CodeBlock
                className={codeElement.props.className}
                {...props}
              >
                {codeElement.props.children}
              </CodeBlock>
            );
          }
          
          return <pre {...props}>{children}</pre>;
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