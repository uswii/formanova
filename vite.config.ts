import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

/**
 * Converts render-blocking <link rel="stylesheet"> tags to non-render-blocking
 * async pattern. Safe because critical above-the-fold CSS is already inlined
 * in index.html's <style> block.
 *
 * Industry standard: https://web.dev/defer-non-critical-css/
 */
function asyncCssPlugin(): Plugin {
  return {
    name: "async-css",
    enforce: "post",
    transformIndexHtml(html) {
      // Match Vite-injected stylesheet links (have crossorigin attribute)
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        `<link rel="preload" as="style" crossorigin href="$1" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" crossorigin href="$1"></noscript>`
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    ViteImageOptimizer({
      png: { quality: 80 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { quality: 80 },
    }),
    // Only apply async CSS in production builds
    mode === "production" && asyncCssPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable source maps only in dev; production gets clean bundles
    sourcemap: mode === "development",
    // Target modern browsers for smaller output
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          // three.js is NOT listed here — it naturally code-splits into lazy chunks
          // that import it, avoiding modulepreload on the landing page
          "vendor-framer": ["framer-motion"],
          // recharts removed from manualChunks — it naturally code-splits into
          // lazy chunks that import it, avoiding eager load on landing page
          
          "vendor-posthog": ["posthog-js", "posthog-js/react"],
          // Radix removed from manualChunks — components now naturally code-split
          // per route. Only DropdownMenu (Header) loads on landing page; Dialog,
          // Select, Tabs, Popover, Toast defer to their respective lazy routes.
        },
      },
    },
  },
}));
