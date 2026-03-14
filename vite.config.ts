import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

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
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-toast",
          ],
        },
      },
    },
  },
}));
