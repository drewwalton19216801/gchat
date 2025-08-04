import React from "react";

interface HealthStatusProps {
  isHealthy: boolean;
  error?: string;
  isChecking?: boolean;
}

export function HealthStatus({ isHealthy, error, isChecking }: HealthStatusProps) {
  if (isChecking) {
    return (
      <div className="glass border border-yellow-400/30 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 text-yellow-200">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <span className="text-sm">Checking backend status...</span>
        </div>
      </div>
    );
  }

  if (!isHealthy) {
    return (
      <div className="glass border border-red-400/30 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 text-red-200">
          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
          <span className="text-sm font-medium">Backend service is unavailable</span>
        </div>
        {error && (
          <p className="text-xs text-red-300/80 mt-1">
            Error: {error}
          </p>
        )}
        <p className="text-xs text-red-300/80 mt-1">
          Please check your connection or try again later.
        </p>
      </div>
    );
  }

  return null; // Don't show anything when healthy
}