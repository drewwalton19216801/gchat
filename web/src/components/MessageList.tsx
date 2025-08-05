import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { MathJaxText, MathJaxMarkdown } from "./MathJax";

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  reasoning?: string;
  createdAt: number;
};

export function MessageList({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <section aria-live="polite" aria-atomic="false">
      <ul className="space-y-4 sm:space-y-6">
        {messages.map((m) => {
          const bubbleBase =
            "rounded-2xl px-4 py-3 sm:px-6 sm:py-4 max-w-[85%] sm:max-w-[80%] transition-glass";
          const roleClass =
            m.role === "user"
              ? "ml-auto glass-strong text-white glow-hover"
              : m.role === "assistant"
              ? "mr-auto glass text-white/95"
              : "mx-auto glass-subtle text-white/90 border-yellow-400/30";
          const label =
            m.role === "user" ? "User message" : m.role === "assistant" ? "Assistant message" : "System message";

          return (
            <li key={m.id} className="flex" aria-label={label}>
              <div className={`${bubbleBase} ${roleClass} float-animation`} style={{animationDelay: `${Math.random() * 2}s`}}>
                {m.role === "user" && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-white/70">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold text-xs">
                      U
                    </div>
                    <span>You</span>
                  </div>
                )}
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-white/70">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-400 to-blue-400 flex items-center justify-center text-white font-bold text-xs">
                      🤖
                    </div>
                    <span>Assistant</span>
                  </div>
                )}
                {m.role === "system" && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-white/70">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center text-white font-bold text-xs">
                      ⚙️
                    </div>
                    <span>System</span>
                  </div>
                )}
                {m.role === "assistant" ? (
                  <div>
                    {/* Show reasoning if available */}
                    {m.reasoning && m.reasoning.trim() && (
                      <details className="mb-4 glass-subtle rounded-lg border border-white/20">
                        <summary className="cursor-pointer p-3 text-sm text-white/80 hover:text-white transition-colors">
                          🧠 Reasoning Process
                        </summary>
                        <div className="p-3 pt-0 border-t border-white/10 mt-2">
                          <MathJaxMarkdown className="prose prose-sm prose-invert max-w-none prose-headings:text-white/90 prose-p:text-white/80 prose-strong:text-white/90 prose-code:text-blue-200 prose-pre:glass-dark prose-pre:border prose-pre:border-white/20 prose-blockquote:border-white/30 prose-blockquote:text-white/70">
                            {m.reasoning}
                          </MathJaxMarkdown>
                        </div>
                      </details>
                    )}
                    {/* Main content */}
                    <MathJaxMarkdown className="prose prose-sm sm:prose-base prose-invert max-w-none prose-headings:text-white prose-p:text-white/90 prose-strong:text-white prose-code:text-blue-200 prose-pre:glass-dark prose-pre:border prose-pre:border-white/20 prose-blockquote:border-white/30 prose-blockquote:text-white/80">
                      {m.content}
                    </MathJaxMarkdown>
                  </div>
                ) : (
                  <MathJaxText className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
                    {m.content}
                  </MathJaxText>
                )}
              </div>
            </li>
          );
        })}
        <div ref={endRef} />
      </ul>
    </section>
  );
}