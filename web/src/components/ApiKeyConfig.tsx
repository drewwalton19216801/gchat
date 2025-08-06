import React, { useState, memo } from 'react';

interface ApiKeyConfigProps {
  onApiKeySubmit: (apiKey: string) => void;
  isLoading?: boolean;
  error?: string;
}

export const ApiKeyConfig = memo(function ApiKeyConfig({ onApiKeySubmit, isLoading = false, error }: ApiKeyConfigProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onApiKeySubmit(apiKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full border border-white/20 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full glass-subtle flex items-center justify-center">
            <span className="text-2xl">🔑</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">OpenRouter API Key Required</h2>
          <p className="text-white/70 text-sm">
            The server doesn't have an OpenRouter API key configured. Please provide your own API key to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-white/90 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-xl glass p-4 pr-12 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:glass-strong transition-glass"
                disabled={isLoading}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/90 transition-colors"
                disabled={isLoading}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {error && (
            <div className="glass-subtle rounded-lg p-3 border border-red-400/30">
              <div className="flex items-center gap-2 text-red-300 text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!apiKey.trim() || isLoading}
            className="w-full glass-strong rounded-xl px-4 py-3 text-white font-medium hover:glass-stronger focus:outline-none focus:ring-2 focus:ring-white/30 transition-glass disabled:opacity-50 disabled:cursor-not-allowed glow-hover"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Validating...</span>
              </div>
            ) : (
              'Continue with API Key'
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="text-xs text-white/60 space-y-2">
            <p>
              <strong>Where to get an API key:</strong>
            </p>
            <p>
              Visit{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline underline-offset-2"
              >
                openrouter.ai/keys
              </a>{' '}
              to create your API key.
            </p>
            <p className="mt-3">
              <strong>Privacy:</strong> Your API key is stored locally in your browser and sent directly to OpenRouter. It's never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});