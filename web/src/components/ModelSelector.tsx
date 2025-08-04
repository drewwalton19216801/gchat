import React, { useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

type Model = { id: string; name: string };

export function ModelSelector({ value, onChange }: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setModels(data.models || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative">
      <select
        className="glass-subtle rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 focus:glass-strong transition-glass min-w-[100px] sm:min-w-[140px] max-w-[140px] sm:max-w-none pr-6 sm:pr-8"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        title="Model"
      >
        {models.length === 0 ? (
          <option value={value} className="bg-gray-800 text-white">
            {loading ? "🔄 Loading..." : value}
          </option>
        ) : (
          models.map((m) => (
            <option key={m.id} value={m.id} className="bg-gray-800 text-white">
              {m.name}
            </option>
          ))
        )}
      </select>
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-white/70">
        {loading ? "🔄" : "🔽"}
      </div>
    </div>
  );
}