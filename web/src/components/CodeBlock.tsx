import React, { useState } from 'react';

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  language?: string;
}

// Normalize language aliases to ensure consistent labeling (e.g., golang -> go)
function normalizeLanguage(lang?: string | null): string | undefined {
  if (!lang) return undefined;
  const l = String(lang).toLowerCase();
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

export function CodeBlock({ children, className, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  // Extract the actual code content from the children
  const getCodeContent = (node: React.ReactNode): string => {
    if (typeof node === 'string') {
      return node;
    }
    if (React.isValidElement(node) && node.props.children) {
      return getCodeContent(node.props.children);
    }
    if (Array.isArray(node)) {
      return node.map(getCodeContent).join('');
    }
    return '';
  };

  // Trim trailing whitespace/newlines for a cleaner copy
  const codeContent = getCodeContent(children).replace(/\s+$/,'');
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Extract language from className (format: language-xxx)
  const classLangMatch = className?.match(/(?:^|\s)language-([a-zA-Z0-9_-]+)/)?.[1];
  const detectedLanguage = normalizeLanguage(classLangMatch || language);

  return (
    <div className="relative group">
      {/* Language label and copy button container */}
      <div className="flex items-center justify-between mb-2">
        {detectedLanguage && (
          <span className="text-xs text-white/60 font-mono uppercase tracking-wide">
            {detectedLanguage}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="glass-subtle rounded-md px-3 py-1.5 text-xs text-white/80 hover:text-white transition-glass glow-hover opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center gap-1.5"
          title={copied ? 'Copied!' : 'Copy code'}
          aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      
      {/* Code block with enhanced styling */}
      <div className="relative">
        <pre className={`${className || ''} glass-dark rounded-lg border border-white/20 overflow-x-auto`}>
          <code className="block p-4 text-sm font-mono leading-relaxed">
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}