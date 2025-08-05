import React, { useEffect, useRef } from 'react';

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
      // Process the content to handle both markdown and LaTeX
      let processedContent = children;
      
      // Convert markdown-style formatting while preserving LaTeX
      processedContent = processedContent
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      
      containerRef.current.innerHTML = processedContent;
      
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