import React from "react";

export function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-3 relative z-20">
      <div className="flex items-start gap-4 rounded-2xl glass-dark border border-red-400/30 p-4 text-red-200 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center text-white font-bold">
            ⚠️
          </div>
          <div className="font-semibold text-red-300">Error</div>
        </div>
        <div className="flex-1 whitespace-pre-wrap text-red-100 leading-relaxed">{message}</div>
        <button
          className="glass-subtle rounded-lg px-3 py-2 text-sm text-red-300 hover:text-red-200 transition-glass glow-hover"
          onClick={onClose}
          title="Dismiss error"
        >
          ✕
        </button>
      </div>
    </div>
  );
}