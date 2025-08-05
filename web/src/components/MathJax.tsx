import React, { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';

// Register the XML language for syntax highlighting
hljs.registerLanguage('xml', xml);

declare global {
  interface Window {
    MathJax: any;
  }
}

// Initialize MathJax configuration
const initMathJax = () => {
  if (!window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true,
        packages: {'[+]': ['ams', 'newcommand', 'configmacros']}
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
        ignoreHtmlClass: 'tex2jax_ignore',
        processHtmlClass: 'tex2jax_process'
      },
      startup: {
        ready: () => {
          window.MathJax.startup.defaultReady();
        }
      }
    };

    // Load MathJax script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    script.id = 'MathJax-script';
    
    // Only add if not already present
    if (!document.getElementById('MathJax-script')) {
      document.head.appendChild(script);
    }
  }
};

interface MathJaxTextProps {
  children: string;
  className?: string;
}

export function MathJaxText({ children, className = '' }: MathJaxTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initMathJax();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      // Set the content
      containerRef.current.innerHTML = children;
      
      // Process MathJax if available
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => {
          console.error('MathJax typeset error:', err);
        });
      }
    }
  }, [children]);

  return (
    <div 
      ref={containerRef} 
      className={`mathjax-text ${className}`}
    />
  );
}

// Component for rendering text with mixed content (markdown + LaTeX)
interface MathJaxMarkdownProps {
  children: string;
  className?: string;
}

export function MathJaxMarkdown({ children, className = '' }: MathJaxMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initMathJax();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      // Process the content to handle markdown, LaTeX, and XML/SVG content
      let processedContent = children;
      
      // Check if content contains SVG (starts with <?xml or <svg)
      const svgMatch = processedContent.match(/^(\s*<\?xml[^>]*>\s*)?<svg[\s\S]*<\/svg>\s*$/i);
      
      if (svgMatch) {
        // Handle SVG content - display as text in a code block instead of rendering
        const escapedContent = processedContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        
        const codeElement = document.createElement('code');
        codeElement.className = 'language-xml hljs';
        codeElement.textContent = processedContent;
        
        // Apply syntax highlighting
        hljs.highlightElement(codeElement);
        
        const preElement = document.createElement('pre');
        preElement.appendChild(codeElement);
        
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(preElement);
      } else {
        // Check for other XML/tag-based content (contains < and > with tag-like structure)
        const hasXmlTags = /<[^>]+>/g.test(processedContent) &&
                          !processedContent.match(/^[\s\S]*<(strong|em|code|br|p|div|span|h[1-6]|ul|ol|li|blockquote|pre)[\s\S]*$/i);
        
        if (hasXmlTags) {
          // Handle other XML/tag content - display in a code block
          const escapedContent = processedContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          
          const codeElement = document.createElement('code');
          codeElement.className = 'language-xml hljs';
          codeElement.textContent = processedContent;
          
          // Apply syntax highlighting
          hljs.highlightElement(codeElement);
          
          const preElement = document.createElement('pre');
          preElement.appendChild(codeElement);
          
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(preElement);
          return; // Early return to avoid further processing
        } else {
          // Convert markdown-style formatting while preserving LaTeX
          processedContent = processedContent
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        }
        
        containerRef.current.innerHTML = processedContent;
      }
      
      // Process MathJax if available
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => {
          console.error('MathJax typeset error:', err);
        });
      }
    }
  }, [children]);

  return (
    <div
      ref={containerRef}
      className={`mathjax-markdown ${className}`}
    />
  );
}