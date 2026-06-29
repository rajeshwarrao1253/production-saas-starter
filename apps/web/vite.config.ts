/**
 * vite.config.ts — Vite Configuration
 *
 * Fast development server with HMR, path aliases,
 * and environment variable handling for the web app.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy API requests during development to avoid CORS
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:4000",
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          react: ["react", "react-dom"],
          router: ["react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));
