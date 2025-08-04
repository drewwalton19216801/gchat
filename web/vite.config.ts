import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../backend", "");
  
  // Debug: log environment variables
  console.log("Environment variables:", {
    VITE_HOST: env.VITE_HOST,
    BACKEND_URL: env.BACKEND_URL,
    SERVER_IP: env.SERVER_IP
  });
  
  // Determine backend target - always use localhost for backend since it's on the same machine
  let backendTarget = "http://localhost:8080";
  
  console.log("Using backend target:", backendTarget);
  
  return {
    plugins: [react()],
    server: {
      host: env.VITE_HOST || "localhost",
      port: parseInt(env.VITE_PORT || "5173"),
      strictPort: true,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
          // Ensure proxy works when accessed via IP
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Log proxy requests for debugging
              console.log(`Proxying ${req.method} ${req.url} to ${backendTarget}`);
            });
          },
        },
      },
    },
    build: {
      sourcemap: true,
    },
  };
});