import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Dev only: proxy /api to a locally running API server. Set PWNDA_API_ORIGIN
    // before `npm run dev`; without it no proxy is configured. The production
    // build never reads this block.
    ...(process.env.PWNDA_API_ORIGIN
      ? { proxy: { "/api": { target: process.env.PWNDA_API_ORIGIN, changeOrigin: true } } }
      : {}),
    // Allow custom hostnames here
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "pwnda.org",
      ".pwnda.org",
      "host.docker.internal",    // allow subdomains too if needed
    ],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Larger initial chunks -> fewer round-trips on cold load. Cloudflare's
    // edge caches these aggressively (filenames are content-hashed).
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Client-only. In the SSR build react is external, and naming an
        // external module in manualChunks is a hard rollup error:
        //   "react" cannot be included in manualChunks because it is
        //   resolved as an external module
        manualChunks: isSsrBuild
          ? undefined
          : {
              // Heavy libs that change rarely -> their own chunks so visitors
              // don't redownload them when our app code changes.
              "vendor-react": ["react", "react-dom", "react-router-dom"],
              "vendor-query": ["@tanstack/react-query"],
              "vendor-charts": ["recharts"],
              "vendor-radix": [
                "@radix-ui/react-dialog",
                "@radix-ui/react-popover",
                "@radix-ui/react-tooltip",
                "@radix-ui/react-select",
                "@radix-ui/react-tabs",
                "@radix-ui/react-toast",
                "@radix-ui/react-dropdown-menu",
                "@radix-ui/react-accordion",
                "@radix-ui/react-navigation-menu",
              ],
            },
      },
    },
  },
}));
