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
          "vendor-framer": ["framer-motion"],
          "vendor-posthog": ["posthog-js", "posthog-js/react"],
          // Radix: no manual chunk — let each component split naturally
          // with the lazy page that imports it. Avoids 230KB on landing.
        },
      },
    },
  },
}));
