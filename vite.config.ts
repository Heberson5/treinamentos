import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
  },
  plugins: [
    react(),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em arquivos próprios: ficam em cache entre atualizações
        // do sistema e baixam em paralelo.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "vendor-react";
          if (/node_modules\/(@supabase|iceberg-js)\//.test(id)) return "vendor-supabase";
          if (/node_modules\/@tanstack\//.test(id)) return "vendor-query";
          if (/node_modules\/(@radix-ui|@floating-ui|cmdk|sonner|react-remove-scroll[^/]*|react-style-singleton|use-callback-ref|use-sidecar|aria-hidden|lucide-react|tailwind-merge|clsx|class-variance-authority)\//.test(id)) return "vendor-ui";
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
}));
