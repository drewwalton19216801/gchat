type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatRequest = {
  model: string;
  messages: ChatMessage[];
};

type Handlers = {
  onDelta: (cb: (chunk: string) => void) => void;
  onError: (cb: (msg: string) => void) => void;
  onDone: (cb: () => void) => void;
};

function parseSSE(stream: ReadableStream<Uint8Array>, onEvent: (event: string, data: string) => void) {
  const decoder = new TextDecoder();
  let buffer = "";
  const reader = stream.getReader();

  function feed(text: string) {
    buffer += text;
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      let data = "";
      raw.split("\n").forEach((line) => {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data += (data ? "\n" : "") + line.slice(5).trim();
        }
      });
      onEvent(event, data);
    }
  }

  return (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        feed(decoder.decode(value, { stream: true }));
      }
      feed(decoder.decode());
    } catch (e) {
      // swallow; handled by fetch/abort paths
    }
  })();
}

async function streamChatInner(req: ChatRequest, signal?: AbortSignal): Promise<Handlers> {
  const controller = new AbortController();
  const linked = new AbortController();
  const link = () => controller.abort();
  if (signal) signal.addEventListener("abort", link, { once: true });

  const deltas: Array<(c: string) => void> = [];
  const errors: Array<(m: string) => void> = [];
  const dones: Array<() => void> = [];

  const handlers: Handlers = {
    onDelta: (cb) => deltas.push(cb),
    onError: (cb) => errors.push(cb),
    onDone: (cb) => dones.push(cb),
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const msg = `Request failed: ${res.status}`;
      errors.forEach((cb) => cb(msg));
      dones.forEach((cb) => cb());
      return handlers;
    }

    parseSSE(res.body, (event, data) => {
      switch (event) {
        case "delta": {
          try {
            const json = JSON.parse(data);
            if (typeof json.content === "string") {
              deltas.forEach((cb) => cb(json.content));
            }
          } catch {
            // ignore
          }
          break;
        }
        case "raw": {
          // optional: could surface raw chunks
          break;
        }
        case "done": {
          dones.forEach((cb) => cb());
          break;
        }
        case "open":
        case "ping":
        default:
          break;
      }
    });
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      errors.forEach((cb) => cb(e?.message || "Network error"));
      dones.forEach((cb) => cb());
    }
  } finally {
    if (signal) signal.removeEventListener("abort", link);
  }

  return handlers;
}

type HealthResponse = {
  ok: boolean;
};

async function checkHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Reduce timeout for faster detection of issues
      signal: AbortSignal.timeout(3000)
    });
    
    if (!response.ok) {
      // 404 or other HTTP errors indicate backend is down
      return { healthy: false, error: `Backend unavailable (HTTP ${response.status})` };
    }
    
    const data: HealthResponse = await response.json();
    return { healthy: data.ok === true };
  } catch (error: any) {
    // Network errors, timeouts, or JSON parsing errors
    let errorMessage = "Network error";
    if (error?.name === 'TimeoutError') {
      errorMessage = "Backend connection timeout";
    } else if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
      errorMessage = "Backend server is not responding";
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    return {
      healthy: false,
      error: errorMessage
    };
  }
}

export const api = {
  streamChat: streamChatInner,
  checkHealth,
};