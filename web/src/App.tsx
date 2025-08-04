import React, { useEffect, useMemo, useRef, useState } from "react";
import { ModelSelector } from "./components/ModelSelector";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { ErrorBanner } from "./components/ErrorBanner";
import { HealthStatus } from "./components/HealthStatus";
import { api } from "./lib/api";
import "./styles/index.css";

export type Role = "system" | "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
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
  const abortRef = useRef<AbortController | null>(null);
  const healthCheckRef = useRef<number | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !streaming && isHealthy, [input, streaming, isHealthy]);

  // Health check function
  const checkBackendHealth = async () => {
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
  };

  // Set up periodic health checks
  useEffect(() => {
    // Initial health check
    checkBackendHealth();

    // Set up periodic checks - more frequent when unhealthy
    const interval = isHealthy ? 30000 : 10000; // 30s when healthy, 10s when unhealthy
    healthCheckRef.current = setInterval(checkBackendHealth, interval);

    return () => {
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
    };
  }, [isHealthy]); // Re-run when health status changes

  // Also check health when network errors occur during chat
  const handleNetworkError = (errorMessage: string) => {
    setError(errorMessage);
    // Trigger immediate health check if it looks like a network error
    if (errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('failed')) {
      checkBackendHealth();
    }
  };

  const onSend = async () => {
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
      const req: { model: string; messages: { role: "system" | "user" | "assistant"; content: string }[] } = {
        model,
        messages: [
          ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
          ...newMsgs.map((m) => ({ role: m.role as Role, content: m.content })),
        ],
      };

      const { onDelta, onError, onDone } = await api.streamChat(req, ac.signal);

      let assistantId = crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15);
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
      ]);

      onDelta((chunk) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
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
  };

  const onStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    abortRef.current = null;
  };

  const onClear = () => {
    setMessages([]);
    setError(null);
    setInput("");
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify({ model, systemPrompt, messages }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gchat-conversation.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh relative">
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
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile layout: stacked */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-lg text-white glow" aria-label="GChat home">
                ✨ GChat
              </h1>
              <label htmlFor="model" className="sr-only">
                Model
              </label>
              <ModelSelector value={model} onChange={setModel} />
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
            </div>
          </div>
          
          {/* Desktop layout: single row */}
          <div className="hidden sm:flex gap-2 sm:gap-3 items-center">
            <h1 className="font-bold text-lg sm:text-xl text-white glow" aria-label="GChat home">
              ✨ GChat
            </h1>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <label htmlFor="model" className="sr-only">
                Model
              </label>
              <ModelSelector value={model} onChange={setModel} />
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
            </div>
          </div>
        </div>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 relative z-10" role="main">
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
            onChange={(e) => setSystemPrompt(e.target.value)}
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
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Composer
            value={input}
            onChange={setInput}
            onSend={onSend}
            disabled={streaming || !isHealthy}
            onStop={onStop}
            canSend={canSend}
            isHealthy={isHealthy}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-white/70">
            <span>
              Press Enter to send, Shift+Enter for newline.{" "}
              <button
                className="underline underline-offset-2 hover:text-white/90 transition-colors"
                onClick={() =>
                  setSystemPrompt(
                    systemPrompt ||
                      "You are GChat, a concise and accurate assistant. Respond with helpful structure."
                  )
                }
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