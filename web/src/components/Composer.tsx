import React, { KeyboardEvent, memo } from "react";
import { clsx } from "clsx";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  disabled?: boolean;
  canSend: boolean;
  isHealthy?: boolean;
};

export const Composer = memo(function Composer({ value, onChange, onSend, onStop, disabled, canSend, isHealthy = true }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
      <div className="flex-1 relative">
        <textarea
          className={clsx(
            "w-full glass rounded-2xl p-3 sm:p-4 text-sm text-white placeholder-white/60 resize-none focus:outline-none focus:ring-2 transition-glass min-h-[60px]",
            isHealthy
              ? "focus:ring-white/30 focus:glass-strong"
              : "focus:ring-red-400/30 border border-red-400/30"
          )}
          rows={3}
          placeholder={isHealthy ? "Type your message here... ✨" : "Backend unavailable - cannot send messages"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || !isHealthy}
        />
        <div className="absolute bottom-2 right-2 text-xs text-white/50">
          {!isHealthy ? "🔴" : disabled ? "⏳" : "💬"}
        </div>
      </div>
      <div className="flex sm:flex-col gap-2 sm:gap-3">
        <button
          className={clsx(
            "rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-glass flex items-center gap-1 sm:gap-2 min-w-[70px] sm:min-w-[80px] justify-center flex-1 sm:flex-none",
            canSend
              ? "glass-strong text-white glow-hover hover:scale-105 transform"
              : "glass-subtle opacity-60 cursor-not-allowed text-white/60"
          )}
          onClick={onSend}
          disabled={!canSend}
          title="Send (Enter)"
        >
          {!isHealthy ? "🔴" : canSend ? "🚀" : "⏸️"}
          <span className="hidden xs:inline sm:inline">{!isHealthy ? "Offline" : "Send"}</span>
        </button>
        <button
          className={clsx(
            "rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-glass flex items-center gap-1 sm:gap-2 min-w-[70px] sm:min-w-[80px] justify-center flex-1 sm:flex-none",
            disabled
              ? "glass text-red-300 hover:text-red-200 glow-hover hover:scale-105 transform"
              : "glass-subtle opacity-60 cursor-not-allowed text-white/60"
          )}
          onClick={onStop}
          disabled={!disabled}
          title="Stop generation"
        >
          ⏹️
          <span className="hidden xs:inline sm:inline">Stop</span>
        </button>
      </div>
    </div>
  );
});