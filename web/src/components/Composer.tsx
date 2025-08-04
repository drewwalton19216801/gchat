import React, { KeyboardEvent } from "react";
import { clsx } from "clsx";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  disabled?: boolean;
  canSend: boolean;
};

export function Composer({ value, onChange, onSend, onStop, disabled, canSend }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1 relative">
        <textarea
          className="w-full glass rounded-2xl p-4 text-sm text-white placeholder-white/60 resize-none focus:outline-none focus:ring-2 focus:ring-white/30 focus:glass-strong transition-glass min-h-[60px]"
          rows={3}
          placeholder="Type your message here... ✨"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <div className="absolute bottom-2 right-2 text-xs text-white/50">
          {disabled ? "⏳" : "💬"}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <button
          className={clsx(
            "rounded-xl px-4 py-3 text-sm font-medium transition-glass flex items-center gap-2 min-w-[80px] justify-center",
            canSend
              ? "glass-strong text-white glow-hover hover:scale-105 transform"
              : "glass-subtle opacity-60 cursor-not-allowed text-white/60"
          )}
          onClick={onSend}
          disabled={!canSend}
          title="Send (Enter)"
        >
          {canSend ? "🚀" : "⏸️"}
          <span>Send</span>
        </button>
        <button
          className={clsx(
            "rounded-xl px-4 py-3 text-sm font-medium transition-glass flex items-center gap-2 min-w-[80px] justify-center",
            disabled
              ? "glass text-red-300 hover:text-red-200 glow-hover hover:scale-105 transform"
              : "glass-subtle opacity-60 cursor-not-allowed text-white/60"
          )}
          onClick={onStop}
          disabled={!disabled}
          title="Stop generation"
        >
          ⏹️
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
}