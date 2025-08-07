import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ModelSelector } from "./components/ModelSelector";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { ErrorBanner } from "./components/ErrorBanner";
import { HealthStatus } from "./components/HealthStatus";
import { ApiKeyConfig } from "./components/ApiKeyConfig";
import { api } from "./lib/api";
import "./styles/index.css";

export type Role = "system" | "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  createdAt: number;
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}

export default function App() {
  const [model, setModel] = useLocalStorageState("gchat:model", "openrouter/auto");
  const [systemPrompt, setSystemPrompt] = useLocalStorageState("gchat:sys", "");
  const [messages, setMessages] = useLocalStorageState<Message[]>("gchat:messages", []);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [isHealthy, setIsHealthy] = useState(true);
  const [healthError, setHealthError] = useState<string | undefined>();
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useLocalStorageState("gchat:reasoning", false);
  const [reasoningEffort, setReasoningEffort] = useLocalStorageState<"high" | "medium" | "low">("gchat:reasoning-effort", "medium");
  const [showReasoning, setShowReasoning] = useLocalStorageState("gchat:show-reasoning", true);
  const [userApiKey, setUserApiKey] = useLocalStorageState("gchat:api-key", "");
  const [showApiKeyConfig, setShowApiKeyConfig] = useState(false);
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [serverHasApiKey, setServerHasApiKey] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const healthCheckRef = useRef<number | null>(null);

  const canSend = useMemo(() => {
    const hasApiKey = serverHasApiKey === true || userApiKey.trim().length > 0;
    return input.trim().length > 0 && !streaming && isHealthy && hasApiKey;
  }, [input, streaming, isHealthy, serverHasApiKey, userApiKey]);

  // Check if server has API key configured
  const checkServerApiKey = useCallback(async () => {
    try {
      // Try to make a test request without providing an API key
      const testReq = {
        model: "openrouter/auto",
        messages: [{ role: "user" as const, content: "test" }],
      };
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testReq),
        signal: AbortSignal.timeout(5000)
      });
      
      // If we get a 500 with "missing OPENROUTER_API_KEY", server doesn't have key
      if (response.status === 500) {
        const text = await response.text();
        if (text.includes("missing OPENROUTER_API_KEY")) {
          setServerHasApiKey(false);
          return;
        }
        // For other 500 errors, don't assume server has API key - treat as unknown
        console.log("Server API key check failed with 500 error:", text);
        setServerHasApiKey(null); // Keep as unknown, don't assume either way
        return;
      }
      
      // Only assume server has API key if we get a successful response or expected error
      if (response.status === 200 || response.status === 400) {
        setServerHasApiKey(true);
      } else {
        // For other status codes, keep as unknown
        console.log("Server API key check returned unexpected status:", response.status);
        setServerHasApiKey(null);
      }
    } catch (error) {
      // Network errors or timeouts - don't assume anything about API key status
      console.log("Server API key check failed with network error:", error);
      setServerHasApiKey(null); // Keep as unknown
    }
  }, []);

  // Health check function
  const checkBackendHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    console.log("Starting health check...");
    try {
      const result = await api.checkHealth();
      console.log("Health check result:", result);
      setIsHealthy(result.healthy);
      setHealthError(result.error);
    } catch (error: any) {
      console.log("Health check error:", error);
      setIsHealthy(false);
      setHealthError(error?.message || "Health check failed");
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Set up periodic health checks and check server API key
  useEffect(() => {
    // Initial health check and API key check
    checkBackendHealth();
    checkServerApiKey();

    // Set up periodic checks - more frequent when unhealthy
    const interval = isHealthy ? 30000 : 10000; // 30s when healthy, 10s when unhealthy
    healthCheckRef.current = setInterval(checkBackendHealth, interval);

    return () => {
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
    };
  }, [isHealthy, checkBackendHealth, checkServerApiKey]); // Re-run when health status changes

  // Show API key config if server doesn't have key and user hasn't provided one
  useEffect(() => {
    if (serverHasApiKey === false && !userApiKey.trim()) {
      setShowApiKeyConfig(true);
    } else if (serverHasApiKey === true || userApiKey.trim()) {
      setShowApiKeyConfig(false);
    }
    // If serverHasApiKey is null (unknown), don't change the current state
  }, [serverHasApiKey, userApiKey]);

  // Handle API key submission
  const handleApiKeySubmit = useCallback(async (apiKey: string) => {
    setApiKeyValidating(true);
    setApiKeyError(null);
    
    try {
      const result = await api.validateApiKey(apiKey);
      if (result.valid) {
        setUserApiKey(apiKey);
        setShowApiKeyConfig(false);
        setApiKeyError(null);
      } else {
        setApiKeyError(result.error || "Invalid API key");
      }
    } catch (error: any) {
      setApiKeyError(error?.message || "Failed to validate API key");
    } finally {
      setApiKeyValidating(false);
    }
  }, []);

  // Also check health when network errors occur during chat
  const handleNetworkError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    // Trigger immediate health check if it looks like a network error
    if (errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('failed')) {
      checkBackendHealth();
    }
  }, [checkBackendHealth]);

  const onSend = useCallback(async () => {
    if (!canSend) return;
    setError(null);

    // Perform a health check right before sending to ensure backend is available
    console.log("Performing pre-send health check...");
    const healthResult = await api.checkHealth();
    if (!healthResult.healthy) {
      setIsHealthy(false);
      setHealthError(healthResult.error);
      setError(`Cannot send message: ${healthResult.error || 'Backend is unavailable'}`);
      return;
    }

    // Update health status if it was previously unhealthy
    if (!isHealthy) {
      setIsHealthy(true);
      setHealthError(undefined);
    }

    const newMsgs: Message[] = [
      ...messages,
      {
        id: crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15),
        role: "user",
        content: input,
        createdAt: Date.now(),
      },
    ];
    setMessages(newMsgs);
    setInput("");
    setStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const req: {
        model: string;
        messages: { role: "system" | "user" | "assistant"; content: string }[];
        reasoning?: { effort?: "high" | "medium" | "low"; exclude?: boolean };
        api_key?: string;
      } = {
        model,
        messages: [
          ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
          ...newMsgs.map((m) => ({ role: m.role as Role, content: m.content })),
        ],
      };

      // Add reasoning configuration if enabled
      if (reasoningEnabled) {
        req.reasoning = {
          effort: reasoningEffort,
          exclude: !showReasoning,
        };
      }

      // Add user API key if server doesn't have one or status is unknown
      if (serverHasApiKey !== true && userApiKey.trim()) {
        req.api_key = userApiKey.trim();
      }

      const { onDelta, onReasoning, onError, onDone } = await api.streamChat(req, ac.signal);

      let assistantId = crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15);
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", reasoning: "", createdAt: Date.now() },
      ]);

      onDelta((chunk) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        );
      });

      onReasoning((chunk) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, reasoning: (m.reasoning || "") + chunk } : m))
        );
      });

      onError((msg) => {
        handleNetworkError(msg);
      });

      onDone(() => {
        setStreaming(false);
        abortRef.current = null;
      });
    } catch (e: any) {
      handleNetworkError(e?.message || "Failed to send message");
      setStreaming(false);
      abortRef.current = null;
    }
  }, [canSend, input, messages, model, systemPrompt, reasoningEnabled, reasoningEffort, showReasoning, serverHasApiKey, userApiKey, isHealthy, handleNetworkError]);

  const onStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    abortRef.current = null;
  }, []);

  const onClear = useCallback(() => {
    setMessages([]);
    setError(null);
    setInput("");
  }, []);

  const onExport = useCallback(() => {
    const blob = new Blob([JSON.stringify({ model, systemPrompt, messages }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gchat-conversation.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [model, systemPrompt, messages]);

  // Memoize handlers for child components
  const handleModelChange = useCallback((value: string) => {
    setModel(value);
  }, [setModel]);

  const handleSystemPromptChange = useCallback((value: string) => {
    setSystemPrompt(value);
  }, [setSystemPrompt]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
  }, []);

  const handleErrorClose = useCallback(() => {
    setError(null);
  }, []);

  const handleShowApiKeyConfig = useCallback(() => {
    setShowApiKeyConfig(true);
  }, []);

  const handleReasoningEnabledChange = useCallback((enabled: boolean) => {
    setReasoningEnabled(enabled);
  }, [setReasoningEnabled]);

  const handleReasoningEffortChange = useCallback((effort: "high" | "medium" | "low") => {
    setReasoningEffort(effort);
  }, [setReasoningEffort]);

  const handleShowReasoningChange = useCallback((show: boolean) => {
    setShowReasoning(show);
  }, [setShowReasoning]);

  const handleDefaultSystemPrompt = useCallback(() => {
    setSystemPrompt(
      systemPrompt ||
        "You are GChat, a concise and accurate assistant. Respond with helpful structure."
    );
  }, [systemPrompt, setSystemPrompt]);

  return (
    <div className="min-h-dvh relative">
      {/* GitHub banner */}
      <div className="github-banner" aria-hidden="true">
        <a
          href="https://github.com/drewwalton19216801/gchat"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub: drewwalton19216801/gchat"
          title="View on GitHub"
        >
          View on GitHub
        </a>
      </div>
      {/* API Key Configuration Modal */}
      {showApiKeyConfig && (
        <ApiKeyConfig
          onApiKeySubmit={handleApiKeySubmit}
          isLoading={apiKeyValidating}
          error={apiKeyError || undefined}
        />
      )}

      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-3xl float-animation"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl float-animation" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-indigo-400/15 to-purple-400/15 rounded-full blur-3xl float-animation" style={{animationDelay: '4s'}}></div>
      </div>

      <a
        href="#composer"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md glass focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to composer
      </a>
      <header
        className="glass sticky top-0 z-40 border-b border-white/20"
        role="banner"
      >
        <div className="max-w-[80vw] sm:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw] 2xl:max-w-[80vw] mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile layout: stacked */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-lg text-white glow" aria-label="GChat home">
                ✨ GChat
              </h1>
              <label htmlFor="model" className="sr-only">
                Model
              </label>
              <ModelSelector value={model} onChange={handleModelChange} />
            </div>
            <div className="flex items-center gap-2 justify-center">
              <button
                className="glass-subtle rounded-lg px-2 py-1.5 text-xs text-white/90 hover:text-white transition-glass glow-hover flex-1 max-w-[120px]"
                onClick={onExport}
                aria-label="Export conversation as JSON"
                title="Export conversation as JSON"
              >
                📤 Export
              </button>
              <button
                className="glass-subtle rounded-lg px-2 py-1.5 text-xs text-white/90 hover:text-white transition-glass glow-hover flex-1 max-w-[120px]"
                onClick={onClear}
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                🗑️ Clear
              </button>
              {serverHasApiKey === false && (
                <button
                  className="glass-subtle rounded-lg px-2 py-1.5 text-xs text-white/90 hover:text-white transition-glass glow-hover flex-1 max-w-[120px]"
                  onClick={handleShowApiKeyConfig}
                  aria-label="Configure API Key"
                  title="Configure API Key"
                >
                  🔑 Key
                </button>
              )}
            </div>
            {/* Reasoning controls for mobile */}
            <div className="flex items-center gap-2 justify-center">
              <label className="flex items-center gap-1 text-xs text-white/90">
                <input
                  type="checkbox"
                  checked={reasoningEnabled}
                  onChange={(e) => handleReasoningEnabledChange(e.target.checked)}
                  className="rounded"
                />
                🧠 Reasoning
              </label>
              {reasoningEnabled && (
                <>
                  <div className="relative">
                    <select
                      value={reasoningEffort}
                      onChange={(e) => handleReasoningEffortChange(e.target.value as "high" | "medium" | "low")}
                      className="glass-subtle rounded-lg px-2 py-1.5 text-xs text-white/90 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 focus:glass-strong transition-glass min-w-[80px] pr-6"
                      title="Reasoning Effort"
                    >
                      <option value="low" className="bg-gray-800 text-white">Low</option>
                      <option value="medium" className="bg-gray-800 text-white">Medium</option>
                      <option value="high" className="bg-gray-800 text-white">High</option>
                    </select>
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-white/70">
                      🔽
                    </div>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-white/90">
                    <input
                      type="checkbox"
                      checked={showReasoning}
                      onChange={(e) => handleShowReasoningChange(e.target.checked)}
                      className="rounded"
                    />
                    Show
                  </label>
                </>
              )}
            </div>
          </div>
          
          {/* Desktop layout: single row */}
          <div className="hidden sm:flex gap-2 sm:gap-3 items-center">
            <h1 className="font-bold text-lg sm:text-xl text-white glow" aria-label="GChat home">
              ✨ GChat
            </h1>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {/* Reasoning controls for desktop */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-white/90">
                  <input
                    type="checkbox"
                    checked={reasoningEnabled}
                    onChange={(e) => handleReasoningEnabledChange(e.target.checked)}
                    className="rounded"
                  />
                  🧠 Reasoning
                </label>
                {reasoningEnabled && (
                  <>
                    <div className="relative">
                      <select
                        value={reasoningEffort}
                        onChange={(e) => handleReasoningEffortChange(e.target.value as "high" | "medium" | "low")}
                        className="glass-subtle rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 focus:glass-strong transition-glass min-w-[80px] sm:min-w-[100px] pr-6 sm:pr-8"
                        title="Reasoning Effort"
                      >
                        <option value="low" className="bg-gray-800 text-white">Low</option>
                        <option value="medium" className="bg-gray-800 text-white">Medium</option>
                        <option value="high" className="bg-gray-800 text-white">High</option>
                      </select>
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-white/70">
                        🔽
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-white/90">
                      <input
                        type="checkbox"
                        checked={showReasoning}
                        onChange={(e) => handleShowReasoningChange(e.target.checked)}
                        className="rounded"
                      />
                      Show
                    </label>
                  </>
                )}
              </div>
              <label htmlFor="model" className="sr-only">
                Model
              </label>
              <ModelSelector value={model} onChange={handleModelChange} />
              <button
                className="glass-subtle rounded-lg px-3 py-2 text-xs sm:text-sm text-white/90 hover:text-white transition-glass glow-hover"
                onClick={onExport}
                aria-label="Export conversation as JSON"
                title="Export conversation as JSON"
              >
                📤 Export
              </button>
              <button
                className="glass-subtle rounded-lg px-3 py-2 text-xs sm:text-sm text-white/90 hover:text-white transition-glass glow-hover"
                onClick={onClear}
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                🗑️ Clear
              </button>
              {serverHasApiKey === false && (
                <button
                  className="glass-subtle rounded-lg px-3 py-2 text-xs sm:text-sm text-white/90 hover:text-white transition-glass glow-hover"
                  onClick={handleShowApiKeyConfig}
                  aria-label="Configure API Key"
                  title="Configure API Key"
                >
                  🔑 API Key
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {error && <ErrorBanner message={error} onClose={handleErrorClose} />}

      <main className="max-w-[80vw] sm:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw] 2xl:max-w-[80vw] mx-auto px-3 sm:px-4 py-6 sm:py-8 relative z-10" role="main">
        <HealthStatus
          isHealthy={isHealthy}
          error={healthError}
          isChecking={isCheckingHealth}
        />
        <div className="mb-6">
          <label htmlFor="system-prompt" className="block text-sm font-medium mb-2 text-white/90">
            System prompt (optional)
          </label>
          <textarea
            id="system-prompt"
            className="w-full rounded-xl glass p-4 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 focus:glass-strong transition-glass resize-none"
            rows={2}
            value={systemPrompt}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder="You are a helpful assistant..."
            aria-describedby="system-prompt-help"
          />
          <p id="system-prompt-help" className="mt-2 text-xs text-white/70">
            Preface the assistant with a role or instructions applied to the entire conversation.
          </p>
        </div>
        <MessageList messages={messages} />
      </main>

      <footer
        className="sticky bottom-0 w-full glass border-t border-white/20 relative z-10"
        role="contentinfo"
      >
        <div className="max-w-[80vw] sm:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw] 2xl:max-w-[80vw] mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Composer
            value={input}
            onChange={handleInputChange}
            onSend={onSend}
            onStop={onStop}
            disabled={streaming || !isHealthy}
            canSend={canSend}
            isHealthy={isHealthy}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-white/70">
            <span>
              Press Enter to send, Shift+Enter for newline.{" "}
              <button
                className="underline underline-offset-2 hover:text-white/90 transition-colors"
                onClick={handleDefaultSystemPrompt}
              >
                Use default system prompt
              </button>
            </span>
            <span aria-live="polite" className="flex items-center gap-2">
              {streaming ? (
                <>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Streaming...
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  Ready
                </>
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}